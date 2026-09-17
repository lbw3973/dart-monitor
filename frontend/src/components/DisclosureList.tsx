import type { DisclosureSummary } from "../types";
import { CORP_CLS_LABEL, CORP_CLS_STYLE, REPORT_TYPE_LABEL, REPORT_TYPE_STYLE } from "../types";
import { ChatIcon } from "./CommentBar";
import { StarButton } from "./StarButton";

interface Props {
  items: DisclosureSummary[];
  selected: string | null;
  loading: boolean;
  emptyText?: string;
  onSelect: (rceptNo: string) => void;
  onToggleBookmark: (d: DisclosureSummary) => void;
}

export function DisclosureList({ items, selected, loading, emptyText, onSelect, onToggleBookmark }: Props) {
  if (!loading && items.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">{emptyText ?? "조건에 맞는 공시가 없습니다."}</div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map(d => {
        const active = d.rceptNo === selected;
        return (
          <li key={d.rceptNo} className="relative">
            <button
              onClick={() => onSelect(d.rceptNo)}
              className={`flex w-full min-w-0 flex-col gap-1 py-2 pl-3 pr-7 text-left transition ${
                active
                  ? "bg-sky-50 dark:bg-sky-950"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${REPORT_TYPE_STYLE[d.reportType]}`}>
                  {REPORT_TYPE_LABEL[d.reportType]}
                </span>
                {/* 정정은 유형이 아니라 수식어다. 유형 배지(채움)와 종류가 다르게 보이도록
                    테두리로 둔다 — 정기공시 배지가 난색이라 채운 배지로는 색이 겹쳤다. */}
                {d.correction && (
                  <span className="shrink-0 rounded border border-amber-500/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/50 dark:text-amber-300">
                    정정
                  </span>
                )}
                {d.parseStatus !== "PARSED" && d.parseStatus !== "PARSED_WITH_WARN" && (
                  <span
                    title={`파싱 상태: ${d.parseStatus}`}
                    className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {d.parseStatus === "FAILED" ? "⚠ 파싱실패" : "수집중"}
                  </span>
                )}
                {/* 의견이 없으면 아예 안 보인다 — 첫 줄이 이미 배지로 빽빽해서
                    0을 늘어놓으면 정작 유형 배지가 묻힌다 */}
                {(d.commentCount ?? 0) > 0 && (
                  <span
                    title={`의견 ${d.commentCount}개`}
                    className="ml-auto flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-slate-400"
                  >
                    <ChatIcon />
                    {d.commentCount}
                  </span>
                )}
                <span
                  className={`shrink-0 text-[10px] tabular-nums text-slate-400 ${
                    (d.commentCount ?? 0) > 0 ? "" : "ml-auto"
                  }`}
                >
                  {d.rceptDt.slice(5)}
                </span>
              </div>

              <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {d.corpName}
                {d.corpCls && (
                  <span className={`ml-1.5 text-[10px] font-medium ${CORP_CLS_STYLE[d.corpCls]}`}>
                    {CORP_CLS_LABEL[d.corpCls]}
                  </span>
                )}
                {d.stockCode && (
                  <span className="ml-1 text-[10px] font-normal tabular-nums text-slate-400">
                    {d.stockCode}
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {d.flrNm ?? "-"}
              </div>
            </button>
            {/* 행 전체가 <button> 이라 별을 그 안에 두면 버튼이 중첩된다(유효하지 않은 HTML).
                절대배치로 빼내 둘 다 진짜 버튼으로 남긴다 — 버튼 오른쪽 여백이 자리다. */}
            <StarButton
              marked={d.bookmarked}
              onToggle={() => onToggleBookmark(d)}
              className="absolute right-2 top-2"
            />
          </li>
        );
      })}
    </ul>
  );
}
