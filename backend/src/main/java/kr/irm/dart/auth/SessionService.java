package kr.irm.dart.auth;

import kr.irm.dart.config.KakaoProperties;
import kr.irm.dart.domain.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseCookie;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * 불투명 세션 토큰 방식.
 * 쿠키에는 난수 원문을, DB에는 SHA-256 해시만 저장한다 — DB 유출로 세션을 탈취할 수 없다.
 * JWT 대신 이 방식을 쓴 이유는 로그아웃으로 실제 무효화가 가능하고 서명키 관리가 필요 없어서다.
 */
@Service
public class SessionService {

    public static final String COOKIE = "sid";
    private static final Logger log = LoggerFactory.getLogger(SessionService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserSessionRepository sessions;
    private final AppUserRepository users;
    private final KakaoProperties props;

    public SessionService(UserSessionRepository sessions, AppUserRepository users,
                          KakaoProperties props) {
        this.sessions = sessions;
        this.users = users;
        this.props = props;
    }

    @Transactional
    public AppUser upsertUser(KakaoOAuthClient.KakaoUser k) {
        return users.findByProviderAndProviderUid("kakao", k.uid())
                .map(u -> { u.touch(k.nickname(), k.profileImage()); return u; })
                .orElseGet(() -> users.save(new AppUser(k.uid(), k.nickname(), k.profileImage())));
    }

    /** 세션을 만들고 쿠키에 담을 원문 토큰을 돌려준다. */
    @Transactional
    public String issue(Long userId) {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        sessions.save(new UserSession(hash(token), userId,
                Instant.now().plus(props.sessionTtl())));
        return token;
    }

    @Transactional(readOnly = true)
    public Optional<AppUser> resolve(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        return sessions.findById(hash(token))
                .filter(s -> !s.isExpired())
                .flatMap(s -> users.findById(s.getUserId()));
    }

    @Transactional
    public void revoke(String token) {
        if (token != null && !token.isBlank()) sessions.deleteById(hash(token));
    }

    public ResponseCookie cookie(String token, boolean clear) {
        return ResponseCookie.from(COOKIE, clear ? "" : token)
                .httpOnly(true)                       // JS에서 읽을 수 없다
                .secure(props.cookieSecure())         // 운영(https)에서 true
                .sameSite("Lax")                      // 크로스사이트 요청에 쿠키가 실리지 않아 CSRF 방어
                .path("/")
                .maxAge(clear ? java.time.Duration.ZERO : props.sessionTtl())
                .build();
    }

    @Scheduled(cron = "0 0 4 * * *")
    @Transactional
    public void purgeExpired() {
        int n = sessions.deleteExpired(Instant.now());
        if (n > 0) log.info("만료 세션 {}건 정리", n);
    }

    private static String hash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
