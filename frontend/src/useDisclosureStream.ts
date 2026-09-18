import { useEffect, useRef, useState } from "react";

interface Options {
  onNew: (count: number) => void;
  onParsed: () => void;
}

/**
 * parsed 는 문서 한 건마다 나온다(§ParseService.publishParsed).
 *
 * 평상시엔 몇 분에 한 건이라 그대로 흘려도 됐지만, 백필 중에는 수천 건이 연달아
 * 파싱되면서 호출 측이 목록을 그 횟수만큼 다시 받는다. 선행 1회로 즉시 반영하고
 * 이후 이 간격 동안은 눌러뒀다가 구간 끝에 한 번만 더 반영한다.
 */
const PARSED_THROTTLE_MS = 5000;

/**
 * 신규 공시 SSE 구독.
 * 연결이 살아 있으면 폴링이 불필요하고, 끊기면 호출 측이 폴링으로 되돌아간다.
 */
export function useDisclosureStream({ onNew, onParsed }: Options) {
  const [connected, setConnected] = useState(false);
  const handlers = useRef({ onNew, onParsed });
  handlers.current = { onNew, onParsed };

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let backoff = 1000;
    let lastParsed = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;

    //	재연결해도 상태가 유지되도록 connect 바깥에 둔다
    const emitParsed = () => {
      const since = Date.now() - lastParsed;
      if (since >= PARSED_THROTTLE_MS) {
        lastParsed = Date.now();
        handlers.current.onParsed();
        return;
      }
      if (trailing) return;
      trailing = setTimeout(() => {
        trailing = null;
        lastParsed = Date.now();
        handlers.current.onParsed();
      }, PARSED_THROTTLE_MS - since);
    };

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/stream");

      es.addEventListener("connected", () => {
        setConnected(true);
        backoff = 1000;
      });

      es.addEventListener("disclosures", e => {
        try {
          const list = JSON.parse((e as MessageEvent).data);
          if (Array.isArray(list) && list.length > 0) handlers.current.onNew(list.length);
        } catch {
          handlers.current.onNew(1);
        }
      });

      es.addEventListener("parsed", emitParsed);

      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (closed) return;
        // 지수 백오프로 재연결. 그동안은 호출 측 폴링이 공백을 메운다.
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (trailing) clearTimeout(trailing);
      es?.close();
    };
  }, []);

  return connected;
}
