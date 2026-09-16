package kr.irm.dart.web.dto;

import kr.irm.dart.domain.Comment;

import java.time.Instant;
import java.util.List;

/**
 * 화면이 쓰는 모양 — 최상위 의견이 자기 답글을 품는다.
 *
 * 답글은 replies 가 null 이다. 화면은 그걸 보고 "답글" 버튼을 그리지 않는다
 * (§CommentSheet — 화면에 길이 없으면 규칙을 설명할 필요도 없다).
 * createdAt 은 오프셋이 붙은 ISO 로 나가야 한다 — 없으면 브라우저가 로컬 시간으로
 * 읽어 시간 표시가 통째로 어긋난다.
 */
public record CommentDto(
        Long id, String author, boolean mine,
        /** 삭제 버튼을 그릴지. 내 글이거나 내가 관리자일 때 참이다. */
        boolean deletable,
        String body, Instant createdAt, boolean deleted, List<CommentDto> replies) {

    public static CommentDto of(Comment c, String author, boolean mine, boolean admin,
                                List<CommentDto> replies) {
        return new CommentDto(
                c.getId(),
                author,
                mine,
                (mine || admin) && !c.isDeleted(),
                c.isDeleted() ? "" : c.getBody(),
                c.getCreatedAt(),
                c.isDeleted(),
                replies);
    }
}
