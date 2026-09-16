import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 의견 시트의 열림 상태와 뒤로가기 처리.
 *
 * 시트를 열 때 히스토리에 한 칸 쌓는다. 그래야 모바일에서 뒤로가기를 눌렀을 때
 * 의견을 읽다 말고 공시 밖(목록)으로 튕기지 않고 시트만 닫힌다.
 * 반대로 딤·✕·스와이프로 닫을 때는 쌓아 둔 칸을 history.back() 으로 되감는다 —
 * 안 그러면 닫은 뒤 뒤로가기를 두 번 눌러야 목록으로 간다.
 *
 * 주소는 바꾸지 않는다. 시트는 공유할 상태가 아니고, sel= 이 그대로라
 * popstate 를 받는 useUrlState 쪽도 아무 영향을 받지 않는다.
 * dartDepth 도 그대로 물려준다 — 그 값이 어긋나면 goBack() 의
 * "앱 안에서 뒤로 갈 곳이 있는가" 판정이 깨진다.
 */
export function useCommentSheet(rceptNo: string | null) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  // 우리가 쌓은 칸이 아직 히스토리 맨 위에 있는가
  const pushedRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false;
      setOpen(false);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  // 다른 공시로 넘어가면 시트는 닫는다.
  // 여기서는 back() 을 부르지 않는다 — 쌓아 둔 칸이 이미 새 공시 아래에 묻혀 있어서
  // 되감으면 방금 떠난 공시로 돌아가 버린다.
  useEffect(() => {
    pushedRef.current = false;
    setOpen(false);
  }, [rceptNo]);

  const openSheet = useCallback(() => {
    if (openRef.current) return;
    history.pushState({ ...history.state, dartSheet: true }, "", location.href);
    pushedRef.current = true;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (!openRef.current) return;
    if (pushedRef.current) {
      pushedRef.current = false;
      history.back(); // 닫는 건 위의 popstate 가 한다
      return;
    }
    setOpen(false);
  }, []);

  // 데스크톱의 네 번째 닫는 법
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, close]);

  return { open, openSheet, close } as const;
}
