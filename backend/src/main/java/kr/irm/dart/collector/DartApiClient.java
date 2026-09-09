package kr.irm.dart.collector;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import kr.irm.dart.config.DartProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
public class DartApiClient {

    private static final Logger log = LoggerFactory.getLogger(DartApiClient.class);
    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final byte[] ZIP_MAGIC = {0x50, 0x4B, 0x03, 0x04};

    private final RestClient http;
    private final DartProperties props;

    public DartApiClient(RestClient dartRestClient, DartProperties props) {
        this.props = props;
        this.http = dartRestClient;
    }

    /** 공시검색. status=013(데이터 없음)은 빈 목록으로 정상 처리한다. */
    public List<ListItem> searchDisclosures(LocalDate from, LocalDate to, String detailTy, int page) {
        ListResponse res = http.get()
                .uri(b -> b.path("/list.json")
                        .queryParam("crtfc_key", props.apiKey())
                        .queryParam("bgn_de", from.format(YMD))
                        .queryParam("end_de", to.format(YMD))
                        .queryParam("pblntf_detail_ty", detailTy)
                        .queryParam("page_no", page)
                        .queryParam("page_count", 100)
                        .queryParam("sort", "date")
                        .queryParam("sort_mth", "desc")
                        .build())
                .retrieve()
                .body(ListResponse.class);

        if (res == null) throw new DartApiException(null, "빈 응답");
        if ("013".equals(res.status())) return List.of();
        if (!"000".equals(res.status())) {
            throw new DartApiException(res.status(), "list.json status=%s %s".formatted(res.status(), res.message()));
        }
        return res.list() == null ? List.of() : res.list();
    }

    /**
     * 공시서류원본파일(ZIP).
     * 응답 Content-Type이 application/x-msdownload로 오므로 MIME으로 판단하지 않고
     * 매직넘버로 ZIP 여부를 검증한다. (M0 실측)
     */
    public byte[] downloadDocument(String rceptNo) {
        byte[] body = http.get()
                .uri(b -> b.path("/document.xml")
                        .queryParam("crtfc_key", props.apiKey())
                        .queryParam("rcept_no", rceptNo)
                        .build())
                .retrieve()
                .body(byte[].class);

        if (body == null || body.length == 0) {
            throw new DartApiException(null, "document.xml 빈 응답 rcept_no=" + rceptNo);
        }
        if (!isZip(body)) {
            // 오류 시 XML 본문으로 status가 내려온다
            String head = new String(body, 0, Math.min(body.length, 400), java.nio.charset.StandardCharsets.UTF_8);
            String status = extract(head, "<status>", "</status>");
            log.warn("document.xml이 ZIP이 아님 rcept_no={} head={}", rceptNo, head.replaceAll("\\s+", " "));
            throw new DartApiException(status, "ZIP 아님 rcept_no=%s status=%s".formatted(rceptNo, status));
        }
        return body;
    }

    private static boolean isZip(byte[] b) {
        if (b.length < 4) return false;
        for (int i = 0; i < 4; i++) if (b[i] != ZIP_MAGIC[i]) return false;
        return true;
    }

    private static String extract(String s, String open, String close) {
        int a = s.indexOf(open);
        if (a < 0) return null;
        int c = s.indexOf(close, a);
        return c < 0 ? null : s.substring(a + open.length(), c).trim();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ListResponse(String status, String message,
                               @JsonProperty("total_count") Integer totalCount,
                               @JsonProperty("total_page") Integer totalPage,
                               List<ListItem> list) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ListItem(
            @JsonProperty("rcept_no")   String rceptNo,
            @JsonProperty("corp_code")  String corpCode,
            @JsonProperty("corp_name")  String corpName,
            @JsonProperty("stock_code") String stockCode,
            @JsonProperty("corp_cls")   String corpCls,
            @JsonProperty("report_nm")  String reportNm,
            @JsonProperty("flr_nm")     String flrNm,
            @JsonProperty("rcept_dt")   String rceptDt) {

        public LocalDate rceptDate() { return LocalDate.parse(rceptDt, YMD); }
    }
}
