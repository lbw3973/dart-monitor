package kr.irm.dart.parser;

/**
 * 본문이 상한을 넘어 파싱을 건너뛴다.
 *
 * 크기 상한을 두는 이유는 메모리 부족이 Exception이 아니라 Error라서다 —
 * ParseService의 catch(Exception)에 걸리지 않아 한 문서가 JVM 전체를 불안정하게 만든다.
 * 미리 막아 SKIPPED로 남기고 화면에서 DART 원문으로 안내한다.
 */
public class DocumentTooLargeException extends RuntimeException {
    public DocumentTooLargeException(String message) {
        super(message);
    }
}
