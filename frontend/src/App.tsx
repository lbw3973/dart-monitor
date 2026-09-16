import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { trackPageView } from "./analytics";
import {
  addBookmark, fetchBookmarks, fetchDetail, fetchDisclosures, fetchMe,
  KAKAO_LOGIN_URL, logout, removeBookmark,
} from "./api";
import { AdminPage } from "./components/AdminPage";
import { ConsentBanner } from "./components/ConsentBanner";
import { DetailPane } from "./components/DetailPane";
import { DisclosureList } from "./components/DisclosureList";
import { FilterBar } from "./components/FilterBar";
import { Toast } from "./components/Toast";
import type { ToastMessage } from "./components/Toast";
import type { DisclosureSummary } from "./types";
import { useDisclosureStream } from "./useDisclosureStream";
import { useUrlState } from "./useUrlState";
import type { Tab } from "./useUrlState";

export default function App() {
  const qc = useQueryClient();
  // 상태를 URL에 반영한다 — 그래야 뒤로가기가 사이트 이탈이 아니라
  // 이전 화면(목록·이전 페이지)으로 돌아간다.
  const { state: view, update: setView, goBack, goHome } = useUrlState();
  const { tab, page, selected } = view;
  const filters = {
    group: view.group, type: view.type, q: view.q, from: view.from, to: view.to,
  };

  const [debouncedQ, setDebouncedQ] = useState(view.q);
  const [live, setLive] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);


  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const authed = meQuery.data?.authenticated ?? false;

  // 로그아웃 상태에서 저장목록 탭에 머물지 않도록
  useEffect(() => {
    if (!authed && tab === "saved") setView({ tab: "all" }, true);
  }, [authed, tab, setView]);

  // ?admin=1 을 직접 붙여 들어와도 권한이 없으면 일반 화면으로 되돌린다.
  // 서버가 403으로 막지만(§AdminGuard) 빈 화면을 보여줄 이유는 없다.
  useEffect(() => {
    if (view.admin && meQuery.isFetched && !meQuery.data?.admin) setView({ admin: false }, true);
  }, [view.admin, meQuery.isFetched, meQuery.data?.admin, setView]);

  // SSE가 살아 있으면 폴링은 불필요하다. 끊기면 자동으로 30초 폴링이 공백을 메운다.
  const streamConnected = useDisclosureStream({
    onNew: n => setNewCount(c => c + n),
    onParsed: () => qc.invalidateQueries({ queryKey: ["disclosures"] }),
  });

  const listQuery = useQuery({
    queryKey: ["disclosures", tab, filters.group, filters.type, debouncedQ, filters.from, filters.to, page],
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

  // 히스토리에 쌓이는 이동(목록↔상세, 페이지, 탭)만 페이지뷰로 센다.
  // 필터·검색어는 replaceState 라 의존성에 넣지 않는다 — 타이핑마다 집계되면 지표가 망가진다.
  useEffect(() => {
    trackPageView();
  }, [tab, page, selected]);

  const bookmarkMutation = useMutation({
    mutationFn: ({ rceptNo, marked }: { rceptNo: string; marked: boolean }) =>
      marked ? removeBookmark(rceptNo) : addBookmark(rceptNo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disclosures"] });
      qc.invalidateQueries({ queryKey: ["detail"] });
    },
    onError: (e: Error) => {
      setToast(
        e.message === "UNAUTHORIZED"
          ? { text: "저장하려면 로그인이 필요합니다.", tone: "warn",
              action: { label: "카카오 로그인", href: KAKAO_LOGIN_URL } }
          : { text: "저장에 실패했습니다: " + e.message, tone: "warn" },
      );
    },
  });

  const toggle = (d: DisclosureSummary) =>
    bookmarkMutation.mutate({ rceptNo: d.rceptNo, marked: d.bookmarked });

  // 필터는 replace — 검색어가 타이핑마다 히스토리를 쌓으면 뒤로가기가 못 쓰게 된다
  const patch = (p: Partial<typeof filters>) => setView({ ...p, page: 0 }, true);

  const switchTab = (t: Tab) => {
    if (t === "saved" && !authed) {
      setToast({ text: "저장목록을 보려면 로그인이 필요합니다.", tone: "warn",
                 action: { label: "카카오 로그인", href: KAKAO_LOGIN_URL } });
      return;
    }
    setView({ tab: t, page: 0, selected: null });
  };

  const total = listQuery.data?.totalElements ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
        onHome={goHome}
        onAdmin={() => setView({ admin: true, selected: null })}
        minimal={view.admin}
        onLogout={async () => {
          await logout();
          qc.invalidateQueries();
          setView({ tab: "all", selected: null }, true);
        }}
      />

      {/* 관리자 페이지는 목록·상세를 통째로 대신한다. 헤더는 그대로 둬서 나가는 길을 남긴다. */}
      {view.admin ? (
        <AdminPage
          onClose={() => setView({ admin: false })}
          onNotice={(text, tone) => setToast({ text, tone })}
        />
      ) : (
      <main className="flex min-h-0 flex-1">
        {/* 모바일에서는 상세를 보는 동안 목록을 숨긴다 (단일 컬럼) */}
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-[340px] dark:border-slate-700 dark:bg-slate-900`}
        >
          {newCount > 0 && tab === "all" && (
            <button
              onClick={() => { setNewCount(0); setView({ page: 0 }, true); listQuery.refetch(); }}
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
              onSelect={rceptNo => setView({ selected: rceptNo })}
              onToggleBookmark={toggle}
            />
          </div>

          {totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between gap-1 border-t border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700">
              <button
                disabled={page === 0}
                onClick={() => setView({ page: page - 1 })}
                className="shrink-0 rounded px-2 py-1 whitespace-nowrap disabled:opacity-30 enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800"
              >
                ←<span className="hidden sm:inline"> 이전</span>
              </button>
              <span className="shrink-0 tabular-nums whitespace-nowrap text-slate-500">
                {page + 1}/{totalPages}
              </span>
              <button
                disabled={listQuery.data?.last}
                onClick={() => setView({ page: page + 1 })}
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
            authed={authed}
            onBack={goBack}
            onNotice={(text, tone) => setToast({ text, tone })}
            onToggleBookmark={() =>
              detailQuery.data && toggle(detailQuery.data.disclosure)
            }
          />
        </section>
      </main>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
      <ConsentBanner />
    </div>
  );
}
