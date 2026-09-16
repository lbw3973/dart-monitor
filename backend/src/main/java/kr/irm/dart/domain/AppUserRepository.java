package kr.irm.dart.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByProviderAndProviderUid(String provider, String providerUid);

    /**
     * 관리자 화면의 사용자 검색.
     * 카카오가 이메일을 주지 않아 찾을 단서가 닉네임과 provider_uid 뿐이다.
     * q 는 호출 측에서 %…% 로 감싸 소문자로 내린 값이다(비면 "%").
     */
    @Query("""
            select u from AppUser u
            where lower(coalesce(u.nickname, '')) like :q or u.providerUid like :q
            """)
    Page<AppUser> search(@Param("q") String q, Pageable pageable);
}
