package kr.irm.dart.web.dto;

import kr.irm.dart.domain.AppUser;
import kr.irm.dart.domain.Disclosure;
import kr.irm.dart.domain.ParseStatus;

import java.time.Instant;
import java.time.LocalDate;

/** 관리자 화면 전용 응답들. 일반 화면이 쓰는 DisclosureSummary 와 필요한 필드가 다르다. */
public final class AdminDto {

    private AdminDto() {}

    public record AdminDisclosure(
            String rceptNo, String corpName, String reportNm, LocalDate rceptDt,
            ParseStatus parseStatus, boolean hidden, Instant hiddenAt, int commentCount) {

        public static AdminDisclosure from(Disclosure d, int commentCount) {
            return new AdminDisclosure(d.getRceptNo(), d.getCorpName(), d.getReportNm(),
                    d.getRceptDt(), d.getParseStatus(), d.isHidden(), d.getHiddenAt(), commentCount);
        }
    }

    /** 의견이 달린 공시만. 관리자가 "어디에 의견이 달렸나"를 찾는 화면이다. */
    public record CommentBoard(
            String rceptNo, String corpName, String reportNm, LocalDate rceptDt,
            boolean hidden, long commentCount, Instant lastCommentAt) {}

    /**
     * 카카오 scope 가 profile_nickname 뿐이라 이메일이 없다.
     * 닉네임은 겹칠 수 있으므로 providerUid 와 가입일을 함께 보여 사람을 구분한다.
     */
    public record AdminUser(
            Long id, String nickname, String providerUid, boolean admin,
            Instant createdAt, Instant lastLoginAt, boolean me) {

        public static AdminUser from(AppUser u, Long myId) {
            return new AdminUser(u.getId(),
                    u.getNickname() == null || u.getNickname().isBlank() ? "사용자" : u.getNickname(),
                    u.getProviderUid(), u.isAdmin(),
                    u.getCreatedAt(), u.getLastLoginAt(), u.getId().equals(myId));
        }
    }
}
