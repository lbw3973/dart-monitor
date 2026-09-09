package kr.irm.dart.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import kr.irm.dart.auth.*;
import kr.irm.dart.config.KakaoProperties;
import kr.irm.dart.domain.AppUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private static final String STATE_ATTR = "oauthState";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final KakaoOAuthClient kakao;
    private final SessionService sessions;
    private final KakaoProperties props;

    public AuthController(KakaoOAuthClient kakao, SessionService sessions, KakaoProperties props) {
        this.kakao = kakao;
        this.sessions = sessions;
        this.props = props;
    }

    /** 카카오 인가 페이지로 보낸다. state는 서버 세션에 담아 콜백에서 대조한다(CSRF 방어). */
    @GetMapping("/kakao/login")
    public ResponseEntity<Void> login(HttpSession session) {
        byte[] b = new byte[16];
        RANDOM.nextBytes(b);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        session.setAttribute(STATE_ATTR, state);

        return ResponseEntity.status(302)
                .location(URI.create(kakao.authorizeUrl(state)))
                .build();
    }

    @GetMapping("/kakao/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(required = false) String error,
                                         HttpSession session) {
        String expected = (String) session.getAttribute(STATE_ATTR);
        session.removeAttribute(STATE_ATTR);

        if (error != null) {
            log.warn("카카오 로그인 거부 error={}", error);
            return redirect("/?login=denied", null);
        }
        if (code == null || state == null || expected == null || !expected.equals(state)) {
            log.warn("state 불일치 또는 code 누락");
            return redirect("/?login=failed", null);
        }

        try {
            String accessToken = kakao.exchangeCodeForAccessToken(code);
            var kakaoUser = kakao.fetchUser(accessToken);
            // 카카오 액세스 토큰은 여기서 버린다 — 이후 카카오 API를 호출하지 않는다
            AppUser user = sessions.upsertUser(kakaoUser);
            String token = sessions.issue(user.getId());
            return redirect("/", sessions.cookie(token, false).toString());
        } catch (Exception e) {
            log.error("카카오 로그인 처리 실패", e);
            return redirect("/?login=failed", null);
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest req,
                                                      HttpServletResponse res) {
        AuthInterceptor.readCookie(req).ifPresent(sessions::revoke);
        res.addHeader(HttpHeaders.SET_COOKIE, sessions.cookie(null, true).toString());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/me")
    public Map<String, Object> me(@CurrentUser AppUser user) {
        if (user == null) return Map.of("authenticated", false);
        return Map.of(
                "authenticated", true,
                "nickname", user.getNickname() == null ? "" : user.getNickname(),
                "profileImage", user.getProfileImage() == null ? "" : user.getProfileImage(),
                "admin", user.isAdmin());
    }

    private ResponseEntity<Void> redirect(String path, String setCookie) {
        var b = ResponseEntity.status(302).location(URI.create(props.appBaseUrl() + path));
        if (setCookie != null) b.header(HttpHeaders.SET_COOKIE, setCookie);
        return b.build();
    }
}
