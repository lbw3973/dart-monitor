import { useEffect, useState } from "react";

export interface ToastMessage {
  text: string;
  /** 함께 보여줄 링크 (예: 로그인 유도) */
  action?: { label: string; href: string };
  tone?: "info" | "warn";
}

interface Props {
  message: ToastMessage | null;
  onDismiss: () => void;
  /** 자동 해제까지의 시간(ms). 액션이 있으면 좀 더 길게 둔다. */
  duration?: number;
}

export function Toast({ message, onDismiss, duration }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) { setVisible(false); return; }
    // 마운트 직후 한 프레임 뒤에 켜야 트랜지션이 걸린다
    const raf = requestAnimationFrame(() => setVisible(true));
    const ms = duration ?? (message.action ? 6000 : 2500);
    const hide = setTimeout(() => setVisible(false), ms);
    const remove = setTimeout(onDismiss, ms + 200);   // 사라지는 애니메이션만큼 늦춘다
    return () => { cancelAnimationFrame(raf); clearTimeout(hide); clearTimeout(remove); };
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const warn = message.tone === "warn";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div
        className={`pointer-events-auto flex max-w-[90vw] items-center gap-3 rounded-lg px-4 py-2.5 text-xs shadow-lg ${
          warn
            ? "bg-amber-600 text-white"
            : "bg-slate-800 text-slate-50 dark:bg-slate-700"
        }`}
      >
        <span className="truncate">{message.text}</span>

        {message.action && (
          <a
            href={message.action.href}
            className="shrink-0 rounded bg-[#FEE500] px-2 py-0.5 font-medium whitespace-nowrap text-[#191600] hover:brightness-95"
          >
            {message.action.label}
          </a>
        )}

        <button
          onClick={onDismiss}
          aria-label="닫기"
          className="shrink-0 text-base leading-none opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
