package kr.irm.dart.web;

import kr.irm.dart.auth.CurrentUser;
import kr.irm.dart.domain.AppUser;
import kr.irm.dart.service.BookmarkService;
import kr.irm.dart.web.dto.DisclosureSummary;
import kr.irm.dart.web.dto.PageResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/bookmarks")
public class BookmarkController {

    private final BookmarkService service;

    public BookmarkController(BookmarkService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<DisclosureSummary> list(@CurrentUser AppUser user,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "50") int size) {
        return service.list(require(user), page, size);
    }

    @PutMapping("/{rceptNo}")
    public ResponseEntity<Map<String, Object>> add(@CurrentUser AppUser user,
                                                   @PathVariable String rceptNo,
                                                   @RequestBody(required = false) Map<String, String> body) {
        service.add(require(user), rceptNo, body == null ? null : body.get("memo"));
        return ResponseEntity.ok(Map.of("rceptNo", rceptNo, "bookmarked", true));
    }

    @DeleteMapping("/{rceptNo}")
    public ResponseEntity<Map<String, Object>> remove(@CurrentUser AppUser user,
                                                      @PathVariable String rceptNo) {
        service.remove(require(user), rceptNo);
        return ResponseEntity.ok(Map.of("rceptNo", rceptNo, "bookmarked", false));
    }

    private static AppUser require(AppUser user) {
        if (user == null) throw new ResponseStatusException(UNAUTHORIZED, "로그인이 필요합니다");
        return user;
    }
}
