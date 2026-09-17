import { useState } from "react";
import type { Consent } from "../analytics";
import { analyticsAvailable, readConsent, saveConsent } from "../analytics";

/**
 * 방문 통계 쿠키 동의 배너.
 *
 * 측정 ID가 없는 빌드이거나 이미 선택한 방문자에게는 렌더링하지 않는다.
 *
 * 화면에 떠 있는 오버레이가 아니라 앱 셸의 한 행이다.
 * fixed 로 깔았더니 하단에 고정된 것들 — 목록 페이지네이션과 의견 바 — 을 통째로 덮어서,
 * 첫 방문자는 다음 페이지로 넘어갈 수도, 의견 기능이 있다는 것도 알 수 없었다.
 * 흐름 안에 두면 본문을 밀어 올릴 뿐 아무것도 가리지 않으므로 크게 잡아도 안전하다.
 */
export function ConsentBanner() {
  const [choice, setChoice] = useState<Consent | null>(() => readConsent());

  if (!analyticsAvailable || choice) return null;

  const decide = (c: Consent) => {
    saveConsent(c);
    setChoice(c);
  };

  return (
    <div
      role="dialog"
      aria-label="방문 통계 쿠키 사용 동의"
      className="shrink-0 border-t-2 border-sky-500 bg-sky-50 px-4 py-3 sm:px-5 dark:border-sky-600 dark:bg-sky-950/60"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
          서비스 개선을 위해 <b className="font-semibold">Google Analytics 쿠키</b>로 방문 통계를
          수집합니다. 공시 열람 내용이나 저장목록은 수집하지 않습니다.
        </p>

        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <button
            onClick={() => decide("denied")}
            className="flex-1 cursor-pointer rounded border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 sm:flex-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            거부
          </button>
          <button
            onClick={() => decide("granted")}
            className="flex-1 cursor-pointer rounded bg-sky-600 px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 sm:flex-none"
          >
            동의
          </button>
        </div>
      </div>
    </div>
  );
}
