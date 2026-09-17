import { useState } from "react";
import { KAKAO_LOGIN_URL } from "../api";
import { AccountMenu } from "./AccountMenu";
import type { Group, Me, ReportType } from "../types";
import { GROUP_LABEL, GROUP_TYPES, REPORT_TYPE_LABEL } from "../types";

interface Props {
  group: Group;
  type: ReportType | "";
  q: string;
  from: string;
  to: string;
  total: number;
  me: Me | undefined;
  tab: "all" | "saved";
  onChange: (patch: {
    group?: Group;
    type?: ReportType | "";
    q?: string;
    from?: string;
    to?: string;
  }) => void;
  onTab: (t: "all" | "saved") => void;
  onHome: () => void;
  onLogout: () => void;
  onAdmin: () => void;
  /**
   * 관리자 페이지에서는 로고와 계정 메뉴만 남긴다.
   * 검색·기간·공시그룹은 목록에만 해당하는 것들이라 그대로 두면
   * 눌러도 아무 일이 없는 조작부가 화면 위에 남는다.
   */
  minimal?: boolean;
}

const GROUPS: Group[] = ["equity", "periodic"];

/** Makefile의 FRONTEND_VERSION 이 빌드 시 주입된다(§vite.config.ts). */
const APP_VERSION = import.meta.env.VITE_APP_VERSION as string | undefined;

const INPUT =
  "h-8 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function FilterBar({
  group, type, q, from, to, total, me, tab,
  onChange, onTab, onLogout, onHome, onAdmin, minimal,
}: Props) {
  const [open, setOpen] = useState(false);   // 모바일에서 필터 접기

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* 1행: 항상 보인다 */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <button
          onClick={onHome}
          title="처음 화면으로"
          className="shrink-0 rounded px-1 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          DART
        </button>
        {APP_VERSION && (
          <span
            title="프론트엔드 버전"
            className="-ml-0.5 shrink-0 text-[10px] tabular-nums text-slate-400 dark:text-slate-600"
          >
            v{APP_VERSION}
          </span>
        )}

        {!minimal && (
        <div className="flex shrink-0 rounded bg-slate-100 p-0.5 dark:bg-slate-800">
          {(["all", "saved"] as const).map(t => (
            <button
              key={t}
              onClick={() => onTab(t)}
              className={`rounded px-2 py-1 text-xs font-medium whitespace-nowrap transition ${
                tab === t
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {t === "all" ? "전체" : "★"}
              <span className="hidden sm:inline">{t === "saved" && " 내 저장목록"}</span>
            </button>
          ))}
        </div>
        )}

        {/* 데스크톱: 날짜·검색을 1행에 펼친다. 그룹 탭은 2행 전용이다 */}
        {!minimal && (
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <DateSearch q={q} from={from} to={to} onChange={onChange} />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!minimal && (
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
              {total.toLocaleString()}건
            </span>
          )}

          {me?.authenticated ? (
            <AccountMenu me={me} onAdmin={onAdmin} onLogout={onLogout} />
          ) : (
            <a
              href={KAKAO_LOGIN_URL}
              className="rounded bg-[#FEE500] px-2 py-1 text-xs font-medium whitespace-nowrap text-[#191600] hover:brightness-95"
            >
              카카오<span className="hidden sm:inline"> 로그인</span>
            </a>
          )}

          {/* 모바일: 필터 토글 */}
          {!minimal && (
            <button
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 lg:hidden dark:border-slate-600 dark:text-slate-300"
            >
              필터 {open ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>

      {/* 2행: 공시 그룹 탭 + 상세 유형. 저장목록은 필터를 적용하지 않으므로 감춘다 */}
      {!minimal && tab === "all" && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 sm:px-4 dark:border-slate-800">
          <div className="flex shrink-0 rounded bg-slate-100 p-0.5 dark:bg-slate-800">
            {GROUPS.map(g => (
              <button
                key={g}
                onClick={() => onChange({ group: g, type: "" })}
                className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                  group === g
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>

          <select
            value={type}
            onChange={e => onChange({ type: e.target.value as ReportType | "" })}
            className={INPUT}
            aria-label="상세 유형"
          >
            <option value="">{GROUP_LABEL[group]} 전체</option>
            {GROUP_TYPES[group].map(t => (
              <option key={t} value={t}>
                {REPORT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3행: 모바일에서만, 토글로 펼친다 */}
      {!minimal && open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 lg:hidden dark:border-slate-800">
          <DateSearch q={q} from={from} to={to} onChange={onChange} />
          <span className="ml-auto text-xs text-slate-500">{total.toLocaleString()}건</span>
        </div>
      )}
    </header>
  );
}

function DateSearch({
  q, from, to, onChange,
}: Pick<Props, "q" | "from" | "to" | "onChange">) {
  return (
    <>
      <input type="date" value={from} onChange={e => onChange({ from: e.target.value })} className={INPUT} />
      <span className="text-xs text-slate-400">~</span>
      <input type="date" value={to} onChange={e => onChange({ to: e.target.value })} className={INPUT} />

      <input
        type="search"
        value={q}
        placeholder="회사명 · 제출인"
        onChange={e => onChange({ q: e.target.value })}
        className={`${INPUT} min-w-0 flex-1 sm:w-44 sm:flex-none`}
      />
    </>
  );
}
