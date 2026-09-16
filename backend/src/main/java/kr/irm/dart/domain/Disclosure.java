package kr.irm.dart.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "disclosure")
public class Disclosure {

    @Id
    @Column(name = "rcept_no", length = 14, nullable = false, updatable = false)
    private String rceptNo;

    @Column(name = "corp_code", length = 8, nullable = false)
    private String corpCode;

    @Column(name = "corp_name", nullable = false)
    private String corpName;

    @Column(name = "stock_code", length = 6)
    private String stockCode;

    @Column(name = "corp_cls", length = 1)
    private String corpCls;

    @Column(name = "report_nm", nullable = false)
    private String reportNm;

    @Enumerated(EnumType.STRING)
    @Column(name = "report_type", length = 32, nullable = false)
    private ReportType reportType;

    @Column(name = "is_correction", nullable = false)
    private boolean correction;

    @Column(name = "flr_nm")
    private String flrNm;

    @Column(name = "rcept_dt", nullable = false)
    private LocalDate rceptDt;

    @Enumerated(EnumType.STRING)
    @Column(name = "parse_status", length = 24, nullable = false)
    private ParseStatus parseStatus = ParseStatus.PENDING;

    @Column(name = "parse_error")
    private String parseError;

    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    @Column(name = "next_retry_at")
    private Instant nextRetryAt;

    @Column(name = "raw_file_path")
    private String rawFilePath;

    /** DART 뷰어 문서번호. 본문 이미지 주소를 만드는 데 쓴다. 못 얻으면 null. */
    @Column(name = "dcm_no", length = 16)
    private String dcmNo;

    @Column(name = "discovered_at", nullable = false, updatable = false)
    private Instant discoveredAt = Instant.now();

    @Column(name = "fetched_at")
    private Instant fetchedAt;

    @Column(name = "parsed_at")
    private Instant parsedAt;

    /** 관리자가 내린 공시. 행은 남겨 둔다 — 지우면 폴러가 되살리고 의견까지 사라진다(§V7). */
    @Column(name = "hidden_at")
    private Instant hiddenAt;

    protected Disclosure() {}

    public Disclosure(String rceptNo, String corpCode, String corpName, String stockCode,
                      String corpCls, String reportNm, String flrNm, LocalDate rceptDt) {
        this.rceptNo = rceptNo;
        this.corpCode = corpCode;
        this.corpName = corpName;
        this.stockCode = blankToNull(stockCode);
        this.corpCls = blankToNull(corpCls);
        this.reportNm = reportNm;
        this.reportType = ReportType.from(reportNm);
        this.correction = reportNm != null && reportNm.startsWith("[");
        this.flrNm = flrNm;
        this.rceptDt = rceptDt;
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    public void markFetching() {
        this.parseStatus = ParseStatus.FETCHING;
    }

    public void markFetched(String path) {
        this.parseStatus = ParseStatus.FETCHED;
        this.rawFilePath = path;
        this.fetchedAt = Instant.now();
        this.parseError = null;
        this.nextRetryAt = null;
    }

    /** 실패를 기록하고 다음 재시도 시각을 잡는다. 한도 초과 시 FAILED로 고정. */
    public void markRetryable(String error, int maxRetry, java.time.Duration interval) {
        this.retryCount++;
        this.parseError = truncate(error);
        if (this.retryCount >= maxRetry) {
            this.parseStatus = ParseStatus.FAILED;
            this.nextRetryAt = null;
        } else {
            this.parseStatus = ParseStatus.PENDING;
            this.nextRetryAt = Instant.now().plus(interval);
        }
    }

    public void markParsed(boolean withWarn, String warning) {
        this.parseStatus = withWarn ? ParseStatus.PARSED_WITH_WARN : ParseStatus.PARSED;
        this.parseError = truncate(warning);
        this.parsedAt = Instant.now();
    }

    /** 파싱을 시도하지 않고 건너뛴다. 실패와 구분해야 재시도 대상에 들어가지 않는다. */
    public void markSkipped(String reason) {
        this.parseStatus = ParseStatus.SKIPPED;
        this.parseError = truncate(reason);
        this.parsedAt = Instant.now();
    }

    public void markParseFailed(String error) {
        this.parseStatus = ParseStatus.FAILED;
        this.parseError = truncate(error);
        this.parsedAt = Instant.now();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= 1000 ? s : s.substring(0, 1000);
    }

    public boolean isHidden() { return hiddenAt != null; }
    public Instant getHiddenAt() { return hiddenAt; }
    public void setHidden(boolean hidden) { this.hiddenAt = hidden ? Instant.now() : null; }

    public String getRceptNo() { return rceptNo; }
    public String getCorpCode() { return corpCode; }
    public String getCorpName() { return corpName; }
    public String getReportNm() { return reportNm; }
    public ReportType getReportType() { return reportType; }
    public boolean isCorrection() { return correction; }
    public String getFlrNm() { return flrNm; }
    public LocalDate getRceptDt() { return rceptDt; }
    public ParseStatus getParseStatus() { return parseStatus; }
    public int getRetryCount() { return retryCount; }
    public String getRawFilePath() { return rawFilePath; }
    public String getStockCode() { return stockCode; }
    public String getDcmNo() { return dcmNo; }
    public void setDcmNo(String dcmNo) { this.dcmNo = dcmNo; }
    public String getCorpCls() { return corpCls; }
    public String getParseError() { return parseError; }
    public java.time.Instant getParsedAt() { return parsedAt; }
}
