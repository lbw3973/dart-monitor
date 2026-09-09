package kr.irm.dart.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import kr.irm.dart.config.KakaoProperties;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;

/**
 * 카카오 OAuth. 코드 교환과 사용자 조회는 전부 서버에서 수행하고,
 * 카카오 액세스 토큰은 신원 확인에만 쓰고 저장하지 않는다.
 */
@Component
public class KakaoOAuthClient {

    private static final String AUTH_HOST = "https://kauth.kakao.com";
    private static final String API_HOST = "https://kapi.kakao.com";

    private final KakaoProperties props;
    private final RestClient auth;
    private final RestClient api;

    public KakaoOAuthClient(KakaoProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(5));
        f.setReadTimeout(Duration.ofSeconds(10));
        this.auth = RestClient.builder().baseUrl(AUTH_HOST).requestFactory(f).build();
        this.api = RestClient.builder().baseUrl(API_HOST).requestFactory(f).build();
    }

    public String authorizeUrl(String state) {
        return UriComponentsBuilder.fromUriString(AUTH_HOST + "/oauth/authorize")
                .queryParam("client_id", props.restApiKey())
                .queryParam("redirect_uri", props.redirectUri())
                .queryParam("response_type", "code")
                .queryParam("scope", "profile_nickname")   // 최소 수집
                .queryParam("state", state)
                .build().toUriString();
    }

    public String exchangeCodeForAccessToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", props.restApiKey());
        form.add("redirect_uri", props.redirectUri());
        form.add("code", code);
        if (props.hasClientSecret()) form.add("client_secret", props.clientSecret());

        TokenResponse res = auth.post()
                .uri("/oauth/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(TokenResponse.class);

        if (res == null || res.accessToken() == null) {
            throw new IllegalStateException("카카오 토큰 교환 실패");
        }
        return res.accessToken();
    }

    public KakaoUser fetchUser(String accessToken) {
        UserResponse res = api.get()
                .uri("/v2/user/me")
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(UserResponse.class);

        if (res == null || res.id() == null) {
            throw new IllegalStateException("카카오 사용자 조회 실패");
        }
        var p = res.kakaoAccount() == null ? null : res.kakaoAccount().profile();
        return new KakaoUser(String.valueOf(res.id()),
                p == null ? null : p.nickname(),
                p == null ? null : p.thumbnailImageUrl());
    }

    public record KakaoUser(String uid, String nickname, String profileImage) {}

    record TokenResponse(@JsonProperty("access_token") String accessToken) {}

    record UserResponse(Long id, @JsonProperty("kakao_account") Account kakaoAccount) {
        record Account(Profile profile) {}
        record Profile(String nickname,
                       @JsonProperty("thumbnail_image_url") String thumbnailImageUrl) {}
    }
}
