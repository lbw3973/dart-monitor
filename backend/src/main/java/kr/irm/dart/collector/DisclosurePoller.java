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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Component
public class DisclosurePoller {

    private static final Logger log = LoggerFactory.getLogger(DisclosurePoller.class);
    private static final int MAX_PAGES = 50;   // 폭주 방지 안전망. 정상 종료는 total_page가 판단한다

    private final DartApiClient client;
    private final IngestService ingest;
    private final DocumentFetcher fetcher;
    private final DartProperties props;
    private final JdbcTemplate jdbc;
    private final DisclosureEventPublisher events;

    /** 그날 넓은 창으로 한 번 훑었는지. 단일 인스턴스 전제(SSE 브로드캐스트와 같은 전제다). */
    private LocalDate wideScanDate;

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
        LocalDateTime now = LocalDateTime.now();
        if (!isActive(now, props.activeFrom(), props.activeTo(), props.weekendPoll())) return;

        LocalDate to = now.toLocalDate();
        // 그날 첫 폴링만 며칠 거슬러 본다. 폴링을 쉬는 야간·주말에 뒤늦게 노출된 건과,
        // 전날 마지막 폴링이 실패해 놓친 건을 여기서 주워 담는다.
        boolean wide = !to.equals(wideScanDate);
        LocalDate from = wide ? to.minusDays(props.morningLookbackDays()) : to;
        boolean allOk = true;

        for (String detailTy : props.detailTypes()) {
            int fetched = 0, inserted = 0;
            String error = null;
            try {
                List<Disclosure> all = new ArrayList<>();
                var scan = client.eachPage(from, to, detailTy, MAX_PAGES,
                        items -> all.addAll(ingest.saveNew(items)));
                fetched = scan.items();
                inserted = all.size();
                // 상한에 막혔다는 건 뒤쪽을 못 읽었다는 뜻이다. 로그만 남기면 아무도 모르므로
                // ingest_run.ok=false로 남겨 관측 가능하게 한다.
                if (scan.capped()) {
                    error = "페이지 상한(%d) 도달 — 뒤쪽 누락".formatted(MAX_PAGES);
                    log.error("페이지 상한 도달 detailTy={} 조회 {}건", detailTy, fetched);
                }
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
            if (error != null) allOk = false;
            record(detailTy, fetched, inserted, error);
        }

        // 실패한 채로 소진하면 보정 기회를 잃는다. 한 번 성공할 때까지 넓은 창을 유지한다.
        if (wide && allOk) wideScanDate = to;
    }

    /**
     * 지금이 공시가 접수될 수 있는 시간대인가.
     *
     * DART 전자접수는 평일 07:30~19:00뿐이다(당일접수 18:00 마감, 이후 19:00까지는 익일접수).
     * 주말·공휴일과 야간에는 접수 자체가 불가능하므로 그 시간의 폴링은 전부 헛돈다
     * (실측: 18~06시 13시간 동안 3,102회 폴링해 신규 0건, 주말 3주 연속 0건).
     *
     * 경계는 분 단위로 끊는다. 초까지 비교하면 19:30:00.001에 도는 폴링이 빠져버린다.
     */
    static boolean isActive(LocalDateTime now, LocalTime from, LocalTime to, boolean weekendPoll) {
        if (from == null || to == null) return true;          // 미설정이면 상시 폴링
        DayOfWeek day = now.getDayOfWeek();
        if (!weekendPoll && (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY)) return false;
        LocalTime at = now.toLocalTime().truncatedTo(ChronoUnit.MINUTES);
        return !at.isBefore(from) && !at.isAfter(to);
    }

    private void record(String detailTy, int fetched, int inserted, String error) {
        jdbc.update("""
                INSERT INTO ingest_run (detail_ty, fetched, inserted, ok, error)
                VALUES (?, ?, ?, ?, ?)
                """, detailTy, fetched, inserted, error == null, error);
    }
}
