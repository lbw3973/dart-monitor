package kr.irm.dart.web.dto;

import kr.irm.dart.domain.Disclosure;
import kr.irm.dart.domain.ParseStatus;
import kr.irm.dart.domain.ReportType;

import java.time.LocalDate;

public record DisclosureSummary(
        String rceptNo, String corpCode, String corpName, String stockCode,
        /** Y=유가(코스피), K=코스닥, N=코넥스, E=기타 */
        String corpCls,
        String reportNm, ReportType reportType, boolean correction,
        String flrNm, LocalDate rceptDt, ParseStatus parseStatus, String dartUrl,
        boolean bookmarked,
        /** 답글까지 포함한 의견 수. 저장 수는 공개하지 않는다 — 스크랩은 개인 기능이다. */
        int commentCount) {

    public static DisclosureSummary from(Disclosure d) {
        return from(d, false, 0);
    }

    /** 아직 의견을 셀 수 없는 자리(SSE 로 막 들어온 공시 등)는 0으로 둔다 */
    public static DisclosureSummary from(Disclosure d, boolean bookmarked) {
        return from(d, bookmarked, 0);
    }

    public static DisclosureSummary from(Disclosure d, boolean bookmarked, int commentCount) {
        return new DisclosureSummary(
                d.getRceptNo(), d.getCorpCode(), d.getCorpName(), d.getStockCode(),
                d.getCorpCls(),
                d.getReportNm(), d.getReportType(), d.isCorrection(),
                d.getFlrNm(), d.getRceptDt(), d.getParseStatus(),
                "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + d.getRceptNo(),
                bookmarked, commentCount);
    }
}
