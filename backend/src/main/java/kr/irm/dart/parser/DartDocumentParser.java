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

    private final ParseRules rules;
    private final TableConverter converter;

    public DartDocumentParser(ParseRules rules, TableConverter converter) {
        this.rules = rules;
        this.converter = converter;
    }

    public ParseResult parse(byte[] zipBytes, String rceptNo, ReportType type) throws IOException {
        String xml = extractMainXml(zipBytes, rceptNo);
        return parseXml(xml, type);
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

    public ParseResult parseXml(String xml, ReportType type) {
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
            String title = titleOf(section);
            if (rule.expect() != null && !normalize(title).contains(normalize(rule.expect()))) {
                warnings.add("제목 불일치 id=%s expect='%s' actual='%s'"
                        .formatted(rule.id(), rule.expect(), title));
            }

            List<Element> tables = section.getElementsByTag("TABLE");
            if (tables.isEmpty()) {
                warnings.add("표 없음 id=%s (%s)".formatted(rule.id(), title));
                continue;
            }
            int seq = seqBase(out, rule.sectionNo());
            for (Element table : tables) {
                out.add(new ExtractedSection(
                        rule.sectionNo(), rule.id(), title, seq++,
                        converter.toHtml(table),
                        converter.toJson(table),
                        converter.toPlainText(List.of(table))));
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

    private static String titleOf(Element section) {
        Element t = section.getElementsByTag("TITLE").first();
        return t == null ? "" : t.text().trim();
    }

    private static String normalize(String s) {
        return s == null ? "" : s.replaceAll("[\\s\\u00B7\\uABFFㆍ.]", "");
    }
}
