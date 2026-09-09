package kr.irm.dart.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "bookmark")
@IdClass(Bookmark.Key.class)
public class Bookmark {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Id
    @Column(name = "rcept_no", length = 14)
    private String rceptNo;

    private String memo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Bookmark() {}

    public Bookmark(Long userId, String rceptNo, String memo) {
        this.userId = userId;
        this.rceptNo = rceptNo;
        this.memo = memo;
    }

    public String getRceptNo() { return rceptNo; }
    public String getMemo() { return memo; }
    public Instant getCreatedAt() { return createdAt; }
    public void setMemo(String memo) { this.memo = memo; }

    public static class Key implements Serializable {
        private Long userId;
        private String rceptNo;

        public Key() {}
        public Key(Long userId, String rceptNo) { this.userId = userId; this.rceptNo = rceptNo; }

        @Override public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key k)) return false;
            return Objects.equals(userId, k.userId) && Objects.equals(rceptNo, k.rceptNo);
        }
        @Override public int hashCode() { return Objects.hash(userId, rceptNo); }
    }
}
