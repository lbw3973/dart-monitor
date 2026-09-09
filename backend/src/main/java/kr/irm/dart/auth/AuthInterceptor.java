package kr.irm.dart.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import kr.irm.dart.domain.AppUser;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.Arrays;
import java.util.Optional;

@Component
public class AuthInterceptor implements HandlerMethodArgumentResolver {

    private static final String ATTR = "currentUser";

    private final SessionService sessions;

    public AuthInterceptor(SessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    public boolean supportsParameter(MethodParameter p) {
        return p.hasParameterAnnotation(CurrentUser.class)
                && AppUser.class.isAssignableFrom(p.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav,
                                  NativeWebRequest req, WebDataBinderFactory binder) {
        HttpServletRequest http = req.getNativeRequest(HttpServletRequest.class);
        return http == null ? null : currentUser(http).orElse(null);
    }

    public Optional<AppUser> currentUser(HttpServletRequest req) {
        Object cached = req.getAttribute(ATTR);
        if (cached instanceof AppUser u) return Optional.of(u);
        if (Boolean.TRUE.equals(req.getAttribute(ATTR + ":none"))) return Optional.empty();

        Optional<AppUser> user = readCookie(req).flatMap(sessions::resolve);
        user.ifPresentOrElse(u -> req.setAttribute(ATTR, u),
                () -> req.setAttribute(ATTR + ":none", true));
        return user;
    }

    public static Optional<String> readCookie(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return Optional.empty();
        return Arrays.stream(cookies)
                .filter(c -> SessionService.COOKIE.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst();
    }
}
