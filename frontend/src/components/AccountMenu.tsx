import { useEffect, useRef, useState } from "react";
import type { Me } from "../types";

interface Props {
  me: Me;
  onAdmin: () => void;
  onLogout: () => void;
}

/**
 * 닉네임 옆 계정 메뉴.
 *
 * 로그아웃은 원래 헤더에 따로 나와 있었는데, 관리자에게 항목이 하나 더 붙으면서
 * 버튼 두 개가 나란히 서는 모양이 됐다. 계정과 관련된 건 여기로 모은다.
 */
export function AccountMenu({ me, onAdmin, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc 로 닫는다 — 메뉴는 뜬 채로 남으면 안 된다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    addEventListener("mousedown", onDown);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("mousedown", onDown);
      removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {/* 모바일에서도 보여야 한다 — 숨기면 화살표만 남아 무엇을 여는 버튼인지 알 수 없다 */}
        <span className="max-w-14 truncate sm:max-w-20">{me.nickname || "사용자"}</span>
        {/* 배지는 좁은 화면에서 접는다 — 닉네임이 먼저고, 관리자인지는 메뉴를 열면 드러난다 */}
        {me.admin && (
          <span className="hidden rounded bg-sky-100 px-1 text-[9px] font-medium text-sky-700 sm:ml-0.5 sm:inline dark:bg-sky-900 dark:text-sky-200">
            관리자
          </span>
        )}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-32 overflow-hidden rounded border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {me.admin && (
            <Item onClick={run(onAdmin)}>관리자 페이지</Item>
          )}
          <Item onClick={run(onLogout)}>로그아웃</Item>
        </div>
      )}
    </div>
  );
}

function Item({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs whitespace-nowrap text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {children}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
