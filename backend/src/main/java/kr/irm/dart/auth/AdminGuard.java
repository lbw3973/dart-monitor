package kr.irm.dart.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import kr.irm.dart.domain.AppUser;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

/**
 * /api/admin/** 문지기.
 *
 * 이게 없던 동안 관리자 API는 누구에게나 열려 있었다 — WebConfig 가 AuthInterceptor 를
 * 인자 리졸버로만 등록했고(@CurrentUser 주입용), 경로 인터셉터로는 걸지 않았기 때문이다.
 * 컨트롤러마다 검사를 반복하지 않도록 경로 단위로 한 번에 막는다.
 */
@Component
public class AdminGuard implements HandlerInterceptor {

    private final AuthInterceptor auth;

    public AdminGuard(AuthInterceptor auth) {
        this.auth = auth;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler)
            throws Exception {
        // CORS 예비요청은 쿠키 없이 오므로 통과시킨다 — 실제 요청에서 다시 걸린다
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) return true;

        Optional<AppUser> user = auth.currentUser(req);
        if (user.isEmpty()) {
            res.sendError(HttpServletResponse.SC_UNAUTHORIZED, "로그인이 필요합니다");
            return false;
        }
        if (!user.get().isAdmin()) {
            res.sendError(HttpServletResponse.SC_FORBIDDEN, "관리자만 접근할 수 있습니다");
            return false;
        }
        return true;
    }
}
