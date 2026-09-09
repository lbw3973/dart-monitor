package kr.irm.dart.collector;

import kr.irm.dart.config.DartProperties;
import kr.irm.dart.domain.Disclosure;
import kr.irm.dart.service.DisclosureEventPublisher;
import kr.irm.dart.service.IngestService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
public class DisclosurePoller {

    private static final Logger log = LoggerFactory.getLogger(DisclosurePoller.class);
    private static final int MAX_PAGES = 10;   // 폭주 방지 상한 (100건 × 10 = 1,000건)

    private final DartApiClient client;
    private final IngestService ingest;
    private final DocumentFetcher fetcher;
    private final DartProperties props;
    private final JdbcTemplate jdbc;
    private final DisclosureEventPublisher events;

    public DisclosurePoller(DartApiClient client, IngestService ingest, DocumentFetcher fetcher,
                            DartProperties props, JdbcTemplate jdbc,
                            DisclosureEventPublisher events) {
        this.client = client;
        this.ingest = ingest;
        this.fetcher = fetcher;
        this.props = props;
        this.jdbc = jdbc;
        this.events = events;
    }

    @Scheduled(fixedDelayString = "${dart.poll-interval}", initialDelay = 3000)
    public void poll() {
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(props.lookbackDays());   // 자정 경계 유실 방지

        for (String detailTy : props.detailTypes()) {
            int fetched = 0, inserted = 0;
            String error = null;
            try {
                List<Disclosure> all = new ArrayList<>();
                for (int page = 1; page <= MAX_PAGES; page++) {
                    var items = client.searchDisclosures(from, to, detailTy, page);
                    if (items.isEmpty()) break;
                    fetched += items.size();
                    all.addAll(ingest.saveNew(items));
                    if (items.size() < 100) break;      // 마지막 페이지
                    if (page == MAX_PAGES) {
                        log.warn("페이지 상한 도달 detailTy={} — 일부 누락 가능", detailTy);
                    }
                }
                inserted = all.size();
                if (inserted > 0) {
                    log.info("신규 공시 {}건 detailTy={}", inserted, detailTy);
                    all.forEach(fetcher::submit);
                    events.publishNew(all);
                }
            } catch (DartApiException e) {
                error = e.getMessage();
                log.error("폴링 실패 detailTy={} {}", detailTy, e.getMessage());
                if (e.isFatal()) {
                    log.error("복구 불가 오류 — 인증키/쿼터를 확인하세요");
                }
            } catch (Exception e) {
                error = e.toString();
                log.error("폴링 실패 detailTy={}", detailTy, e);
            }
            record(detailTy, fetched, inserted, error);
        }
    }

    private void record(String detailTy, int fetched, int inserted, String error) {
        jdbc.update("""
                INSERT INTO ingest_run (detail_ty, fetched, inserted, ok, error)
                VALUES (?, ?, ?, ?, ?)
                """, detailTy, fetched, inserted, error == null, error);
    }
}
