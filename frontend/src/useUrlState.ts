import { useCallback, useEffect, useRef, useState } from "react";
import type { Group, ReportType } from "./types";
import { DEFAULT_GROUP, groupOf } from "./types";

export type Tab = "all" | "saved";

export interface ViewState {
  tab: Tab;
  /** 1단: 공시 그룹. 항상 하나가 선택돼 있다 */
  group: Group;
  /** 2단: 상세 유형. 비어 있으면 그룹 전체 */
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
  const type = (p.get("type") as ReportType) ?? "";
  return {
    tab: p.get("tab") === "saved" ? "saved" : "all",
    // group 없이 type만 담긴 공유 링크도 2단이 올바르게 열리도록 유형에서 되짚는다
    group: (p.get("group") as Group) ?? groupOf(type),
    type,
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
  // 저장목록은 유형·날짜 필터를 적용하지 않으므로 주소에도 싣지 않는다
  if (s.tab === "all") {
    // type이 있으면 group을 되짚을 수 있고, 기본 그룹도 생략한다 (주소를 짧게)
    if (s.group !== DEFAULT_GROUP && !s.type) p.set("group", s.group);
    if (s.type) p.set("type", s.type);
  }
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
  // 우리가 쌓은 히스토리 깊이. 공유 링크로 바로 들어온 경우 0 이므로
  // 뒤로가기를 눌러도 브라우저를 벗어나지 않게 판단할 수 있다.
  const [depth, setDepth] = useState<number>(() => history.state?.dartDepth ?? 0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onPop = () => {
      setState(parse(location.search));
      setDepth(history.state?.dartDepth ?? 0);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  const update = useCallback((patch: Partial<ViewState>, replace = false) => {
    const next = { ...stateRef.current, ...patch };
    const url = stringify(next);
    const cur = location.pathname + location.search;
    const target = url.startsWith("?") ? location.pathname + url : url;

    if (target !== cur) {
      const d = (history.state?.dartDepth ?? 0) + (replace ? 0 : 1);
      if (replace) history.replaceState({ dartDepth: d }, "", url);
      else history.pushState({ dartDepth: d }, "", url);
      setDepth(d);
    }
    setState(next);
  }, []);

  /** 앱 안에서 뒤로 갈 곳이 있으면 뒤로, 없으면(공유 링크 진입 등) 홈으로 */
  const goBack = useCallback(() => {
    if ((history.state?.dartDepth ?? 0) > 0) history.back();
    else update({ selected: null }, true);
  }, [update]);

  /** 헤더 로고 — 필터·선택을 모두 비우고 처음 화면으로 */
  const goHome = useCallback(() => {
    const range = defaultRange();
    update({ tab: "all", group: DEFAULT_GROUP, type: "", q: "", ...range, page: 0, selected: null });
  }, [update]);

  return { state, update, goBack, goHome, depth } as const;
}
