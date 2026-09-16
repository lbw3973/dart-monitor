package kr.irm.dart.domain;

import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface DisclosureRepository
        extends JpaRepository<Disclosure, String>, JpaSpecificationExecutor<Disclosure> {

    @Query("select d.rceptNo from Disclosure d where d.rceptNo in :ids")
    List<String> findExistingIds(@Param("ids") Collection<String> ids);

    @Query("select d.rceptNo from Disclosure d where d.rceptNo in :ids and d.hiddenAt is null")
    List<String> findVisibleAmong(@Param("ids") Collection<String> ids);

    Page<Disclosure> findByHiddenAtIsNotNull(Pageable pageable);

    /** 원본 미확보 건을 재시도 시각 기준으로 뽑는다. */
    @Query("""
           select d from Disclosure d
            where d.parseStatus = kr.irm.dart.domain.ParseStatus.PENDING
              and d.reportType <> kr.irm.dart.domain.ReportType.OTHER
              and (d.nextRetryAt is null or d.nextRetryAt <= :now)
            order by d.rceptNo asc
           """)
    List<Disclosure> findDueForFetch(@Param("now") Instant now, Limit limit);

    @Query(value = """
           select d.rcept_no from disclosure d
            where d.parse_status = 'FETCHED'
              and d.report_type <> 'OTHER'
            order by d.rcept_no desc
            limit :limit
           """, nativeQuery = true)
    List<String> findFetchedIds(@Param("limit") int limit);

    Page<Disclosure> findByRceptNoIn(Collection<String> rceptNos, Pageable pageable);

    long countByParseStatus(ParseStatus status);
}
