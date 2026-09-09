/**
 * Google Analytics 4.
 *
 * 동의한 방문자에게만 gtag.js 를 내려받는다 — 동의 전에는 요청 자체가 나가지 않는다.
 * 측정 ID가 없으면(로컬 개발) 전부 no-op 이므로 개발 트래픽이 통계에 섞이지 않는다.
 */

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;
const CONSENT_KEY = "dart:analytics-consent";

export type Consent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * 측정 ID가 주입된 운영 빌드인지. 배너를 띄울지 판단하는 데 쓴다.
 *
 * vite.config 의 envDir 이 루트라 `pnpm dev` 도 .env 의 측정 ID를 읽는다.
 * PROD 가드가 없으면 개발 트래픽이 그대로 집계된다.
 * 배너·수집 동작을 직접 확인하려면 `pnpm build && npx vite preview` 로 띄운다.
 */
export const analyticsAvailable = !!GA_ID && import.meta.env.PROD;

/** 시크릿 모드 등에서 localStorage 접근이 막힐 수 있으므로 실패를 삼킨다. */
export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(c: Consent) {
  try {
    localStorage.setItem(CONSENT_KEY, c);
  } catch {
    // 저장에 실패해도 이번 방문에는 선택이 반영된다. 다음 방문에 배너가 다시 뜰 뿐이다.
  }
  if (c === "granted") {
    loadGa();
    // 동의 시점의 화면은 페이지뷰가 비어 있다. App 의 이동 감지 effect 는
    // 의존성이 그대로라 다시 돌지 않으므로 여기서 첫 조회를 한 번 보낸다.
    trackPageView();
  }
}

let loaded = false;

/** 동의를 확인한 뒤에만 호출한다. */
function loadGa() {
  if (loaded || !analyticsAvailable) return;
  loaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function () {
    // gtag 는 arguments 객체를 그대로 요구한다 — 배열로 바꾸면 동작하지 않는다
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // 페이지가 하나뿐인 SPA다. 자동 page_view 를 켜두면 필터 replaceState 마다
  // 조회가 쌓이므로 끄고 trackPageView() 로 직접 보낸다.
  window.gtag("config", GA_ID, { send_page_view: false });
}

/** 앱 시작 시 한 번. 이전 방문에서 동의한 사용자만 곧바로 로드된다. */
export function initAnalytics() {
  if (readConsent() === "granted") loadGa();
}

export function trackPageView() {
  window.gtag?.("event", "page_view", {
    page_location: location.href,
    page_path: location.pathname + location.search,
    // 신규 공시 개수 접두사를 떼어낸다 — "(3) DART 지분공시" 가 별도 페이지로 잡히면 곤란하다
    page_title: document.title.replace(/^\(\d+\)\s*/, ""),
  });
}
