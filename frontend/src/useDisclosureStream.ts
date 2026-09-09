import { useEffect, useRef, useState } from "react";

interface Options {
  onNew: (count: number) => void;
  onParsed: () => void;
}

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

      es.addEventListener("parsed", () => handlers.current.onParsed());

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
      es?.close();
    };
  }, []);

  return connected;
}
