import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FC, ReactNode } from "react";
import {
  fetchAdminDisclosures, fetchAdminUsers, fetchCommentBoards,
  setDisclosureHidden, setUserAdmin,
} from "../api";
import type { CommentBoard } from "../types";
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
  const [q, setQ] = useState("");
  const [hidden, setHidden] = useState<boolean | null>(null);

  const list = useQuery({
    queryKey: ["admin", "disclosures", q, hidden],
    queryFn: () => fetchAdminDisclosures(q, hidden),
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
      <p className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        내린 공시는 목록·상세·검색·저장목록에서 모두 빠지지만 행은 남습니다. 지우지 않는 이유는
        폴러가 최근 공시를 다시 수집해 되살리기 때문이고, 행을 지우면 거기 달린 의견과 즐겨찾기까지
        함께 사라지기 때문입니다.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="회사명 · 보고서명 · 접수번호"
          className="h-8 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-xs sm:max-w-64 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
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
                  {d.hidden && (
                    <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      내림
                    </span>
                  )}
                  {d.commentCount > 0 && (
                    <span className="shrink-0 text-[10px] tabular-nums text-sky-600 dark:text-sky-400">
                      의견 {d.commentCount}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {d.reportNm} · {d.rceptDt} ·{" "}
                  <span className="tabular-nums">{d.rceptNo}</span>
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
    </>
  );
}

/* ───────────────── 의견 ───────────────── */

function Comments({ onNotice }: { onNotice: Props["onNotice"] }) {
  const [open, setOpen] = useState<CommentBoard | null>(null);

  const boards = useQuery({
    queryKey: ["admin", "comment-boards"],
    queryFn: () => fetchCommentBoards(),
  });

  const items = boards.data ?? [];

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
      <p className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        의견이 하나라도 달린 공시만, 최근에 달린 순으로 보입니다. 공시를 고르면 그 스레드가 열리고
        거기서 개별 삭제합니다. 답글이 달린 의견을 지우면 본문만 비우고 자리는 남습니다.
      </p>

      {boards.isLoading ? (
        <Empty>불러오는 중…</Empty>
      ) : items.length === 0 ? (
        <Empty>아직 의견이 달린 공시가 없습니다.</Empty>
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
                    {b.hidden && (
                      <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        내림
                      </span>
                    )}
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
    </>
  );
}

/* ───────────────── 사용자 ───────────────── */

function Users({ onNotice }: { onNotice: Props["onNotice"] }) {
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ["admin", "users"], queryFn: fetchAdminUsers });

  const grant = useMutation({
    mutationFn: ({ id, next }: { id: number; next: boolean }) => setUserAdmin(id, next),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onNotice(v.next ? "관리자 권한을 부여했습니다." : "관리자 권한을 해제했습니다.");
    },
    onError: (e: Error) => onNotice(failText(e), "warn"),
  });

  const items = list.data ?? [];

  return (
    <>
      <p className="mb-3 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        카카오 로그인에서 이메일을 받지 않아 닉네임이 겹칠 수 있습니다. 카카오 식별자와 가입일로
        사람을 구분하세요. 자신의 권한은 해제할 수 없습니다 — 마지막 관리자가 내려놓으면 아무도
        되돌릴 수 없습니다.
      </p>

      {list.isLoading ? (
        <Empty>불러오는 중…</Empty>
      ) : items.length === 0 ? (
        <Empty>가입한 사용자가 없습니다.</Empty>
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
    </>
  );
}

/* ───────────────── 공용 ───────────────── */

const Empty: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="py-10 text-center text-xs text-slate-400">{children}</p>
);

function failText(e: Error): string {
  if (e.message === "UNAUTHORIZED") return "로그인이 풀렸습니다. 다시 로그인해 주세요.";
  if (e.message === "FORBIDDEN") return "관리자 권한이 없습니다.";
  return "처리하지 못했습니다: " + e.message;
}
