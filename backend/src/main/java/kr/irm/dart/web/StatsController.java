package kr.irm.dart.web;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final JdbcTemplate jdbc;

    public StatsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public Map<String, Object> stats() {
        List<Map<String, Object>> byType = jdbc.queryForList("""
                SELECT report_type, parse_status, count(*) AS cnt
                  FROM disclosure GROUP BY 1, 2 ORDER BY 1, 2
                """);
        Map<String, Object> today = jdbc.queryForMap("""
                SELECT count(*) AS total,
                       count(*) FILTER (WHERE parse_status IN ('PARSED','PARSED_WITH_WARN')) AS parsed,
                       count(*) FILTER (WHERE parse_status = 'FAILED') AS failed
                  FROM disclosure WHERE rcept_dt = CURRENT_DATE
                """);
        List<Map<String, Object>> lastRuns = jdbc.queryForList("""
                SELECT detail_ty, fetched, inserted, ok, started_at
                  FROM ingest_run ORDER BY id DESC LIMIT 4
                """);
        return Map.of("today", today, "byType", byType, "lastRuns", lastRuns);
    }
}
