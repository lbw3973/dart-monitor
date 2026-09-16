package kr.irm.dart.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    /** 한 공시의 의견을 통째로 — 최상위·답글 구분은 서비스가 한다 */
    List<Comment> findByRceptNoOrderByCreatedAtAsc(String rceptNo);

    /** 지워도 되는지 판단한다. 남아 있는 답글이 하나라도 있으면 자리를 남겨야 한다. */
    boolean existsByParentIdAndDeletedAtIsNull(Long parentId);

    /** 목록 50건의 의견 수를 한 번의 집계로 — 건마다 세면 N+1 이다 */
    @Query("""
            select c.rceptNo as rceptNo, count(c) as cnt
            from Comment c
            where c.rceptNo in :ids and c.deletedAt is null
            group by c.rceptNo
            """)
    List<CountByRceptNo> countAmong(@Param("ids") Collection<String> ids);

    interface CountByRceptNo {
        String getRceptNo();
        long getCnt();
    }
}
