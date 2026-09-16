import type { DisclosureSummary } from "../types";
import { REPORT_TYPE_LABEL } from "../types";

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
  const url = location.href;
  const title = `${d.corpName} · ${REPORT_TYPE_LABEL[d.reportType]}`;
  const desc = `제출인 ${d.flrNm ?? "-"} · ${d.rceptDt}`;

  const copy = async () => {
    const ok = await copyText(url);
    if (ok) onNotice("주소를 복사했습니다.");
    else onNotice("복사에 실패했습니다. 주소창에서 직접 복사해 주세요.", "warn");
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
    "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800";

  return (
    <div className="flex items-center gap-0.5">
      <button onClick={copy} className={btn} title="주소 복사">
        <LinkIcon />
        <span className="hidden sm:inline">복사</span>
      </button>

      {typeof navigator.share === "function" && (
        <button onClick={nativeShare} className={btn} title="공유">
          <SendIcon />
          <span className="hidden sm:inline">공유</span>
        </button>
      )}
    </div>
  );
}

// 버튼 글자색(text-slate-500 / hover / dark)을 그대로 따라가도록 currentColor 로 그린다.
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-3.5 w-3.5",
  "aria-hidden": true,
} as const;

function LinkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}
