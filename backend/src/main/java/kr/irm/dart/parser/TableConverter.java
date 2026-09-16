package kr.irm.dart.parser;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * DART 고유 XML 표를 표준 HTML로 변환한다. (M0-FINDINGS 발견 11)
 *   TD(고정라벨) / TE(텍스트 데이터) / TU(코드값) → td,  TH → th
 *   ACODE·AUNIT → data-code, AUNITVALUE → data-value 로 보존
 * 화이트리스트로만 구성하므로 임의 HTML이 흘러들 여지가 없다.
 */
@Component
public class TableConverter {

    private static final Set<String> CELL_TAGS = Set.of("td", "te", "tu", "th");
    private static final Set<String> STRUCT_TAGS =
            Set.of("table", "thead", "tbody", "tfoot", "tr", "colgroup", "col");
    private static final Set<String> KEEP_ATTRS =
            Set.of("rowspan", "colspan", "align", "valign", "width");
    /** 이 길이를 넘는 셀만 줄바꿈을 허용한다 (숫자·날짜·짧은 라벨은 nowrap) */
    private static final int WRAP_THRESHOLD = 24;

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * 표 밖 텍스트 블록(소제목·문단)을 최소 태그로 내보낸다.
     *
     * 정기공시는 표 사이에 소제목과 문단이 섞이고 그 문단이 정보를 담는다
     * ("해당 사항 없습니다", "나. 발행할 주식의총수 : 100,000,000주").
     * 표만 뽑으면 섹션이 비어 보이거나 값이 사라진다.
     *
     * 표와 마찬가지로 화이트리스트다 — 원문 태그를 옮기지 않고 텍스트만 꺼내 감싼다.
     */
    public String toTextHtml(Element el) {
        String tag = el.tagName().equalsIgnoreCase("TITLE") ? "h4" : "p";
        return "<%s>%s</%s>".formatted(tag, escapeText(cellText(el)), tag);
    }

    /**
     * 본문 이미지. 파일은 원본 ZIP에 없고 뷰어 경로로만 받을 수 있다.
     *
     * dcmNo를 얻지 못했으면(비공식 경로라 실패할 수 있다) 자리표시만 남긴다 —
     * 그림이 있었다는 사실은 알려야 사용자가 DART 원문을 확인할 수 있다.
     */
    public String toImageHtml(Element image, String dcmNo) {
        Element img = image.getElementsByTag("IMG").first();
        Element cap = image.getElementsByTag("IMG-CAPTION").first();
        String file = img == null ? "" : cellText(img);
        String caption = cap == null ? "" : cellText(cap);
        String alt = caption.isBlank() ? file : caption;

        if (dcmNo == null || dcmNo.isBlank() || file.isBlank()) {
            return "<p class=\"dart-image-missing\">[이미지] %s</p>".formatted(escapeText(alt));
        }
        String src = "https://dart.fss.or.kr/report/download.do?dcmNo=%s&flNm=%s"
                .formatted(urlEncode(dcmNo), urlEncode(file));
        return "<figure><img src=\"%s\" alt=\"%s\" loading=\"lazy\"/>%s</figure>".formatted(
                escapeAttr(src), escapeAttr(alt),
                caption.isBlank() ? "" : "<figcaption>" + escapeText(caption) + "</figcaption>");
    }

    private static String urlEncode(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }

    public String toHtml(Element table) {
        StringBuilder sb = new StringBuilder();
        writeElement(table, sb, semanticClass(table));
        return sb.toString();
    }

    /**
     * 표의 의미 분류는 TABLE이 아니라 부모 TABLE-GROUP의 ACLASS에 있다.
     * (TABLE 자신의 ACLASS는 대부분 "EXTRACTION"으로 의미가 없다)
     */
    private static String semanticClass(Element table) {
        Element parent = table.parent();
        if (parent != null && parent.tagName().equalsIgnoreCase("TABLE-GROUP")) {
            String c = parent.attr("ACLASS");
            if (!c.isBlank()) return c;
        }
        String own = table.attr("ACLASS");
        return "EXTRACTION".equals(own) ? null : own;
    }

    private void writeElement(Element el, StringBuilder sb, String rootAclass) {
        String tag = el.tagName().toLowerCase(Locale.ROOT);

        // TABLE-GROUP은 의미 분류만 갖는 래퍼 → 언랩
        if (tag.equals("table-group")) {
            el.children().forEach(c -> writeElement(c, sb, rootAclass));
            return;
        }

        String outTag = CELL_TAGS.contains(tag) ? (tag.equals("th") ? "th" : "td") : tag;
        if (!STRUCT_TAGS.contains(outTag) && !outTag.equals("td") && !outTag.equals("th")) {
            // 표 밖 요소(P, TITLE 등)는 표 HTML에 넣지 않는다
            return;
        }

        sb.append('<').append(outTag);
        for (var attr : el.attributes()) {
            String k = attr.getKey().toLowerCase(Locale.ROOT);
            if (KEEP_ATTRS.contains(k) && !attr.getValue().isBlank()) {
                sb.append(' ').append(k).append("=\"").append(escapeAttr(attr.getValue())).append('"');
            }
        }
        if (outTag.equals("table") && rootAclass != null && !rootAclass.isBlank()) {
            sb.append(" data-aclass=\"").append(escapeAttr(rootAclass)).append('"');
        }
        String code = firstNonBlank(el.attr("ACODE"), el.attr("AUNIT"));
        if (code != null) sb.append(" data-code=\"").append(escapeAttr(code)).append('"');
        String value = el.attr("AUNITVALUE");
        if (!value.isBlank()) sb.append(" data-value=\"").append(escapeAttr(value)).append('"');
        // 숫자·날짜 같은 짧은 셀은 줄바꿈하면 읽기 어렵다(특히 모바일).
        // 기본을 nowrap으로 두고, 긴 문장 셀에만 줄바꿈을 허용하는 표시를 남긴다.
        if ((outTag.equals("td") || outTag.equals("th")) && needsWrap(cellText(el))) {
            sb.append(" data-wrap=\"1\"");
        }
        sb.append('>');

        if (outTag.equals("col")) {                     // void element
            sb.setLength(sb.length() - 1);
            sb.append("/>");
            return;
        }

        if (outTag.equals("td") || outTag.equals("th")) {
            sb.append(escapeText(cellText(el)));
        } else {
            el.children().forEach(c -> writeElement(c, sb, rootAclass));
        }
        sb.append("</").append(outTag).append('>');
    }

    /** 긴 문장만 줄바꿈을 허용한다. 숫자·비율·날짜는 통째로 유지한다. */
    static boolean needsWrap(String text) {
        return text.contains("\n") || text.codePointCount(0, text.length()) > WRAP_THRESHOLD;
    }

    /** 셀 텍스트. <BR>은 줄바꿈으로 살린다. */
    static String cellText(Element cell) {
        StringBuilder sb = new StringBuilder();
        collectText(cell, sb);
        return sb.toString().replaceAll("[ \\t]+", " ").trim();
    }

    private static void collectText(Node node, StringBuilder sb) {
        for (Node child : node.childNodes()) {
            if (child instanceof TextNode t) {
                sb.append(t.getWholeText());
            } else if (child instanceof Element e) {
                if (e.tagName().equalsIgnoreCase("br")) sb.append('\n');
                else collectText(e, sb);
            }
        }
    }

    /** 셀 매트릭스 JSON. rowspan/colspan과 필드코드를 함께 보존한다. */
    public String toJson(Element table) {
        ObjectNode root = mapper.createObjectNode();
        ArrayNode rows = root.putArray("rows");

        for (Element tr : table.getElementsByTag("TR")) {
            ArrayNode row = rows.addArray();
            for (Element cell : tr.children()) {
                String tag = cell.tagName().toLowerCase(Locale.ROOT);
                if (!CELL_TAGS.contains(tag)) continue;

                ObjectNode c = row.addObject();
                c.put("t", cellText(cell));
                int rs = intAttr(cell, "ROWSPAN");
                int cs = intAttr(cell, "COLSPAN");
                if (rs > 1) c.put("rs", rs);
                if (cs > 1) c.put("cs", cs);
                if (tag.equals("th")) c.put("h", true);

                String code = firstNonBlank(cell.attr("ACODE"), cell.attr("AUNIT"));
                if (code != null) c.put("code", code);
                String v = cell.attr("AUNITVALUE");
                if (!v.isBlank()) c.put("v", v);
            }
        }
        return mapper.writeValueAsString(root);   // Jackson 3은 예외가 unchecked
    }

    public String toPlainText(List<Element> tables) {
        StringBuilder sb = new StringBuilder();
        for (Element t : tables) {
            for (Element tr : t.getElementsByTag("TR")) {
                String line = tr.children().stream()
                        .filter(c -> CELL_TAGS.contains(c.tagName().toLowerCase(Locale.ROOT)))
                        .map(TableConverter::cellText)
                        .filter(s -> !s.isBlank())
                        .reduce((a, b) -> a + "\t" + b).orElse("");
                if (!line.isBlank()) sb.append(line).append('\n');
            }
        }
        return sb.toString().trim();
    }

    private static int intAttr(Element el, String name) {
        String v = el.attr(name);
        if (v.isBlank()) return 1;
        try { return Integer.parseInt(v.trim()); } catch (NumberFormatException e) { return 1; }
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }

    private static String escapeAttr(String s) {
        return s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeText(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
