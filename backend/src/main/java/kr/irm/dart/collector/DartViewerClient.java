package kr.irm.dart.collector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * DART 뷰어(dart.fss.or.kr)에서 문서번호를 얻는다.
 *
 * ⚠️ OpenDART 공식 API가 아니라 웹 페이지 스크래핑이다. 페이지 구조가 바뀌면 조용히 실패한다.
 * 그래서 실패를 정상 흐름으로 다룬다 — 못 얻으면 이미지를 자리표시로 대체할 뿐 파싱은 계속된다.
 *
 * 이 경로를 쓰는 이유는 이미지 때문이다. 원본 ZIP에는 이미지 파일이 없고(실측 5건 모두)
 * XML에는 파일명만 들어 있어서, 뷰어의 download.do 말고는 받을 방법이 없다.
 */
@Component
public class DartViewerClient {

    private static final Logger log = LoggerFactory.getLogger(DartViewerClient.class);

    /** viewDoc("{접수번호}", "{문서번호}", ...) — 실측상 페이지당 한 번만 등장한다. */
    private static final Pattern VIEW_DOC =
            Pattern.compile("viewDoc\\(\\s*\"(\\d+)\"\\s*,\\s*\"(\\d+)\"");

    static final String BASE = "https://dart.fss.or.kr";

    private final RestClient http;

    public DartViewerClient() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.http = RestClient.builder()
                .baseUrl(BASE)
                // 기본 UA로는 응답이 달라질 수 있어 브라우저를 표방한다
                .defaultHeader("User-Agent", "Mozilla/5.0 (compatible; dart-monitor/1.0)")
                .requestFactory(factory)
                .build();
    }

    /** 문서번호. 얻지 못하면 비어 있는 값을 돌려준다 — 호출부는 이를 정상으로 다뤄야 한다. */
    public Optional<String> findDcmNo(String rceptNo) {
        try {
            String html = http.get()
                    .uri(b -> b.path("/dsaf001/main.do").queryParam("rcpNo", rceptNo).build())
                    .retrieve()
                    .body(String.class);
            if (html == null) return Optional.empty();

            Matcher m = VIEW_DOC.matcher(html);
            if (!m.find()) {
                log.warn("뷰어에서 dcmNo를 찾지 못함 rcept_no={} — 이미지는 자리표시로 대체된다", rceptNo);
                return Optional.empty();
            }
            return Optional.of(m.group(2));
        } catch (Exception e) {
            log.warn("뷰어 조회 실패 rcept_no={} {}", rceptNo, e.toString());
            return Optional.empty();
        }
    }
}
