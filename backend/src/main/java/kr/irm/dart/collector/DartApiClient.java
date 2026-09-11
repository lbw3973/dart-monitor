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
import java.util.function.Consumer;

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

    /**
     * 지정 구간을 페이지 단위로 훑으며 각 페이지를 handler에 넘긴다.
     *
     * 종료 판단이 미묘해 호출부(폴러·백필)마다 복제하지 않도록 여기 모은다.
     * 우선 total_page를 쓰고, 그 값이 없을 때를 대비해 내용 기반 검사를 함께 둔다.
     */
    public Scan eachPage(LocalDate from, LocalDate to, String detailTy, int maxPages,
                         Consumer<List<ListItem>> handler) {
        String prevFirst = null;
        int pages = 0, items = 0;
        boolean capped = false;

        for (int page = 1; page <= maxPages; page++) {
            Page res = searchDisclosures(from, to, detailTy, page);
            if (res.items().isEmpty()) break;                  // status=013 포함

            // 범위 밖 page_no를 주면 DART는 에러 대신 마지막 페이지를 그대로 돌려준다(실측).
            // 그래서 첫 접수번호가 직전 페이지와 같으면 끝에 도달한 것이다.
            // total_page가 사라져도(응답 구조 변경 등) 이 검사만으로 정상 종료된다.
            String first = res.items().get(0).rceptNo();
            if (first.equals(prevFirst)) break;
            prevFirst = first;

            pages++;
            items += res.items().size();
            handler.accept(res.items());

            if (res.totalPage() > 0 && page >= res.totalPage()) break;
            if (page == maxPages) capped = true;
        }
        return new Scan(pages, items, capped);
    }

    /** capped=true면 상한에 막혀 뒤쪽을 못 읽었다는 뜻이다. 조용히 넘기지 말 것. */
    public record Scan(int pages, int items, boolean capped) {}

    /** 한 페이지 조회 결과. 호출부가 null을 다루지 않도록 여기서 정규화한다. */
    public record Page(List<ListItem> items, int totalPage) {
        static final Page EMPTY = new Page(List.of(), 0);
    }

    /** 공시검색. status=013(데이터 없음)은 빈 페이지로 정상 처리한다. */
    public Page searchDisclosures(LocalDate from, LocalDate to, String detailTy, int page) {
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
        if ("013".equals(res.status())) return Page.EMPTY;
        if (!"000".equals(res.status())) {
            throw new DartApiException(res.status(), "list.json status=%s %s".formatted(res.status(), res.message()));
        }

        List<ListItem> items = res.list() == null ? List.of() : res.list();
        Integer totalPage = res.totalPage();
        if (totalPage == null || totalPage < 1) {
            // status=000이면 항상 오는 값이다. 없다면 응답 구조가 바뀐 것이니 흔적을 남긴다.
            // 종료 판단은 eachPage의 '같은 페이지 반복' 검사가 대신 맡으므로 수집은 계속된다.
            log.warn("total_page 없음 detailTy={} page={} — 내용 기반 검사로 종료 판단", detailTy, page);
            return new Page(items, 0);
        }
        return new Page(items, totalPage);
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
