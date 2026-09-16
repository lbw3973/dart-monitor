package kr.irm.dart.service;

import kr.irm.dart.domain.*;
import kr.irm.dart.web.dto.DisclosureSummary;
import kr.irm.dart.web.dto.PageResponse;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class BookmarkService {

    private final BookmarkRepository bookmarks;
    private final DisclosureRepository disclosures;
    private final CommentService comments;

    public BookmarkService(BookmarkRepository bookmarks, DisclosureRepository disclosures,
                           CommentService comments) {
        this.bookmarks = bookmarks;
        this.disclosures = disclosures;
        this.comments = comments;
    }

    @Transactional
    public void add(AppUser user, String rceptNo, String memo) {
        if (!disclosures.existsById(rceptNo)) {
            throw new ResponseStatusException(NOT_FOUND, "공시를 찾을 수 없습니다: " + rceptNo);
        }
        // PUT은 멱등 — 이미 있으면 메모만 갱신
        bookmarks.findById(new Bookmark.Key(user.getId(), rceptNo))
                .ifPresentOrElse(b -> b.setMemo(memo),
                        () -> bookmarks.save(new Bookmark(user.getId(), rceptNo, memo)));
    }

    @Transactional
    public void remove(AppUser user, String rceptNo) {
        bookmarks.deleteById(new Bookmark.Key(user.getId(), rceptNo));
    }

    @Transactional(readOnly = true)
    public PageResponse<DisclosureSummary> list(AppUser user, int page, int size) {
        List<String> ids = bookmarks.findAllRceptNos(user.getId());
        if (ids.isEmpty()) {
            return new PageResponse<>(List.of(), page, size, 0, 0, true);
        }
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100),
                Sort.by(Sort.Direction.DESC, "rceptDt", "rceptNo"));
        Page<Disclosure> found = disclosures.findByRceptNoIn(ids, pageable);
        var counts = comments.countsAmong(found.getContent().stream().map(Disclosure::getRceptNo).toList());
        return PageResponse.of(found, d ->
                DisclosureSummary.from(d, true, counts.getOrDefault(d.getRceptNo(), 0)));
    }

    /** 목록 응답에 표시할 스크랩 여부를 한 번의 질의로 채운다. */
    @Transactional(readOnly = true)
    public Set<String> markedAmong(AppUser user, List<String> rceptNos) {
        if (user == null || rceptNos.isEmpty()) return Set.of();
        return Set.copyOf(bookmarks.findMarkedIds(user.getId(), rceptNos));
    }
}
