import { useEffect, useState } from "react";
import type { DisclosureSummary } from "../types";
import { REPORT_TYPE_LABEL } from "../types";

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: { sendDefault: (o: unknown) => void };
    };
  }
}

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

/** 카카오 SDK를 처음 쓸 때만 불러온다. 키가 없으면 버튼 자체를 숨긴다. */
function loadKakao(): Promise<boolean> {
  if (!KAKAO_JS_KEY) return Promise.resolve(false);
  if (window.Kakao?.isInitialized()) return Promise.resolve(true);

  return new Promise(resolve => {
    const done = () => {
      try {
        if (!window.Kakao) return resolve(false);
        if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
        resolve(true);
      } catch {
        resolve(false);
      }
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) { existing.addEventListener("load", done); return; }

    const el = document.createElement("script");
    el.src = SDK_SRC;
    el.integrity = "";
    el.crossOrigin = "anonymous";
    el.onload = done;
    el.onerror = () => resolve(false);
    document.head.appendChild(el);
  });
}

/**
 * 주소를 클립보드에 넣는다.
 *
 * navigator.clipboard 는 문서에 포커스가 없으면 거부하지 않고 그냥 멈추는 경우가 있다.
 * 그러면 버튼이 아무 반응 없는 것처럼 보이므로 타임아웃을 두고 폴백으로 넘어간다.
 * (clipboard API 는 https 또는 localhost 에서만 쓸 수 있기도 하다)
 */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 800)),
      ]);
      return true;
    } catch {
      /* 아래 폴백으로 */
    }
  }
  return legacyCopy(text);
}

/** 구식이지만 포커스 제약이 덜하고 http 에서도 동작한다. */
function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

interface Props {
  disclosure: DisclosureSummary;
  onNotice: (msg: string, tone?: "info" | "warn") => void;
}

export function ShareMenu({ disclosure: d, onNotice }: Props) {
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => { loadKakao().then(setKakaoReady); }, []);

  const url = location.href;
  const title = `${d.corpName} · ${REPORT_TYPE_LABEL[d.reportType]}`;
  const desc = `제출인 ${d.flrNm ?? "-"} · ${d.rceptDt}`;

  const copy = async () => {
    const ok = await copyText(url);
    if (ok) onNotice("주소를 복사했습니다.");
    else onNotice("복사에 실패했습니다. 주소창에서 직접 복사해 주세요.", "warn");
  };

  const shareKakao = () => {
    if (!window.Kakao?.isInitialized()) {
      onNotice("카카오 공유를 사용할 수 없습니다.", "warn");
      return;
    }
    // 링크는 카카오 콘솔의 [플랫폼 > Web > 사이트 도메인]에 등록된 주소여야 열린다.
    // localhost 로 공유하면 받는 쪽에서 열 수 없다.
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      onNotice("로컬 주소는 상대방이 열 수 없습니다. 운영 주소에서 공유해 주세요.", "warn");
      return;
    }
    window.Kakao.Share.sendDefault({
      objectType: "text",
      text: `${title}\n${desc}`,
      link: { mobileWebUrl: url, webUrl: url },
      // 탭할 곳을 명확히 한다 — 텍스트만 있으면 링크인지 모르는 경우가 있다
      buttons: [{ title: "공시 보기", link: { mobileWebUrl: url, webUrl: url } }],
    });
  };

  // 모바일 브라우저의 기본 공유 시트 (카카오톡·메시지 등이 함께 뜬다)
  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: desc, url });
    } catch {
      /* 사용자가 취소한 경우 — 조용히 넘어간다 */
    }
  };

  const btn =
    "rounded px-1.5 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800";

  return (
    <div className="flex items-center gap-0.5">
      <button onClick={copy} className={btn} title="주소 복사">
        🔗<span className="ml-0.5 hidden sm:inline">복사</span>
      </button>

      {kakaoReady && (
        <button onClick={shareKakao} className={btn} title="카카오톡 공유">
          💬<span className="ml-0.5 hidden sm:inline">카카오톡</span>
        </button>
      )}

      {typeof navigator.share === "function" && (
        <button onClick={nativeShare} className={btn} title="공유">
          ↗<span className="ml-0.5 hidden sm:inline">공유</span>
        </button>
      )}
    </div>
  );
}
