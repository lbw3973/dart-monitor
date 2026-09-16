interface Props {
  commentCount?: number;
  onOpen: () => void;
}

/**
 * 상세 패널 맨 아래 고정되는 집계 바.
 *
 * 본문을 어디까지 스크롤했든 같은 자리에 있어야 한다 — 정기공시는 표가 수십 개라
 * 본문 끝에 의견을 두면 아무도 도달하지 못한다.
 * iOS 는 주소창이 화면 바닥에 붙으므로 safe-area 만큼 아래를 더 띄운다.
 */
export function CommentBar({ commentCount, onOpen }: Props) {
  return (
    <button
      onClick={onOpen}
      aria-label="의견 열기"
      className="flex w-full shrink-0 cursor-pointer items-center gap-4 border-t border-slate-200 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-left transition hover:bg-slate-50 sm:px-5 dark:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <ChatIcon />
        의견
        <b className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{commentCount ?? 0}</b>
      </span>

      <span className="ml-auto text-xs font-medium whitespace-nowrap text-sky-600 dark:text-sky-400">
        의견 쓰기 ↑
      </span>
    </button>
  );
}

// ShareMenu 아이콘과 같은 방식 — 글자색을 그대로 따라가도록 currentColor 로 그린다.
export function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.8L3 20.5l1.4-4.1A8.4 8.4 0 0 1 3.6 12a8.4 8.4 0 0 1 8.4-8.5h.5a8.4 8.4 0 0 1 8.5 8Z" />
    </svg>
  );
}
