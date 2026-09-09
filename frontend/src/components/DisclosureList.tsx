import type { DisclosureSummary } from "../types";
import { REPORT_TYPE_LABEL, REPORT_TYPE_STYLE } from "../types";
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
          <li key={d.rceptNo}>
            <button
              onClick={() => onSelect(d.rceptNo)}
              className={`flex w-full min-w-0 flex-col gap-1 px-3 py-2 text-left transition ${
                active
                  ? "bg-sky-50 dark:bg-sky-950"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${REPORT_TYPE_STYLE[d.reportType]}`}>
                  {REPORT_TYPE_LABEL[d.reportType]}
                </span>
                {d.correction && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
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
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-slate-400">
                  {d.rceptDt.slice(5)}
                </span>
                <StarButton marked={d.bookmarked} onToggle={() => onToggleBookmark(d)} />
              </div>

              <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {d.corpName}
                {d.stockCode && (
                  <span className="ml-1.5 text-[10px] font-normal tabular-nums text-slate-400">
                    {d.stockCode}
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {d.flrNm ?? "-"}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
