package kr.irm.dart.auth;

import java.lang.annotation.*;

/** 컨트롤러 파라미터에 현재 로그인 사용자를 주입한다. 비로그인이면 null. */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CurrentUser {}
