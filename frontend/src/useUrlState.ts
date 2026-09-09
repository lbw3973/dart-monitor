import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportType } from "./types";

export type Tab = "all" | "saved";

export interface ViewState {
  tab: Tab;
  type: ReportType | "";
  q: string;
  from: string;
  to: string;
  page: number;
  selected: string | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 기본 검색 기간: 오늘 포함 최근 7일 */
function defaultRange() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  return { from: ymd(weekAgo), to: ymd(today) };
}

function parse(search: string): ViewState {
  const p = new URLSearchParams(search);
  const range = defaultRange();
  return {
    tab: p.get("tab") === "saved" ? "saved" : "all",
    type: (p.get("type") as ReportType) ?? "",
    q: p.get("q") ?? "",
    from: p.get("from") ?? range.from,
    to: p.get("to") ?? range.to,
    page: Math.max(0, Number(p.get("page") ?? 0) || 0),
    selected: p.get("sel"),
  };
}

/** 기본값과 같은 항목은 URL에서 뺀다 — 주소가 짧고 읽기 쉬워진다. */
function stringify(s: ViewState): string {
  const range = defaultRange();
  const p = new URLSearchParams();
  if (s.tab !== "all") p.set("tab", s.tab);
  if (s.type) p.set("type", s.type);
  if (s.q.trim()) p.set("q", s.q.trim());
  if (s.from !== range.from) p.set("from", s.from);
  if (s.to !== range.to) p.set("to", s.to);
  if (s.page > 0) p.set("page", String(s.page));
  if (s.selected) p.set("sel", s.selected);
  const qs = p.toString();
  return qs ? `?${qs}` : location.pathname;
}

/**
 * 화면 상태를 URL 쿼리스트링과 동기화한다.
 *
 * 이렇게 하지 않으면 브라우저에는 페이지가 하나뿐이라
 * 상세를 보다 뒤로가기를 누르면 사이트를 벗어난다.
 *
 * push  — 목록↔상세, 페이지 이동, 탭 전환 (뒤로가기로 되돌아와야 하는 것)
 * replace — 필터 변경 (검색어는 타이핑마다 바뀌어 히스토리를 더럽힌다)
 */
export function useUrlState() {
  const [state, setState] = useState<ViewState>(() => parse(location.search));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onPop = () => setState(parse(location.search));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((patch: Partial<ViewState>, replace = false) => {
    const next = { ...stateRef.current, ...patch };
    const url = stringify(next);
    if (url !== location.search && url !== location.pathname + location.search) {
      if (replace) history.replaceState(null, "", url);
      else history.pushState(null, "", url);
    }
    setState(next);
  }, []);

  return [state, update] as const;
}
