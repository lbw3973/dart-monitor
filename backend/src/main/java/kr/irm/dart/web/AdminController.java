package kr.irm.dart.web;

import kr.irm.dart.auth.CurrentUser;
import kr.irm.dart.domain.AppUser;
import kr.irm.dart.domain.ParseStatus;
import kr.irm.dart.service.AdminService;
import kr.irm.dart.service.BackfillService;
import kr.irm.dart.service.ParseService;
import kr.irm.dart.web.dto.AdminDto.*;
import kr.irm.dart.web.dto.PageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 관리자 API.
 *
 * 접근 통제는 경로 단위로 AdminGuard 가 한다(§WebConfig.addInterceptors) —
 * 여기 메서드마다 검사를 반복하지 않는다.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final ParseService parseService;
    private final BackfillService backfillService;
    private final AdminService admin;
    private final JdbcTemplate jdbc;

    public AdminController(ParseService parseService, BackfillService backfillService,
                           AdminService admin, JdbcTemplate jdbc) {
        this.parseService = parseService;
        this.backfillService = backfillService;
        this.admin = admin;
        this.jdbc = jdbc;
    }

    /* ── 공시 ── */

    /** hidden 을 생략하면 전체, true 면 숨긴 것만, false 면 보이는 것만. */
    @GetMapping("/disclosures")
    public PageResponse<AdminDisclosure> disclosures(@RequestParam(required = false) String q,
                                                     @RequestParam(required = false) Boolean hidden,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "50") int size) {
        return admin.disclosures(q, hidden, page, size);
    }

    @PutMapping("/disclosures/{rceptNo}/hidden")
    public AdminDisclosure setHidden(@PathVariable String rceptNo, @RequestBody HiddenReq req) {
        return admin.setHidden(rceptNo, req.hidden());
    }

    public record HiddenReq(boolean hidden) {}

    /* ── 의견 ── */

    /** 의견이 달린 공시만. 개별 삭제는 DELETE /api/comments/{id} 가 그대로 받는다. */
    @GetMapping("/comment-boards")
    public List<CommentBoard> commentBoards(@RequestParam(defaultValue = "50") int limit) {
        return admin.commentBoards(limit);
    }

    /* ── 사용자 ── */

    @GetMapping("/users")
    public List<AdminUser> users(@CurrentUser AppUser me) {
        return admin.users(me);
    }

    @PutMapping("/users/{id}/admin")
    public AdminUser setAdmin(@CurrentUser AppUser me, @PathVariable Long id,
                              @RequestBody AdminReq req) {
        return admin.setAdmin(me, id, req.admin());
    }

    public record AdminReq(boolean admin) {}

    /* ── 수집·파싱 운영 ── */

    /**
     * 과거 구간 소급 수집. 하루 단위로 훑으므로 구간이 길면 시간이 걸린다.
     *
     * @param detailTy 공시상세유형(D001·A002 …). 반복 지정 가능하고, 생략하면 설정된 전체를 돈다.
     */
    @PostMapping("/backfill")
    public BackfillService.Result backfill(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<String> detailTy) {
        return backfillService.run(from, to == null ? LocalDate.now() : to, detailTy);
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
