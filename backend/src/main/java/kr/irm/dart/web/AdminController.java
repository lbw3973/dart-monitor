package kr.irm.dart.web;

import kr.irm.dart.auth.CurrentUser;
import kr.irm.dart.domain.AppUser;
import kr.irm.dart.service.AdminService;
import kr.irm.dart.web.dto.AdminDto.*;
import kr.irm.dart.web.dto.PageResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 관리자 화면이 쓰는 API.
 *
 * 접근 통제는 경로 단위로 AdminGuard 가 한다(§WebConfig.addInterceptors) —
 * 여기 메서드마다 검사를 반복하지 않는다.
 *
 * 브라우저에서 호출되므로 Caddy 를 통과해야 한다.
 * 소급 수집·재파싱 같은 운영 배치는 인터넷에 열 이유가 없어 /api/ops 로 갈라 뒀다(§OpsController).
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService admin;

    public AdminController(AdminService admin) {
        this.admin = admin;
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
}
