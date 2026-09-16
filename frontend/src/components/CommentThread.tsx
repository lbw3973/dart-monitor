import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FC, ReactNode } from "react";
import { fetchComments, removeComment } from "../api";
import type { Comment } from "../types";

interface Props {
  rceptNo: string;
  /** 시트가 닫혀 있는 동안에는 부르지 않는다 */
  enabled?: boolean;
  /** 주면 최상위 의견에 "답글"을 그린다. 관리자 화면처럼 답글이 필요 없으면 생략한다. */
  onReply?: (c: Comment) => void;
  onNotice: (msg: string, tone?: "info" | "warn") => void;
}

/**
 * 한 공시의 의견 스레드.
 *
 * 의견 시트와 관리자 화면이 같은 것을 보여줘야 해서 여기로 모았다.
 * 답글은 1단까지다 — 답글에는 "답글" 버튼을 아예 그리지 않아 더 들어갈 길을 없앤다.
 */
export function CommentThread({ rceptNo, enabled = true, onReply, onNotice }: Props) {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["comments", rceptNo],
    queryFn: () => fetchComments(rceptNo),
    enabled,
  });

  // 시간 표시는 그릴 때 한 번 계산된다. 열어 두면 "방금"이 그대로 굳으므로 1분마다 다시 그린다.
  const [, retick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => retick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, [enabled]);

  const remove = useMutation({
    mutationFn: (id: number) => removeComment(id),
    onSuccess: () => {
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["comments", rceptNo] });
      // 하단 바·목록에 걸린 의견 수, 관리자 화면의 집계까지
      qc.invalidateQueries({ queryKey: ["detail"] });
      qc.invalidateQueries({ queryKey: ["disclosures"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => onNotice("삭제하지 못했습니다.", "warn"),
  });

  const comments = query.data ?? [];

  if (query.isLoading) return <Note>불러오는 중…</Note>;
  if (query.error) return <Note>의견을 불러오지 못했습니다.</Note>;
  if (comments.length === 0) {
    return <Note>아직 의견이 없습니다. 첫 의견을 남겨 보세요.</Note>;
  }

  const rowProps = (c: Comment) => ({
    c,
    confirming: confirmId === c.id,
    onDelete: () => setConfirmId(c.id),
    onConfirm: () => remove.mutate(c.id),
    onCancel: () => setConfirmId(null),
  });

  return (
    <ul className="flex flex-col gap-4">
      {comments.map(c => (
        <li key={c.id}>
          <Row {...rowProps(c)} onReply={onReply && (() => onReply(c))} />

          {c.replies && c.replies.length > 0 && (
            <ul className="mt-3 ml-7 flex flex-col gap-3 border-l-2 border-slate-100 pl-3 dark:border-slate-800">
              {c.replies.map(r => (
                <li key={r.id}>
                  <Row {...rowProps(r)} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

interface RowProps {
  c: Comment;
  confirming: boolean;
  onReply?: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function Row({ c, confirming, onReply, onDelete, onConfirm, onCancel }: RowProps) {
  if (c.deleted) {
    return (
      <p className="py-1 pl-7 text-xs text-slate-400 italic dark:text-slate-500">
        삭제된 의견입니다.
      </p>
    );
  }

  return (
    <div className="flex gap-2">
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {c.author.slice(0, 1)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <b className="text-xs font-semibold">{c.author}</b>
          <span className="text-[10px] text-slate-400">{timeAgo(c.createdAt)}</span>
        </div>

        <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {c.body}
        </p>

        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
          {onReply && <Act onClick={onReply}>답글</Act>}
          {c.deletable &&
            (confirming ? (
              <>
                <span className="text-slate-500 dark:text-slate-400">삭제할까요?</span>
                <Act onClick={onConfirm} danger>
                  삭제
                </Act>
                <Act onClick={onCancel}>취소</Act>
              </>
            ) : (
              <Act onClick={onDelete}>삭제</Act>
            ))}
        </div>
      </div>
    </div>
  );
}

const Act: FC<{ children: ReactNode; onClick?: () => void; danger?: boolean }> = ({
  children,
  onClick,
  danger,
}) => (
  <button
    onClick={onClick}
    className={`cursor-pointer rounded px-1 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
      danger ? "text-rose-500 hover:text-rose-600" : "hover:text-slate-600 dark:hover:text-slate-300"
    }`}
  >
    {children}
  </button>
);

const Note: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="py-8 text-center text-xs text-slate-400">{children}</p>
);

/**
 * 공시는 접수 직후에 이야기가 몰린다 — 며칠 지난 것보다 방금 것이 몇 분 전인지가 중요하다.
 * 그래서 하루까지는 상대시간, 일주일이 넘으면 절대날짜로 넘긴다.
 *
 * 서버 시계가 조금 앞서 있으면 min 이 음수로 나오는데, 그건 "방금"으로 흡수된다.
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso);
  const min = Math.floor((Date.now() - then.getTime()) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`;

  // 여기부터는 흐른 시간이 아니라 날짜가 기준이다.
  // 25시간 전이어도 달력으로 이틀 전이면 "어제"가 아니다.
  const days = dayGap(then);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;

  // ISO 문자열을 잘라 쓰면 UTC 날짜가 나와서, 한국시간 오전에 쓴 글이 하루 밀린다.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${then.getFullYear()}.${pad(then.getMonth() + 1)}.${pad(then.getDate())}`;
}

/** 자정을 기준으로 며칠 차이인지 */
function dayGap(then: Date): number {
  const today = new Date();
  const that = new Date(then);
  today.setHours(0, 0, 0, 0);
  that.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - that.getTime()) / 86_400_000);
}
