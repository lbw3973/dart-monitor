package kr.irm.dart.service;

import kr.irm.dart.collector.DartApiClient;
import kr.irm.dart.collector.DocumentFetcher;
import kr.irm.dart.config.DartProperties;
import kr.irm.dart.domain.Disclosure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * 과거 구간 소급 수집.
 *
 * 평상시 폴러는 최근 2일만 본다(쿼터 절약). 그래서 하루를 넘겨 중단되면 그 사이가 빈다.
 * 이 서비스가 그 공백을 메운다 — 기동 시 자동, 또는 관리자 API로 수동.
 */
@Service
public class BackfillService {

    private static final Logger log = LoggerFactory.getLogger(BackfillService.class);
    private static final int MAX_PAGES_PER_DAY = 20;   // 하루 2,000건 상한

    private final DartApiClient client;
    private final IngestService ingest;
    private final DocumentFetcher fetcher;
    private final DartProperties props;

    public BackfillService(DartApiClient client, IngestService ingest,
                           DocumentFetcher fetcher, DartProperties props) {
        this.client = client;
        this.ingest = ingest;
        this.fetcher = fetcher;
        this.props = props;
    }

    /**
     * 지정 구간을 하루 단위로 훑는다.
     * 하루씩 끊는 이유: 구간이 길면 한 번에 수천 건이라 페이지 상한에 걸려 조용히 누락된다.
     */
    public Result run(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) throw new IllegalArgumentException("from이 to보다 늦습니다");
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        log.info("백필 시작 {} ~ {} ({}일)", from, to, days);

        int fetched = 0, inserted = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            for (String detailTy : props.detailTypes()) {
                for (int page = 1; page <= MAX_PAGES_PER_DAY; page++) {
                    List<DartApiClient.ListItem> items;
                    try {
                        items = client.searchDisclosures(d, d, detailTy, page);
                    } catch (Exception e) {
                        log.error("백필 조회 실패 {} {} page={} — 건너뜀", d, detailTy, page, e);
                        break;
                    }
                    if (items.isEmpty()) break;
                    fetched += items.size();

                    List<Disclosure> saved = new ArrayList<>(ingest.saveNew(items));
                    inserted += saved.size();
                    saved.forEach(fetcher::submit);      // 원본 다운로드는 비동기 큐로

                    if (items.size() < 100) break;
                }
            }
        }
        log.info("백필 완료 {} ~ {} — 조회 {}건, 신규 {}건", from, to, fetched, inserted);
        return new Result(from, to, fetched, inserted);
    }

    public record Result(LocalDate from, LocalDate to, int fetched, int inserted) {}
}
