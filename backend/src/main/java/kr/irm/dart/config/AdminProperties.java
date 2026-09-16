package kr.irm.dart.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * 첫 관리자 부트스트랩.
 *
 * 카카오 scope 가 profile_nickname 뿐이라 이메일로는 계정을 특정할 수 없다(§KakaoOAuthClient).
 * 그래서 provider_uid 로 지정하고, 그 계정이 로그인할 때 ADMIN 으로 올린다.
 * 두 번째 관리자부터는 관리자 페이지에서 부여한다.
 */
@ConfigurationProperties(prefix = "admin")
public record AdminProperties(List<String> uids) {

    public boolean bootstraps(String providerUid) {
        if (uids == null || providerUid == null) return false;
        return uids.stream().anyMatch(u -> u != null && providerUid.equals(u.trim()));
    }
}
