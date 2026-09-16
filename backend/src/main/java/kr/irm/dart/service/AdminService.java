package kr.irm.dart.service;

import jakarta.persistence.criteria.Predicate;
import kr.irm.dart.domain.*;
import kr.irm.dart.web.dto.AdminDto.*;
import kr.irm.dart.web.dto.PageResponse;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class AdminService {

    private static final int MAX_SIZE = 100;

    private final DisclosureRepository disclosures;
    private final CommentRepository comments;
    private final AppUserRepository users;
    private final CommentService commentService;

    public AdminService(DisclosureRepository disclosures, CommentRepository comments,
                        AppUserRepository users, CommentService commentService) {
        this.disclosures = disclosures;
        this.comments = comments;
        this.users = users;
        this.commentService = commentService;
    }

    /**
     * 관리자용 공시 목록. 일반 목록과 달리 숨긴 것도 보인다 — 안 보이면 되돌릴 수가 없다.
     *
     * @param hidden null=전체, true=숨긴 것만, false=보이는 것만
     */
    @Transactional(readOnly = true)
    public PageResponse<AdminDisclosure> disclosures(String q, Boolean hidden, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_SIZE),
                Sort.by(Sort.Direction.DESC, "rceptDt", "rceptNo"));

        Specification<Disclosure> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (hidden != null) {
                ps.add(hidden ? cb.isNotNull(root.get("hiddenAt")) : cb.isNull(root.get("hiddenAt")));
            }
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                ps.add(cb.or(
                        cb.like(cb.lower(root.get("corpName")), like),
                        cb.like(cb.lower(root.get("reportNm")), like),
                        cb.like(root.get("rceptNo"), "%" + q.trim() + "%")));
            }
            return ps.isEmpty() ? null : cb.and(ps.toArray(Predicate[]::new));
        };

        Page<Disclosure> found = disclosures.findAll(spec, pageable);
        var counts = commentService.countsAmong(
                found.getContent().stream().map(Disclosure::getRceptNo).toList());
        return PageResponse.of(found,
                d -> AdminDisclosure.from(d, counts.getOrDefault(d.getRceptNo(), 0)));
    }

    /**
     * 공시를 내리거나 되돌린다.
     * 행은 지우지 않는다 — 지우면 폴러가 되살리고, 의견·즐겨찾기가 CASCADE 로 사라진다(§V7).
     */
    @Transactional
    public AdminDisclosure setHidden(String rceptNo, boolean hidden) {
        Disclosure d = disclosures.findById(rceptNo)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "공시를 찾을 수 없습니다"));
        d.setHidden(hidden);
        return AdminDisclosure.from(d,
                commentService.countsAmong(List.of(rceptNo)).getOrDefault(rceptNo, 0));
    }

    /** 의견이 달린 공시만. 여기서 공시를 고르면 그 스레드를 열어 개별 삭제한다. */
    @Transactional(readOnly = true)
    public PageResponse<CommentBoard> commentBoards(String q, int page, int size) {
        // 정렬은 질의문의 order by(최근 의견순)가 정한다 — Pageable 에 Sort 를 주면 덧붙어 깨진다
        Page<CommentRepository.Board> found =
                comments.boards(like(q), PageRequest.of(Math.max(page, 0), clamp(size)));
        return PageResponse.of(found,
                b -> new CommentBoard(b.getRceptNo(), b.getCorpName(), b.getReportNm(),
                        b.getRceptDt(), b.getHiddenAt() != null, b.getCnt(), b.getLastAt()));
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUser> users(AppUser me, String q, int page, int size) {
        // "ADMIN" < "USER" 라 role 오름차순이면 관리자가 위로 온다. 같은 등급 안에서는 최근 가입순.
        Pageable pageable = PageRequest.of(Math.max(page, 0), clamp(size),
                Sort.by(Sort.Order.asc("role"), Sort.Order.desc("id")));
        return PageResponse.of(users.search(like(q), pageable), u -> AdminUser.from(u, me.getId()));
    }

    /** 검색어를 LIKE 패턴으로. 비어 있으면 "%" — 전부 통과시킨다. */
    private static String like(String q) {
        return q == null || q.isBlank() ? "%" : "%" + q.trim().toLowerCase() + "%";
    }

    private static int clamp(int size) {
        return Math.clamp(size, 1, MAX_SIZE);
    }

    @Transactional
    public AdminUser setAdmin(AppUser me, Long userId, boolean admin) {
        AppUser target = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "사용자를 찾을 수 없습니다"));
        // 자기 권한은 스스로 못 내린다 — 마지막 관리자가 내리면 아무도 되돌릴 수 없다
        if (target.getId().equals(me.getId()) && !admin) {
            throw new ResponseStatusException(BAD_REQUEST, "자신의 관리자 권한은 해제할 수 없습니다");
        }
        target.setAdmin(admin);
        return AdminUser.from(target, me.getId());
    }
}
