package kr.irm.dart.collector;

public class DartApiException extends RuntimeException {
    private final String status;

    public DartApiException(String status, String message) {
        super(message);
        this.status = status;
    }

    public String getStatus() { return status; }

    /** 쿼터 초과/키 오류처럼 재시도가 무의미한 상태인지. */
    public boolean isFatal() {
        return "020".equals(status) || "021".equals(status)
            || "010".equals(status) || "011".equals(status) || "012".equals(status);
    }
}
