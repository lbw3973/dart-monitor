package kr.irm.dart.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
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

    /**
     * 의견이 달린 공시만 추린다 — 관리자가 "어디에 의견이 달렸나"를 찾는 화면용.
     * 최근에 의견이 달린 순으로 준다. Disclosure 와는 연관 매핑이 없어 엔티티 조인으로 붙인다.
     *
     * q 는 호출 측에서 이미 %…% 로 감싸 소문자로 내린 값이다(비면 "%").
     * group by 라 건수는 "묶음 수"여야 해서 countQuery 를 따로 준다.
     */
    @Query(value = """
            select d.rceptNo as rceptNo, d.corpName as corpName, d.reportNm as reportNm,
                   d.rceptDt as rceptDt, d.hiddenAt as hiddenAt,
                   count(c) as cnt, max(c.createdAt) as lastAt
            from Comment c join Disclosure d on d.rceptNo = c.rceptNo
            where c.deletedAt is null
              and (lower(d.corpName) like :q or lower(d.reportNm) like :q or d.rceptNo like :q)
            group by d.rceptNo, d.corpName, d.reportNm, d.rceptDt, d.hiddenAt
            order by max(c.createdAt) desc
            """,
            countQuery = """
            select count(distinct c.rceptNo)
            from Comment c join Disclosure d on d.rceptNo = c.rceptNo
            where c.deletedAt is null
              and (lower(d.corpName) like :q or lower(d.reportNm) like :q or d.rceptNo like :q)
            """)
    Page<Board> boards(@Param("q") String q, Pageable pageable);

    interface Board {
        String getRceptNo();
        String getCorpName();
        String getReportNm();
        LocalDate getRceptDt();
        Instant getHiddenAt();
        long getCnt();
        Instant getLastAt();
    }
}
