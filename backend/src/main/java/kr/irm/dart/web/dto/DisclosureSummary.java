package kr.irm.dart.web.dto;

import kr.irm.dart.domain.Disclosure;
import kr.irm.dart.domain.ParseStatus;
import kr.irm.dart.domain.ReportType;

import java.time.LocalDate;

public record DisclosureSummary(
        String rceptNo, String corpCode, String corpName, String stockCode,
        String reportNm, ReportType reportType, boolean correction,
        String flrNm, LocalDate rceptDt, ParseStatus parseStatus, String dartUrl,
        boolean bookmarked) {

    public static DisclosureSummary from(Disclosure d) {
        return from(d, false);
    }

    public static DisclosureSummary from(Disclosure d, boolean bookmarked) {
        return new DisclosureSummary(
                d.getRceptNo(), d.getCorpCode(), d.getCorpName(), d.getStockCode(),
                d.getReportNm(), d.getReportType(), d.isCorrection(),
                d.getFlrNm(), d.getRceptDt(), d.getParseStatus(),
                "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + d.getRceptNo(),
                bookmarked);
    }
}
