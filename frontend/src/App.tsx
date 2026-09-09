import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  addBookmark, fetchBookmarks, fetchDetail, fetchDisclosures, fetchMe,
  KAKAO_LOGIN_URL, logout, removeBookmark,
} from "./api";
import { DetailPane } from "./components/DetailPane";
import { DisclosureList } from "./components/DisclosureList";
import { FilterBar } from "./components/FilterBar";
import type { DisclosureSummary, ReportType } from "./types";
import { useDisclosureStream } from "./useDisclosureStream";

interface Filters {
  type: ReportType | "";
  q: string;
  from: string;
  to: string;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 기본 검색 기간: 최근 1주일 */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);   // 오늘 포함 7일
  return { from: ymd(weekAgo), to: ymd(today) };
}

type Tab = "all" | "saved";

export default function App() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(() => ({
    type: "", q: "", ...defaultRange(),
  }));
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const authed = meQuery.data?.authenticated ?? false;

  // 로그아웃 상태에서 저장목록 탭에 머물지 않도록
  useEffect(() => {
    if (!authed && tab === "saved") setTab("all");
  }, [authed, tab]);

  // SSE가 살아 있으면 폴링은 불필요하다. 끊기면 자동으로 30초 폴링이 공백을 메운다.
  const streamConnected = useDisclosureStream({
    onNew: n => setNewCount(c => c + n),
    onParsed: () => qc.invalidateQueries({ queryKey: ["disclosures"] }),
  });

  const listQuery = useQuery({
    queryKey: ["disclosures", tab, filters.type, debouncedQ, filters.from, filters.to, page],
    queryFn: () =>
      tab === "saved"
        ? fetchBookmarks(page, 50)
        : fetchDisclosures({ ...filters, q: debouncedQ, page, size: 50 }),
    refetchInterval: live && tab === "all" && !streamConnected ? 30_000 : false,
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ["detail", selected],
    queryFn: () => fetchDetail(selected!),
    enabled: !!selected,
  });

  const items = listQuery.data?.content ?? [];

  useEffect(() => {
    document.title = newCount > 0 ? `(${newCount}) DART 지분공시` : "DART 지분공시";
  }, [newCount]);

  const bookmarkMutation = useMutation({
    mutationFn: ({ rceptNo, marked }: { rceptNo: string; marked: boolean }) =>
      marked ? removeBookmark(rceptNo) : addBookmark(rceptNo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disclosures"] });
      qc.invalidateQueries({ queryKey: ["detail"] });
    },
    onError: (e: Error) => {
      setNotice(
        e.message === "UNAUTHORIZED"
          ? "저장하려면 카카오 로그인이 필요합니다."
          : "저장에 실패했습니다: " + e.message,
      );
    },
  });

  const toggle = (d: DisclosureSummary) =>
    bookmarkMutation.mutate({ rceptNo: d.rceptNo, marked: d.bookmarked });

  const patch = (p: Partial<Filters>) => {
    setFilters(f => ({ ...f, ...p }));
    setPage(0);
  };

  const switchTab = (t: Tab) => {
    if (t === "saved" && !authed) {
      setNotice("저장목록을 보려면 카카오 로그인이 필요합니다.");
      return;
    }
    setTab(t);
    setPage(0);
  };

  const total = listQuery.data?.totalElements ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <FilterBar
        {...filters}
        total={total}
        live={live}
        me={meQuery.data}
        tab={tab}
        streamConnected={streamConnected}
        onChange={patch}
        onToggleLive={() => setLive(v => !v)}
        onTab={switchTab}
        onLogout={async () => {
          await logout();
          qc.invalidateQueries();
          setTab("all");
        }}
      />

      {notice && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span>{notice}</span>
          {!authed && (
            <a
              href={KAKAO_LOGIN_URL}
              className="rounded bg-[#FEE500] px-2 py-0.5 font-medium text-[#191600] hover:brightness-95"
            >
              카카오 로그인
            </a>
          )}
          <button onClick={() => setNotice(null)} className="ml-auto text-amber-500 hover:text-amber-700">
            닫기
          </button>
        </div>
      )}

      <main className="flex min-h-0 flex-1">
        {/* 모바일에서는 상세를 보는 동안 목록을 숨긴다 (단일 컬럼) */}
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-[340px] dark:border-slate-700 dark:bg-slate-900`}
        >
          {newCount > 0 && tab === "all" && (
            <button
              onClick={() => { setNewCount(0); setPage(0); listQuery.refetch(); }}
              className="border-b border-emerald-200 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >
              신규 공시 {newCount}건 도착 · 새로고침
            </button>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <DisclosureList
              items={items}
              selected={selected}
              loading={listQuery.isLoading}
              emptyText={tab === "saved" ? "저장한 공시가 없습니다. 목록에서 ☆를 눌러 저장하세요." : undefined}
              onSelect={setSelected}
              onToggleBookmark={toggle}
            />
          </div>

          {totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between gap-1 border-t border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="shrink-0 rounded px-2 py-1 whitespace-nowrap disabled:opacity-30 enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800"
              >
                ←<span className="hidden sm:inline"> 이전</span>
              </button>
              <span className="shrink-0 tabular-nums whitespace-nowrap text-slate-500">
                {page + 1}/{totalPages}
              </span>
              <button
                disabled={listQuery.data?.last}
                onClick={() => setPage(p => p + 1)}
                className="shrink-0 rounded px-2 py-1 whitespace-nowrap disabled:opacity-30 enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800"
              >
                <span className="hidden sm:inline">다음 </span>→
              </button>
            </div>
          )}
        </aside>

        <section
          className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-white dark:bg-slate-900`}
        >
          <DetailPane
            detail={detailQuery.data}
            loading={detailQuery.isLoading}
            error={detailQuery.error}
            onBack={() => setSelected(null)}
            onToggleBookmark={() =>
              detailQuery.data && toggle(detailQuery.data.disclosure)
            }
          />
        </section>
      </main>
    </div>
  );
}
