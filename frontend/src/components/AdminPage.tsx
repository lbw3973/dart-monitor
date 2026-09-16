import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FC, ReactNode } from "react";
import {
  fetchAdminDisclosures, fetchAdminUsers, fetchCommentBoards,
  setDisclosureHidden, setUserAdmin,
} from "../api";
import type { CommentBoard, PageResponse } from "../types";
import { CommentThread } from "./CommentThread";

type Tab = "disclosures" | "comments" | "users";

interface Props {
  onClose: () => void;
  onNotice: (msg: string, tone?: "info" | "warn") => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "disclosures", label: "공시" },
  { key: "comments", label: "의견" },
  { key: "users", label: "사용자" },
];

export function AdminPage({ onClose, onNotice }: Props) {
  const [tab, setTab] = useState<Tab>("disclosures");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-slate-900">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2 sm:px-5 dark:border-slate-700">
        <h1 className="text-sm font-semibold">관리자</h1>

        <nav className="flex rounded bg-slate-100 p-0.5 dark:bg-slate-800">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                tab === t.key
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <button
          onClick={onClose}
          className="ml-auto cursor-pointer rounded px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          닫기
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {tab === "disclosures" && <Disclosures onNotice={onNotice} />}
        {tab === "comments" && <Comments onNotice={onNotice} />}
        {tab === "users" && <Users onNotice={onNotice} />}
      </div>
    </div>
  );
}

/* ───────────────── 공시 ───────────────── */

function Disclosures({ onNotice }: { onNotice: Props["onNotice"] }) {
  const qc = useQueryClient();
  const { q, setQ, debounced, page, setPage } = useSearch();
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [range, setRange] = useState(defaultMonth);

  // 필터를 바꾸면 첫 페이지로 — 3페이지를 보던 중 조건을 좁히면 빈 화면이 나온다
  useEffect(() => setPage(0), [hidden, range.from, range.to, setPage]);

  const list = useQuery({
    queryKey: ["admin", "disclosures", debounced, hidden, range.from, range.to, page],
    queryFn: () => fetchAdminDisclosures({ q: debounced, hidden, ...range, page }),
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: ({ rceptNo, next }: { rceptNo: string; next: boolean }) =>
      setDisclosureHidden(rceptNo, next),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      // 일반 목록에서도 사라지거나 되살아나야 한다
      qc.invalidateQueries({ queryKey: ["disclosures"] });
      qc.invalidateQueries({ queryKey: ["detail"] });
      onNotice(v.next ? "공시를 목록에서 내렸습니다." : "공시를 다시 올렸습니다.");
    },
    onError: (e: Error) => onNotice(failText(e), "warn"),
  });

  const items = list.data?.content ?? [];

  return (
    <>
      <Intro>
        내린 공시는 목록·상세·검색·저장목록에서 모두 빠지지만 행은 남습니다. 지우지 않는 이유는
        폴러가 최근 공시를 다시 수집해 되살리기 때문이고, 행을 지우면 거기 달린 의견과 즐겨찾기까지
        함께 사라지기 때문입니다.
      </Intro>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="회사명 · 보고서명 · 접수번호" />

        {/* 기본은 최근 한 달. 비우면 기간 제한이 풀린다 —
            오래된 접수번호로 찾을 때 날짜가 걸림돌이 되면 안 된다 */}
        <input
          type="date"
          value={range.from}
          max={range.to || undefined}
          onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
          aria-label="접수일 시작"
          className={DATE_INPUT}
        />
        <span className="text-xs text-slate-400">~</span>
        <input
          type="date"
          value={range.to}
          min={range.from || undefined}
          onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
          aria-label="접수일 끝"
          className={DATE_INPUT}
        />
        {(range.from || range.to) && (
          <button
            onClick={() => setRange({ from: "", to: "" })}
            className="shrink-0 cursor-pointer rounded px-1.5 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            기간 해제
          </button>
        )}

        <div className="flex shrink-0 rounded bg-slate-100 p-0.5 dark:bg-slate-800">
          {([[null, "전체"], [false, "보이는 것"], [true, "내린 것"]] as const).map(([v, label]) => (
            <button
              key={label}
              onClick={() => setHidden(v)}
              className={`cursor-pointer rounded px-2 py-1 text-xs font-medium whitespace-nowrap transition ${
                hidden === v
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Total page={list.data} />
      </div>

      {list.isLoading ? (
        <Empty>불러오는 중…</Empty>
      ) : items.length === 0 ? (
        <Empty>조건에 맞는 공시가 없습니다.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map(d => (
            <li key={d.rceptNo} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`truncate text-sm font-medium ${d.hidden ? "text-slate-400 line-through" : ""}`}>
                    {d.corpName}
                  </span>
                  {d.hidden && <Chip>내림</Chip>}
                  {d.commentCount > 0 && (
                    <span className="shrink-0 text-[10px] tabular-nums text-sky-600 dark:text-sky-400">
                      의견 {d.commentCount}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {d.reportNm} · {d.rceptDt} · <span className="tabular-nums">{d.rceptNo}</span>
                </p>
              </div>

              <button
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ rceptNo: d.rceptNo, next: !d.hidden })}
                className={`shrink-0 cursor-pointer rounded border px-2 py-1 text-xs font-medium whitespace-nowrap transition disabled:opacity-40 ${
                  d.hidden
                    ? "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    : "border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                }`}
              >
                {d.hidden ? "다시 올리기" : "목록에서 내리기"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pager page={list.data} onPage={setPage} />
    </>
  );
}

/* ───────────────── 의견 ───────────────── */

function Comments({ onNotice }: { onNotice: Props["onNotice"] }) {
  const { q, setQ, debounced, page, setPage } = useSearch();
  const [open, setOpen] = useState<CommentBoard | null>(null);

  const boards = useQuery({
    queryKey: ["admin", "comment-boards", debounced, page],
    queryFn: () => fetchCommentBoards(debounced, page),
    placeholderData: keepPreviousData,
  });

  const items = boards.data?.content ?? [];

  if (open) {
    return (
      <>
        <button
          onClick={() => setOpen(null)}
          className="mb-3 cursor-pointer text-xs text-sky-600 transition hover:underline dark:text-sky-400"
        >
          ← 의견이 달린 공시 목록
        </button>
        <h2 className="text-sm font-semibold">{open.corpName}</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {open.reportNm} · {open.rceptDt} · <span className="tabular-nums">{open.rceptNo}</span>
        </p>
        <CommentThread rceptNo={open.rceptNo} onNotice={onNotice} />
      </>
    );
  }

  return (
    <>
      <Intro>
        의견이 하나라도 달린 공시만, 최근에 달린 순으로 보입니다. 공시를 고르면 그 스레드가 열리고
        거기서 개별 삭제합니다. 답글이 달린 의견을 지우면 본문만 비우고 자리는 남습니다.
      </Intro>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="회사명 · 보고서명 · 접수번호" />
        <Total page={boards.data} />
      </div>

      {boards.isLoading ? (
        <Empty>불러오는 중…</Empty>
      ) : items.length === 0 ? (
        <Empty>{q.trim() ? "조건에 맞는 공시가 없습니다." : "아직 의견이 달린 공시가 없습니다."}</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map(b => (
            <li key={b.rceptNo}>
              <button
                onClick={() => setOpen(b)}
                className="flex w-full cursor-pointer items-center gap-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{b.corpName}</span>
                    {b.hidden && <Chip>내림</Chip>}
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {b.reportNm} · {b.rceptDt}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-sky-50 px-2 py-0.5 text-xs font-medium tabular-nums text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  의견 {b.commentCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pager page={boards.data} onPage={setPage} />
    </>
  );
}

/* ───────────────── 사용자 ───────────────── */

function Users({ onNotice }: { onNotice: Props["onNotice"] }) {
  const qc = useQueryClient();
  const { q, setQ, debounced, page, setPage } = useSearch();

  const list = useQuery({
    queryKey: ["admin", "users", debounced, page],
    queryFn: () => fetchAdminUsers(debounced, page),
    placeholderData: keepPreviousData,
  });

  const grant = useMutation({
    mutationFn: ({ id, next }: { id: number; next: boolean }) => setUserAdmin(id, next),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onNotice(v.next ? "관리자 권한을 부여했습니다." : "관리자 권한을 해제했습니다.");
    },
    onError: (e: Error) => onNotice(failText(e), "warn"),
  });

  const items = list.data?.content ?? [];

  return (
    <>
      <Intro>
        카카오 로그인에서 이메일을 받지 않아 닉네임이 겹칠 수 있습니다. 카카오 식별자와 가입일로
        사람을 구분하세요. 자신의 권한은 해제할 수 없습니다 — 마지막 관리자가 내려놓으면 아무도
        되돌릴 수 없습니다.
      </Intro>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="닉네임 · 카카오 식별자" />
        <Total page={list.data} />
      </div>

      {list.isLoading ? (
        <Empty>불러오는 중…</Empty>
      ) : items.length === 0 ? (
        <Empty>{q.trim() ? "조건에 맞는 사용자가 없습니다." : "가입한 사용자가 없습니다."}</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map(u => (
            <li key={u.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{u.nickname}</span>
                  {u.admin && (
                    <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                      관리자
                    </span>
                  )}
                  {u.me && <span className="shrink-0 text-[10px] text-slate-400">나</span>}
                </div>
                <p className="truncate font-mono text-[11px] text-slate-400">
                  {u.providerUid} · 가입 {u.createdAt.slice(0, 10)}
                </p>
              </div>

              <button
                disabled={grant.isPending || (u.me && u.admin)}
                onClick={() => grant.mutate({ id: u.id, next: !u.admin })}
                title={u.me && u.admin ? "자신의 권한은 해제할 수 없습니다" : undefined}
                className="shrink-0 cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {u.admin ? "권한 해제" : "관리자 부여"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pager page={list.data} onPage={setPage} />
    </>
  );
}

/* ───────────────── 공용 ───────────────── */

/**
 * 세 탭이 똑같이 쓰는 검색어·페이지 상태.
 * 검색어는 타이핑마다 질의하지 않도록 300ms 늦추고, 바뀌면 첫 페이지로 돌아간다
 * (§App.tsx 목록 검색과 같은 방식).
 */
function useSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(0), [debounced]);

  return { q, setQ, debounced, page, setPage };
}

const DATE_INPUT =
  "h-8 shrink-0 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

/**
 * 관리자 공시 목록의 기본 기간 — 오늘 포함 최근 한 달.
 *
 * toISOString() 은 UTC 라 한국시간 오전에는 날짜가 하루 밀린다.
 * 로컬 기준으로 찍는다.
 */
function defaultMonth() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  return { from: ymd(from), to: ymd(to) };
}

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function SearchBox({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-xs sm:max-w-64 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
    />
  );
}

function Total({ page }: { page?: PageResponse<unknown> }) {
  if (!page) return null;
  return (
    <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
      {page.totalElements.toLocaleString()}건
    </span>
  );
}

function Pager({ page, onPage }: { page?: PageResponse<unknown>; onPage: (n: number) => void }) {
  if (!page || page.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-4 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
      <button
        disabled={page.page === 0}
        onClick={() => onPage(page.page - 1)}
        className="cursor-pointer rounded px-2 py-1 whitespace-nowrap disabled:cursor-default disabled:opacity-30 enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800"
      >
        ← 이전
      </button>
      <span className="tabular-nums whitespace-nowrap text-slate-500">
        {page.page + 1} / {page.totalPages}
      </span>
      <button
        disabled={page.last}
        onClick={() => onPage(page.page + 1)}
        className="cursor-pointer rounded px-2 py-1 whitespace-nowrap disabled:cursor-default disabled:opacity-30 enabled:hover:bg-slate-100 dark:enabled:hover:bg-slate-800"
      >
        다음 →
      </button>
    </div>
  );
}

const Intro: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
    {children}
  </p>
);

const Chip: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
    {children}
  </span>
);

const Empty: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="py-10 text-center text-xs text-slate-400">{children}</p>
);

function failText(e: Error): string {
  if (e.message === "UNAUTHORIZED") return "로그인이 풀렸습니다. 다시 로그인해 주세요.";
  if (e.message === "FORBIDDEN") return "관리자 권한이 없습니다.";
  return "처리하지 못했습니다: " + e.message;
}
