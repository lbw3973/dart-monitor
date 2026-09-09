package kr.irm.dart.domain;

public enum ReportType {
    MAJOR_HOLDING_SIMPLE,
    MAJOR_HOLDING_GENERAL,
    EXEC_OWNERSHIP,
    OTHER;

    /** 공시검색 API의 report_nm 문자열로 서식을 판별한다. [기재정정] 접두가 붙어도 동작한다. */
    public static ReportType from(String reportNm) {
        if (reportNm == null) return OTHER;
        if (reportNm.contains("대량보유")) {
            if (reportNm.contains("약식")) return MAJOR_HOLDING_SIMPLE;
            if (reportNm.contains("일반")) return MAJOR_HOLDING_GENERAL;
            return OTHER;
        }
        if (reportNm.contains("특정증권")) return EXEC_OWNERSHIP;
        return OTHER;
    }

    public boolean isTarget() {
        return this != OTHER;
    }
}
