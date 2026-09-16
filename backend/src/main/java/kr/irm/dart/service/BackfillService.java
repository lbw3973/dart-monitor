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
 * 평상시 폴러는 접수 시간대(평일 07:00~19:30)에만, 그날 하루만 본다.
 * 그래서 하루를 넘겨 중단되면 그 사이가 빈다.
 * 이 서비스가 그 공백을 메운다 — 기동 시 자동, 또는 관리자 API로 수동.
 */
@Service
public class BackfillService {

    private static final Logger log = LoggerFactory.getLogger(BackfillService.class);
    private static final int MAX_PAGES_PER_DAY = 50;   // 폭주 방지 안전망 (하루 5,000건)

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
     * 하루씩 끊는 이유: 공시검색 API가 corp_code 없이는 3개월까지만 조회를 허용하고,
     * 구간이 길수록 한 번에 수천 건이라 페이지 상한에 가까워진다.
     */
    public Result run(LocalDate from, LocalDate to) {
        return run(from, to, null);
    }

    /**
     * @param detailTypes 수집할 공시상세유형. 비어 있으면 설정된 전체를 돈다.
     *                    섹션 규칙을 바꾼 뒤 특정 서식만 다시 받을 때 쓴다 —
     *                    전체를 돌면 규칙이 바뀌지 않은 서식까지 원본을 다시 내려받는다.
     */
    public Result run(LocalDate from, LocalDate to, List<String> detailTypes) {
        if (from.isAfter(to)) throw new IllegalArgumentException("from이 to보다 늦습니다");

        List<String> targets = (detailTypes == null || detailTypes.isEmpty())
                ? props.detailTypes()
                : detailTypes.stream().filter(props.detailTypes()::contains).toList();
        if (targets.isEmpty()) {
            throw new IllegalArgumentException(
                    "수집 대상 서식이 없습니다. 설정된 값: " + props.detailTypes());
        }

        long days = ChronoUnit.DAYS.between(from, to) + 1;
        log.info("백필 시작 {} ~ {} ({}일) 서식={}", from, to, days, targets);

        int fetched = 0, inserted = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            for (String detailTy : targets) {
                List<Disclosure> saved = new ArrayList<>();
                try {
                    var scan = client.eachPage(d, d, detailTy, MAX_PAGES_PER_DAY, items -> {
                        List<Disclosure> fresh = ingest.saveNew(items);
                        saved.addAll(fresh);
                        fresh.forEach(fetcher::submit);   // 원본 다운로드는 비동기 큐로.
                                                          // 뒤 페이지에서 실패해도 여기까지는 살린다
                    });
                    fetched += scan.items();
                    if (scan.capped()) {
                        log.error("백필 페이지 상한({}) 도달 {} {} — 뒤쪽 누락",
                                MAX_PAGES_PER_DAY, d, detailTy);
                    }
                } catch (Exception e) {
                    log.error("백필 조회 실패 {} {} — 건너뜀", d, detailTy, e);
                }
                inserted += saved.size();
            }
        }
        log.info("백필 완료 {} ~ {} — 조회 {}건, 신규 {}건", from, to, fetched, inserted);
        return new Result(from, to, targets, fetched, inserted);
    }

    public record Result(LocalDate from, LocalDate to, List<String> detailTypes,
                         int fetched, int inserted) {}
}
