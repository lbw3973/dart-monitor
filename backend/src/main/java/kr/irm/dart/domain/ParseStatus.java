package kr.irm.dart.domain;

public enum ParseStatus {
    PENDING,
    FETCHING,
    FETCHED,
    PARSED,
    PARSED_WITH_WARN,
    FAILED,
    SKIPPED
}
