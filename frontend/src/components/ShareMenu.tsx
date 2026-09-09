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

interface Props {
  disclosure: DisclosureSummary;
  onNotice: (msg: string) => void;
}

export function ShareMenu({ disclosure: d, onNotice }: Props) {
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => { loadKakao().then(setKakaoReady); }, []);

  const url = location.href;
  const title = `${d.corpName} · ${REPORT_TYPE_LABEL[d.reportType]}`;
  const desc = `제출인 ${d.flrNm ?? "-"} · ${d.rceptDt}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onNotice("주소를 복사했습니다.");
    } catch {
      // clipboard API는 https 또는 localhost에서만 동작한다
      onNotice("복사에 실패했습니다. 주소창에서 직접 복사해 주세요.");
    }
  };

  const shareKakao = () => {
    if (!window.Kakao?.isInitialized()) { onNotice("카카오 공유를 사용할 수 없습니다."); return; }
    window.Kakao.Share.sendDefault({
      objectType: "text",
      text: `${title}\n${desc}`,
      link: { mobileWebUrl: url, webUrl: url },
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
