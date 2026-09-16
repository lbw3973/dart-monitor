import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { addComment, fetchComments, KAKAO_LOGIN_URL } from "../api";
import type { Comment } from "../types";
import { CommentThread } from "./CommentThread";

interface Props {
  rceptNo: string;
  open: boolean;
  authed: boolean;
  onClose: () => void;
  onNotice: (msg: string, tone?: "info" | "warn") => void;
}

/** 이만큼 아래로 끌면 닫는다. 더 짧으면 스크롤하려다 닫히고, 더 길면 안 닫힌다. */
const DRAG_TO_CLOSE = 60;

/**
 * 하단 집계 바에서 올라오는 의견 시트.
 *
 * 닫는 법은 네 가지다 — 딤 탭, ✕, 핸들 아래로 스와이프, 뒤로가기/Esc.
 * 어느 하나만 두면 반드시 못 찾는 사람이 생긴다.
 * (뒤로가기는 §useCommentSheet 가 맡는다)
 */
export function CommentSheet({ rceptNo, open, authed, onClose, onNotice }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 스레드와 같은 쿼리 키라 react-query 가 한 번만 부른다. 여기서는 개수만 쓴다.
  const commentsQuery = useQuery({
    queryKey: ["comments", rceptNo],
    queryFn: () => fetchComments(rceptNo),
    enabled: open,
  });

  useEffect(() => {
    if (open) return;
    setReplyTo(null);
    setDrag(0);
  }, [open]);

  const create = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: number }) =>
      addComment(rceptNo, body, parentId),
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["comments", rceptNo] });
      // 하단 바와 목록에 걸린 의견 수
      qc.invalidateQueries({ queryKey: ["detail"] });
      qc.invalidateQueries({ queryKey: ["disclosures"] });
    },
    onError: (e: Error) =>
      onNotice(
        e.message === "UNAUTHORIZED"
          ? "로그인이 풀렸습니다. 다시 로그인해 주세요."
          : "등록하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        "warn",
      ),
  });

  const submit = () => {
    const body = text.trim();
    if (!body || create.isPending) return;
    create.mutate({ body, parentId: replyTo?.id });
  };

  const startReply = (c: Comment) => {
    setReplyTo(c);
    inputRef.current?.focus();
  };

  const comments = commentsQuery.data ?? [];
  const total = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  return (
    <>
      {/* 가장 많이 쓰이는 닫기 방법이라 딤은 반드시 깔아 둔다 —
          딤이 없으면 "바깥을 누른다"는 발상 자체가 나오지 않는다 */}
      <button
        aria-label="의견 닫기"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 z-10 bg-slate-900/45 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <section
        aria-label="의견"
        inert={!open}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
        className={`absolute inset-x-0 bottom-0 z-20 flex h-[76%] flex-col rounded-t-xl border-t border-slate-200 bg-white shadow-[0_-8px_28px_-14px_rgba(0,0,0,0.45)] transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* 핸들 — 아래로 끌면 닫힌다 */}
        <div
          className="shrink-0 cursor-grab touch-none pt-2 pb-1 active:cursor-grabbing"
          onTouchStart={e => {
            startY.current = e.touches[0].clientY;
          }}
          onTouchMove={e => {
            if (startY.current === null) return;
            setDrag(Math.max(0, e.touches[0].clientY - startY.current));
          }}
          onTouchEnd={() => {
            startY.current = null;
            if (drag > DRAG_TO_CLOSE) onClose();
            setDrag(0);
          }}
        >
          <span className="mx-auto block h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 pb-2 sm:px-5 dark:border-slate-700">
          <h3 className="text-xs font-semibold">
            의견 <span className="tabular-nums text-sky-600 dark:text-sky-400">{total}</span>
          </h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto cursor-pointer rounded px-1.5 py-0.5 text-sm leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
          <CommentThread
            rceptNo={rceptNo}
            enabled={open}
            onReply={authed ? startReply : undefined}
            onNotice={onNotice}
          />
        </div>

        <footer className="shrink-0 border-t border-slate-200 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 dark:border-slate-700">
          {/* 답글은 이 입력창을 그대로 쓴다 — 모바일에서 키보드가 올라오면
              스레드 중간의 입력창은 가려진다 */}
          {replyTo && (
            <div className="mb-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate">
                <b className="font-medium text-slate-700 dark:text-slate-200">{replyTo.author}</b> 님에게 답글
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="ml-auto shrink-0 cursor-pointer rounded px-1 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              >
                취소
              </button>
            </div>
          )}

          {/* 로그인 전에도 입력창을 자리에 둔다 — 여기가 쓰는 자리라는 건 보여 주되
              타이핑은 막고, 등록 자리에 로그인 버튼을 놓아 막다른 길을 만들지 않는다 */}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              maxLength={1000}
              disabled={!authed}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                !authed
                  ? "의견을 쓰려면 로그인이 필요합니다"
                  : replyTo
                    ? "답글을 남겨 주세요"
                    : "의견을 남겨 주세요"
              }
              className="max-h-24 min-w-0 flex-1 resize-none rounded border border-slate-300 bg-white px-2 py-1.5 text-xs leading-relaxed field-sizing-content placeholder:text-slate-400 focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/50"
            />

            {authed ? (
              <button
                onClick={submit}
                disabled={!text.trim() || create.isPending}
                className="h-[30px] shrink-0 cursor-pointer rounded bg-sky-600 px-3 text-xs font-medium whitespace-nowrap text-white transition enabled:hover:bg-sky-700 disabled:cursor-default disabled:opacity-40"
              >
                등록
              </button>
            ) : (
              <a
                href={KAKAO_LOGIN_URL}
                className="flex h-[30px] shrink-0 items-center rounded bg-[#FEE500] px-3 text-xs font-medium whitespace-nowrap text-[#191600] hover:brightness-95"
              >
                카카오 로그인
              </a>
            )}
          </div>
        </footer>
      </section>
    </>
  );
}
