package kr.irm.dart.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "kakao")
public record KakaoProperties(
        String restApiKey,
        String clientSecret,      // 콘솔에서 활성화하지 않았으면 비워둔다
        String redirectUri,
        String appBaseUrl,        // 로그인 완료 후 돌려보낼 프론트 주소
        Duration sessionTtl,
        boolean cookieSecure      // 로컬 http에서는 false, 운영 https에서는 true
) {
    public boolean hasClientSecret() {
        return clientSecret != null && !clientSecret.isBlank();
    }
}
