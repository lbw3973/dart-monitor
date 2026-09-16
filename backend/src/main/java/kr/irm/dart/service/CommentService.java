package kr.irm.dart.service;

import kr.irm.dart.domain.*;
import kr.irm.dart.web.dto.CommentDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.*;

@Service
public class CommentService {

    /** 스키마의 CHECK 와 같은 값 (§V6__comment.sql) */
    private static final int MAX_BODY = 1000;

    private final CommentRepository comments;
    private final DisclosureRepository disclosures;
    private final AppUserRepository users;

    public CommentService(CommentRepository comments,
                          DisclosureRepository disclosures,
                          AppUserRepository users) {
        this.comments = comments;
        this.disclosures = disclosures;
        this.users = users;
    }

    /** 최상위 의견과 각 답글을 한 번에. 답글은 몇 건뿐이라 따로 페이징하지 않는다. */
    @Transactional(readOnly = true)
    public List<CommentDto> list(String rceptNo, AppUser me) {
        List<Comment> all = comments.findByRceptNoOrderByCreatedAtAsc(rceptNo);
        if (all.isEmpty()) return List.of();

        Map<Long, String> names = namesOf(all);
        Long myId = me == null ? null : me.getId();
        Function<Comment, CommentDto> view = c -> CommentDto.of(
                c, names.getOrDefault(c.getUserId(), "사용자"), c.getUserId().equals(myId), null);

        Map<Long, List<Comment>> byParent = all.stream()
                .filter(c -> c.getParentId() != null)
                .collect(Collectors.groupingBy(Comment::getParentId));

        return all.stream()
                .filter(c -> c.getParentId() == null)
                // 접수 직후에 이야기가 몰리므로 최상위는 최신순, 답글은 대화 순서대로 둔다
                .sorted(Comparator.comparing(Comment::getCreatedAt).reversed())
                .map(c -> {
                    List<CommentDto> replies = byParent.getOrDefault(c.getId(), List.of())
                            .stream().map(view).toList();
                    return CommentDto.of(c, names.getOrDefault(c.getUserId(), "사용자"),
                            c.getUserId().equals(myId), replies);
                })
                .toList();
    }

    @Transactional
    public CommentDto add(AppUser user, String rceptNo, String rawBody, Long parentId) {
        if (!disclosures.existsById(rceptNo)) {
            throw new ResponseStatusException(NOT_FOUND, "공시를 찾을 수 없습니다: " + rceptNo);
        }
        String body = rawBody == null ? "" : rawBody.strip();
        if (body.isEmpty()) throw new ResponseStatusException(BAD_REQUEST, "내용을 입력해 주세요");
        if (body.length() > MAX_BODY) {
            throw new ResponseStatusException(BAD_REQUEST, MAX_BODY + "자를 넘을 수 없습니다");
        }

        Long parent = null;
        if (parentId != null) {
            Comment p = comments.findById(parentId)
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "없는 의견입니다"));
            if (!p.getRceptNo().equals(rceptNo)) {
                throw new ResponseStatusException(BAD_REQUEST, "다른 공시의 의견입니다");
            }
            // 답글은 1단까지. 스키마 CHECK 로는 "부모의 부모가 NULL인가"를 표현할 수 없어 여기서 막는다.
            if (p.getParentId() != null) {
                throw new ResponseStatusException(BAD_REQUEST, "답글에는 답글을 달 수 없습니다");
            }
            parent = p.getId();
        }

        Comment saved = comments.save(new Comment(rceptNo, user.getId(), parent, body));
        String name = user.getNickname() == null || user.getNickname().isBlank()
                ? "사용자" : user.getNickname();
        return CommentDto.of(saved, name, true, parent == null ? List.of() : null);
    }

    @Transactional
    public void remove(AppUser user, Long id) {
        Comment c = comments.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "없는 의견입니다"));
        if (!c.getUserId().equals(user.getId()) && !user.isAdmin()) {
            throw new ResponseStatusException(FORBIDDEN, "본인 의견만 지울 수 있습니다");
        }
        if (c.isDeleted()) return;   // DELETE는 멱등

        // 답글이 남아 있으면 행째로 지울 수 없다 — CASCADE 로 답글까지 사라진다
        if (comments.existsByParentIdAndDeletedAtIsNull(c.getId())) {
            c.softDelete();
            return;
        }

        Long parentId = c.getParentId();
        comments.delete(c);
        comments.flush();   // 아래 exists 질의가 방금 지운 행을 보지 않도록

        // 자리만 남아 있던 부모의 마지막 답글이었다면 부모도 치운다.
        // 답글 없는 "삭제된 의견입니다"만 덩그러니 남으면 군더더기다.
        if (parentId != null) {
            comments.findById(parentId)
                    .filter(Comment::isDeleted)
                    .filter(p -> !comments.existsByParentIdAndDeletedAtIsNull(p.getId()))
                    .ifPresent(comments::delete);
        }
    }

    /** 목록 응답에 실을 의견 수를 한 번의 질의로 채운다(§BookmarkService.markedAmong 과 같은 방식). */
    @Transactional(readOnly = true)
    public Map<String, Integer> countsAmong(List<String> rceptNos) {
        if (rceptNos.isEmpty()) return Map.of();
        return comments.countAmong(rceptNos).stream()
                .collect(Collectors.toMap(CommentRepository.CountByRceptNo::getRceptNo,
                        r -> (int) r.getCnt()));
    }

    /** 작성자 닉네임을 한 번에 — 의견마다 조회하면 N+1 이다 */
    private Map<Long, String> namesOf(List<Comment> all) {
        Set<Long> ids = all.stream().map(Comment::getUserId).collect(Collectors.toSet());
        Map<Long, String> names = new HashMap<>();
        for (AppUser u : users.findAllById(ids)) {
            names.put(u.getId(),
                    u.getNickname() == null || u.getNickname().isBlank() ? "사용자" : u.getNickname());
        }
        return names;
    }
}
