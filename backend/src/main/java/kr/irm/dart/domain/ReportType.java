package kr.irm.dart.domain;

public enum ReportType {
    /* 지분공시 (D001·D002) */
    MAJOR_HOLDING_SIMPLE,
    MAJOR_HOLDING_GENERAL,
    EXEC_OWNERSHIP,
    /* 정기공시 (A001·A002·A003) — 목차 ID는 셋이 동일하다 (M8 발견 1) */
    BUSINESS_REPORT,
    HALF_YEAR_REPORT,
    QUARTER_REPORT,
    OTHER;

    /**
     * 공시검색 API의 report_nm 문자열로 서식을 판별한다.
     * [기재정정]·[첨부추가] 같은 접두가 붙어도 동작한다 (부분 문자열로 판정).
     */
    public static ReportType from(String reportNm) {
        if (reportNm == null) return OTHER;
        if (reportNm.contains("대량보유")) {
            if (reportNm.contains("약식")) return MAJOR_HOLDING_SIMPLE;
            if (reportNm.contains("일반")) return MAJOR_HOLDING_GENERAL;
            return OTHER;
        }
        if (reportNm.contains("특정증권")) return EXEC_OWNERSHIP;
        if (reportNm.contains("사업보고서")) return BUSINESS_REPORT;
        if (reportNm.contains("반기보고서")) return HALF_YEAR_REPORT;
        if (reportNm.contains("분기보고서")) return QUARTER_REPORT;
        return OTHER;
    }

    public boolean isTarget() {
        return this != OTHER;
    }
}
