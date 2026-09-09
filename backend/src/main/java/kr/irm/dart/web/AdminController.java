package kr.irm.dart.web;

import kr.irm.dart.domain.ParseStatus;
import kr.irm.dart.service.BackfillService;
import kr.irm.dart.service.ParseService;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 운영용 — 서식 개정으로 파싱 룰을 고친 뒤 재처리할 때 쓴다. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final ParseService parseService;
    private final BackfillService backfillService;
    private final JdbcTemplate jdbc;

    public AdminController(ParseService parseService, BackfillService backfillService,
                           JdbcTemplate jdbc) {
        this.parseService = parseService;
        this.backfillService = backfillService;
        this.jdbc = jdbc;
    }

    /** 과거 구간 소급 수집. 하루 단위로 훑으므로 구간이 길면 시간이 걸린다. */
    @PostMapping("/backfill")
    public BackfillService.Result backfill(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return backfillService.run(from, to == null ? LocalDate.now() : to);
    }

    @PostMapping("/disclosures/{rceptNo}/reparse")
    public Map<String, Object> reparseOne(@PathVariable String rceptNo) {
        parseService.parseOne(rceptNo);
        return Map.of("rceptNo", rceptNo, "done", true);
    }

    /** 상태를 FETCHED로 되돌리면 ParseWorker가 다음 주기에 집어간다. */
    @PostMapping("/reparse")
    public Map<String, Object> reparseBulk(
            @RequestParam(defaultValue = "FAILED") ParseStatus status) {
        int n = jdbc.update(
                "UPDATE disclosure SET parse_status = 'FETCHED' WHERE parse_status = ?::text",
                status.name());
        return Map.of("requeued", n, "from", status.name());
    }
}
