import { useState } from "react";
import type { Consent } from "../analytics";
import { analyticsAvailable, readConsent, saveConsent } from "../analytics";

/**
 * 방문 통계 쿠키 동의 배너.
 *
 * 측정 ID가 없는 빌드이거나 이미 선택한 방문자에게는 렌더링하지 않는다.
 * Toast(z-50)보다 아래에 깔아 알림이 가려지지 않게 한다.
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          서비스 개선을 위해 Google Analytics 쿠키로 방문 통계를 수집합니다. 공시 열람 내용이나
          저장목록은 수집하지 않습니다.
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide("denied")}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            거부
          </button>
          <button
            onClick={() => decide("granted")}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            동의
          </button>
        </div>
      </div>
    </div>
  );
}
