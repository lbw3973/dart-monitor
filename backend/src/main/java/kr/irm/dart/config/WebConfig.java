package kr.irm.dart.config;

import kr.irm.dart.auth.AdminGuard;
import kr.irm.dart.auth.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;

import java.util.List;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final AdminGuard adminGuard;
    private final KakaoProperties kakao;

    public WebConfig(AuthInterceptor authInterceptor, AdminGuard adminGuard, KakaoProperties kakao) {
        this.authInterceptor = authInterceptor;
        this.adminGuard = adminGuard;
        this.kakao = kakao;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(authInterceptor);
    }

    /**
     * 관리자 API는 경로 단위로 막는다.
     * 위 addArgumentResolvers 는 @CurrentUser 주입만 할 뿐 아무것도 막지 않는다 —
     * 그것만 있던 동안 /api/admin/** 이 통째로 열려 있었다.
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminGuard).addPathPatterns("/api/admin/**");
    }

    /**
     * 자기 도메인을 반드시 넣어야 한다 — "운영은 같은 출처라 CORS가 필요 없다"가 아니다.
     *
     * 브라우저는 GET·HEAD가 아닌 요청이면 같은 출처라도 Origin 헤더를 붙이고,
     * Spring은 Origin 헤더가 있으면 그것만으로 CORS 요청으로 판정한다(CorsUtils.isCorsRequest).
     * 그래서 허용 목록에 자기 도메인이 없으면 운영에서 POST·PUT·DELETE가 컨트롤러에 닿기도 전에
     * 403 "Invalid CORS request"로 끊긴다. 로그아웃과 즐겨찾기가 여기 걸렸다.
     * 조회(GET)는 Origin이 붙지 않아 멀쩡하므로 한참 뒤에야 드러난다.
     *
     * app-base-url 은 운영 compose에서 https://${DOMAIN} 으로 주입된다 — Caddy가 서빙하는
     * 주소와 같은 변수에서 나오므로 실제 Origin과 어긋날 수 없다.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(kakao.appBaseUrl(), "http://localhost:5173", "http://127.0.0.1:5173")
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowCredentials(true);
    }
}
