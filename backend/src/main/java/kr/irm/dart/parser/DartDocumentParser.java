package kr.irm.dart.parser;

import kr.irm.dart.domain.ReportType;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 공시 원본 ZIP → 대상 섹션의 표 추출.
 *
 * 구조 근거는 M0-FINDINGS 발견 9·10:
 *   - SECTION-1 / SECTION-2 가 실제 중첩 엘리먼트라 제1부 스코핑이 구조적으로 해결된다
 *   - TITLE/@AASSOCNOTE 가 한글 제목보다 안정적인 매칭 키다
 */
@Component
public class DartDocumentParser {

    private static final Logger log = LoggerFactory.getLogger(DartDocumentParser.class);

    /**
     * 본문 글자 수 상한. 넘으면 파싱하지 않는다.
     *
     * 실측(힙 585MB, SerialGC): 22.1M자 문서는 DOM 66MB / 총 116MB로 여유롭고,
     * 63.6M자 문서는 총 393MB를 쓴다. 코스피·코스닥 최대 관측치가 22.1M자(SK 사업보고서)라
     * 40M자면 실제 문서는 모두 통과하고 예상 못 한 초대형만 걸린다.
     */
    private static final int MAX_XML_CHARS = 40_000_000;

    private final ParseRules rules;
    private final TableConverter converter;

    public DartDocumentParser(ParseRules rules, TableConverter converter) {
        this.rules = rules;
        this.converter = converter;
    }

    /** @param dcmNo DART 뷰어 문서번호. 본문 이미지 주소에 쓰인다. 없으면 자리표시로 대체된다. */
    public ParseResult parse(byte[] zipBytes, String rceptNo, ReportType type, String dcmNo)
            throws IOException {
        String xml = extractMainXml(zipBytes, rceptNo);
        if (xml.length() > MAX_XML_CHARS) {
            throw new DocumentTooLargeException(
                    "본문 %,d자가 상한 %,d자를 초과".formatted(xml.length(), MAX_XML_CHARS));
        }
        return parseXml(xml, type, dcmNo);
    }

    /** ZIP에서 본문 XML을 꺼낸다. 본문 파일명은 {rcept_no}.xml (M0 실측). */
    public static String extractMainXml(byte[] zipBytes, String rceptNo) throws IOException {
        String preferred = rceptNo + ".xml";
        byte[] fallback = null;

        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry e;
            while ((e = zis.getNextEntry()) != null) {
                if (e.isDirectory()) continue;
                byte[] data = zis.readAllBytes();
                String name = e.getName();
                if (name.equalsIgnoreCase(preferred)) return decode(data);
                if (fallback == null && name.toLowerCase().endsWith(".xml")) fallback = data;
            }
        }
        if (fallback != null) {
            log.warn("본문 파일명이 {}가 아님 — 첫 XML로 대체 rcept_no={}", preferred, rceptNo);
            return decode(fallback);
        }
        throw new IOException("ZIP에 XML이 없음 rcept_no=" + rceptNo);
    }

    /** M0 실측상 UTF-8이지만, 선언이 다르면 그쪽을 따른다. */
    private static String decode(byte[] data) {
        String head = new String(data, 0, Math.min(data.length, 120), StandardCharsets.ISO_8859_1);
        if (head.toLowerCase().contains("euc-kr")) {
            return new String(data, java.nio.charset.Charset.forName("EUC-KR"));
        }
        return new String(data, StandardCharsets.UTF_8);
    }

    public ParseResult parseXml(String xml, ReportType type, String dcmNo) {
        ParseRules.RuleSet ruleSet = rules.forType(type);
        if (ruleSet == null) {
            return new ParseResult(List.of(), List.of("서식에 대한 룰 없음: " + type));
        }

        Document doc = Jsoup.parse(xml, "", Parser.xmlParser());
        Element scope = resolveScope(doc, ruleSet.scope());
        if (scope == null) {
            return new ParseResult(List.of(), List.of("스코프를 찾지 못함: " + ruleSet.scope()));
        }

        List<ExtractedSection> out = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (ParseRules.Section rule : ruleSet.sections()) {
            Optional<Element> found = findByAssocNote(scope, rule.id());
            if (found.isEmpty()) {
                warnings.add("섹션 미발견 id=%s (%s)".formatted(rule.id(), rule.expect()));
                continue;
            }
            Element section = found.get();
            String title = qualifiedTitle(section);
            if (rule.expect() != null && !normalize(title).contains(normalize(rule.expect()))) {
                warnings.add("제목 불일치 id=%s expect='%s' actual='%s'"
                        .formatted(rule.id(), rule.expect(), title));
            }

            List<Element> blocks = new ArrayList<>();
            collectBlocks(section, ownTitleOf(section), blocks);
            if (blocks.isEmpty()) {
                warnings.add("내용 없음 id=%s (%s)".formatted(rule.id(), title));
                continue;
            }

            int seq = seqBase(out, rule.sectionNo());
            for (Element block : blocks) {
                String tag = block.tagName().toUpperCase(Locale.ROOT);
                String html = switch (tag) {
                    case "TABLE" -> converter.toHtml(block);
                    case "IMAGE" -> converter.toImageHtml(block, dcmNo);
                    default -> converter.toTextHtml(block);
                };
                out.add(new ExtractedSection(
                        rule.sectionNo(), rule.id(), title, seq++, html,
                        tag.equals("TABLE") ? converter.toJson(block) : null,
                        tag.equals("TABLE") ? converter.toPlainText(List.of(block))
                                            : TableConverter.cellText(block)));
            }
        }
        return new ParseResult(out, warnings);
    }

    /** 같은 section_no 안에서 seq가 이어지도록 한다 (임원 3번의 가/나/다). */
    private static int seqBase(List<ExtractedSection> acc, String sectionNo) {
        return (int) acc.stream().filter(s -> s.sectionNo().equals(sectionNo)).count();
    }

    /**
     * PART1 스코프를 찾는다.
     * 약식에는 제1부 앞에 SECTION-1(AID=PART-CERT, "확인서")가 하나 더 있으므로
     * "첫 SECTION-1"으로 잡으면 안 된다. 제목으로 제1부를 특정한다.
     * 못 찾으면 문서 전체로 폴백한다 — AASSOCNOTE가 부 번호(D-1-*)를 이미 담고 있어 안전하다.
     */
    private static Element resolveScope(Document doc, ParseRules.Scope scope) {
        if (scope == ParseRules.Scope.DOCUMENT) return doc;

        for (Element s1 : doc.getElementsByTag("SECTION-1")) {
            Element title = s1.getElementsByTag("TITLE").first();
            if (title == null) continue;
            if (title.text().trim().startsWith("제1부")) return s1;
            if (title.attr("ENG").trim().startsWith("Part 1")) return s1;
        }
        log.warn("제1부 SECTION-1을 찾지 못해 문서 전체로 폴백");
        return doc;
    }

    /**
     * AASSOCNOTE로 섹션을 찾는다.
     * TITLE이 붙은 노드의 부모(SECTION-N)를 반환하되, 임원처럼 SECTION-3 단위인 경우도 처리된다.
     */
    private static Optional<Element> findByAssocNote(Element scope, String assocNote) {
        for (Element title : scope.getElementsByTag("TITLE")) {
            if (assocNote.equals(title.attr("AASSOCNOTE"))) {
                Element parent = title.parent();
                return Optional.ofNullable(parent != null ? parent : title);
            }
        }
        return Optional.empty();
    }

    /**
     * 섹션 안에서 보여줄 블록을 문서 순서대로 모은다 — 소제목(TITLE)·문단(P)·표(TABLE).
     *
     * 표만 뽑으면 정기공시에서 정보가 사라진다. 예를 들어 '대주주 등과의 거래내용'은
     * 표가 1개뿐이고 "가. 대주주등에 대한 신용공여 등 / 해당 사항 없습니다" 가 문단에 있다.
     * 소제목까지 살리는 이유는 '주주에 관한 사항'처럼 표가 14개인 섹션에서
     * 어느 표가 무엇인지 구분이 안 되기 때문이다.
     *
     * TABLE은 통째로 담고 안으로 내려가지 않는다(표 안의 문단은 셀 텍스트로 이미 처리된다).
     */
    private static void collectBlocks(Element node, Element ownTitle, List<Element> out) {
        for (Element child : node.children()) {
            switch (child.tagName().toUpperCase(Locale.ROOT)) {
                case "TABLE" -> out.add(child);
                case "P" -> { if (!child.text().isBlank()) out.add(child); }
                case "TITLE" -> { if (child != ownTitle && !child.text().isBlank()) out.add(child); }
                // 이미지 파일은 ZIP에 없어 뷰어 경로로 받아야 한다(§TableConverter.toImageHtml).
                // 버리면 원문에 그림이 있었다는 사실조차 남지 않는다.
                case "IMAGE" -> out.add(child);
                default -> collectBlocks(child, ownTitle, out);
            }
        }
    }

    /**
     * 화면에 보일 제목. 절(節)이면 상위 장(章) 제목을 앞에 붙인다.
     *
     * "4. 주식의 총수 등" 만 보여주면 어느 장에 속한 절인지 알 수 없어
     * 다른 대제목들과 같은 층위처럼 읽힌다. 원문 목차에서는 "I. 회사의 개요" 아래에 있다.
     * 상위 장은 문서 구조(SECTION-1)에서 찾으므로 룰에 따로 적지 않아도 된다.
     */
    private static String qualifiedTitle(Element section) {
        String own = titleOf(section);
        Element chapter = section.closest("SECTION-1");
        if (chapter == null || chapter == section) return own;
        String parent = titleOf(chapter);
        return parent.isBlank() || parent.equals(own) ? own : parent + " › " + own;
    }

    /** 섹션 자신의 제목 엘리먼트. 블록 목록에서 제외하려면 동일성 비교가 필요하다. */
    private static Element ownTitleOf(Element section) {
        return section.getElementsByTag("TITLE").first();
    }

    private static String titleOf(Element section) {
        Element t = section.getElementsByTag("TITLE").first();
        return t == null ? "" : t.text().trim();
    }

    private static String normalize(String s) {
        return s == null ? "" : s.replaceAll("[\\s\\u00B7\\uABFFㆍ.]", "");
    }
}
