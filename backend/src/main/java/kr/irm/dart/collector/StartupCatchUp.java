package kr.irm.dart.collector;

import kr.irm.dart.config.DartProperties;
import kr.irm.dart.service.BackfillService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 기동 시 1회, 마지막 수집일과 오늘 사이의 공백을 메운다.
 *
 * 평상시 폴러는 최근 2일만 조회하므로(쿼터 절약) 하루 넘게 중단되면 그 사이가 영구 누락된다.
 * 매 폴링마다 넓게 조회하는 대신 기동 시 한 번만 메우는 편이 쿼터에 훨씬 유리하다.
 */
@Component
public class StartupCatchUp {

    private static final Logger log = LoggerFactory.getLogger(StartupCatchUp.class);

    private final BackfillService backfill;
    private final JdbcTemplate jdbc;
    private final DartProperties props;

    public StartupCatchUp(BackfillService backfill, JdbcTemplate jdbc, DartProperties props) {
        this.backfill = backfill;
        this.jdbc = jdbc;
        this.props = props;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void catchUp() {
        if (props.catchUpMaxDays() <= 0) {
            log.info("기동 캐치업 비활성 (catch-up-max-days=0)");
            return;
        }

        LocalDate today = LocalDate.now();
        LocalDate last = jdbc.queryForObject(
                "SELECT max(rcept_dt) FROM disclosure", LocalDate.class);

        // 최초 기동이면 오늘부터 시작한다 (과거 소급은 관리자 백필 API로 명시적으로)
        LocalDate from = (last == null)
                ? today.minusDays(props.lookbackDays())
                : last.minusDays(1);            // 마지막 수집일은 부분 수집일 수 있어 하루 겹친다

        long gap = ChronoUnit.DAYS.between(from, today);
        if (gap <= props.lookbackDays()) {
            log.info("기동 캐치업 불필요 (마지막 수집일 {})", last);
            return;
        }

        if (gap > props.catchUpMaxDays()) {
            LocalDate capped = today.minusDays(props.catchUpMaxDays());
            log.warn("공백 {}일이 상한({}일)을 초과 — {}부터만 수집한다. "
                     + "그 이전은 /api/admin/backfill 로 명시적으로 요청할 것",
                    gap, props.catchUpMaxDays(), capped);
            from = capped;
        }

        log.info("기동 캐치업 {} ~ {} (공백 {}일)", from, today, gap);
        try {
            backfill.run(from, today);
        } catch (Exception e) {
            log.error("기동 캐치업 실패 — 평상시 폴링은 계속된다", e);
        }
    }
}
