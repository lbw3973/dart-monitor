package kr.irm.dart.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * 공시에 달린 의견.
 *
 * 답글은 1단까지다 — parentId 가 가리키는 행은 반드시 최상위여야 한다.
 * 그 검사는 등록할 때 서비스가 한다(§CommentService.add).
 */
@Entity
@Table(name = "comment")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rcept_no", nullable = false, length = 14)
    private String rceptNo;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 최상위 의견이면 null */
    @Column(name = "parent_id")
    private Long parentId;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Comment() {}

    public Comment(String rceptNo, Long userId, Long parentId, String body) {
        this.rceptNo = rceptNo;
        this.userId = userId;
        this.parentId = parentId;
        this.body = body;
    }

    public Long getId() { return id; }
    public String getRceptNo() { return rceptNo; }
    public Long getUserId() { return userId; }
    public Long getParentId() { return parentId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isDeleted() { return deletedAt != null; }

    /**
     * 답글이 달려 있을 때의 삭제 — 본문만 지우고 자리는 남긴다.
     * 행째로 지우면 ON DELETE CASCADE 로 답글까지 사라진다.
     */
    public void softDelete() {
        this.deletedAt = Instant.now();
        this.body = "";
    }
}
