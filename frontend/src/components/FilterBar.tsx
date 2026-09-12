import { useState } from "react";
import { KAKAO_LOGIN_URL } from "../api";
import type { Group, Me, ReportType } from "../types";
import { GROUP_LABEL, GROUP_TYPES, REPORT_TYPE_LABEL } from "../types";

interface Props {
  group: Group | "";
  type: ReportType | "";
  q: string;
  from: string;
  to: string;
  total: number;
  live: boolean;
  streamConnected: boolean;
  me: Me | undefined;
  tab: "all" | "saved";
  onChange: (patch: {
    group?: Group | "";
    type?: ReportType | "";
    q?: string;
    from?: string;
    to?: string;
  }) => void;
  onToggleLive: () => void;
  onTab: (t: "all" | "saved") => void;
  onHome: () => void;
  onLogout: () => void;
}

const GROUPS: Group[] = ["equity", "periodic"];

const INPUT =
  "h-8 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function FilterBar({
  group, type, q, from, to, total, live, streamConnected, me, tab,
  onChange, onToggleLive, onTab, onLogout, onHome,
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
          DART <span className="hidden sm:inline">지분공시</span>
        </button>

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

        {/* 데스크톱: 필터를 1행에 펼친다 */}
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <FilterInputs group={group} type={type} q={q} from={from} to={to} onChange={onChange} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
            {total.toLocaleString()}건
          </span>

          {me?.authenticated ? (
            <div className="flex items-center gap-1">
              <span className="hidden max-w-20 truncate text-xs text-slate-600 dark:text-slate-300 sm:inline">
                {me.nickname || "사용자"}
              </span>
              <button
                onClick={onLogout}
                className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <a
              href={KAKAO_LOGIN_URL}
              className="rounded bg-[#FEE500] px-2 py-1 text-xs font-medium whitespace-nowrap text-[#191600] hover:brightness-95"
            >
              카카오<span className="hidden sm:inline"> 로그인</span>
            </a>
          )}

          <button
            onClick={onToggleLive}
            title={
              !live ? "실시간 수신 꺼짐"
                : streamConnected ? "실시간 수신 중 (SSE)"
                : "SSE 끊김 — 30초 폴링으로 대체 중"
            }
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium transition ${
              live
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                !live ? "bg-slate-400" : streamConnected ? "animate-pulse bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="hidden sm:inline">{live && !streamConnected ? "POLL" : "LIVE"}</span>
          </button>

          {/* 모바일: 필터 토글 */}
          <button
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 lg:hidden dark:border-slate-600 dark:text-slate-300"
          >
            필터 {open ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* 2행: 모바일에서만, 토글로 펼친다 */}
      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 lg:hidden dark:border-slate-800">
          <FilterInputs group={group} type={type} q={q} from={from} to={to} onChange={onChange} />
          <span className="ml-auto text-xs text-slate-500">{total.toLocaleString()}건</span>
        </div>
      )}
    </header>
  );
}

function FilterInputs({
  group, type, q, from, to, onChange,
}: Pick<Props, "group" | "type" | "q" | "from" | "to" | "onChange">) {
  return (
    <>
      {/* 1단 — 공시 그룹. 바꾸면 2단을 비운다 (그룹 간 유형이 호환되지 않는다) */}
      <select
        value={group}
        onChange={e => onChange({ group: e.target.value as Group | "", type: "" })}
        className={INPUT}
        aria-label="공시 그룹"
      >
        <option value="">전체 공시</option>
        {GROUPS.map(g => (
          <option key={g} value={g}>
            {GROUP_LABEL[g]}
          </option>
        ))}
      </select>

      {/* 2단 — 상세 유형. 그룹을 고르지 않았으면 고를 것이 없으므로 감춘다 */}
      {group && (
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
      )}

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
