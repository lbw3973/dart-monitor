package kr.irm.dart.web;

import kr.irm.dart.auth.CurrentUser;
import kr.irm.dart.domain.AppUser;
import kr.irm.dart.service.CommentService;
import kr.irm.dart.web.dto.CommentDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentService service;

    public CommentController(CommentService service) {
        this.service = service;
    }

    /** 읽기는 누구나 — 공유 링크로 들어온 사람이 빈 화면을 보지 않게 한다 */
    @GetMapping("/disclosures/{rceptNo}/comments")
    public List<CommentDto> list(@PathVariable String rceptNo, @CurrentUser AppUser user) {
        return service.list(rceptNo, user);
    }

    @PostMapping("/disclosures/{rceptNo}/comments")
    public ResponseEntity<CommentDto> add(@CurrentUser AppUser user,
                                          @PathVariable String rceptNo,
                                          @RequestBody Req req) {
        CommentDto created = service.add(require(user), rceptNo, req.body(), req.parentId());
        return ResponseEntity.status(201).body(created);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Map<String, Object>> remove(@CurrentUser AppUser user,
                                                      @PathVariable Long id) {
        service.remove(require(user), id);
        return ResponseEntity.ok(Map.of("id", id, "deleted", true));
    }

    /** parentId 가 있으면 답글. 그 대상이 이미 답글이면 서비스가 400을 낸다. */
    public record Req(String body, Long parentId) {}

    private static AppUser require(AppUser user) {
        if (user == null) throw new ResponseStatusException(UNAUTHORIZED, "로그인이 필요합니다");
        return user;
    }
}
