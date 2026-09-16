import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import type { DisclosureSummary, PageResponse, Stats } from "./fixtures.ts";
import { detailOf, disclosures } from "./fixtures.ts";

/**
 * 개발 전용 가짜 API.
 *
 * 화면만 손볼 때 백엔드(:8080)와 Postgres까지 띄우는 건 과하다.
 * MOCK_API=1 로 켜면 vite 개발 서버가 /api 를 직접 받아 고정 데이터를 돌려준다.
 * 운영 빌드에는 들어가지 않는다 — 개발 서버 미들웨어일 뿐이다.
 *
 *   npm run dev:mock
 */
export function mockApi(): Plugin {
  const bookmarks = new Set<string>();

  return {
    name: "dev-mock-api",
    apply: "serve",
    // 내부 미들웨어보다 먼저 꽂혀야 :8080 프록시로 새지 않는다.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!path.startsWith("/api/")) return next();
        route(req, res, bookmarks) || next();
      });
    },
  };
}

function route(req: IncomingMessage, res: ServerResponse, bookmarks: Set<string>): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (path === "/api/stream") return stream(res);

  if (path === "/api/auth/me") return json(res, { authenticated: true, nickname: "테스트 계정" });
  if (path === "/api/auth/logout") return json(res, {});

  if (path === "/api/disclosures") return json(res, search(url, bookmarks));

  const detailMatch = /^\/api\/disclosures\/(\d+)$/.exec(path);
  if (detailMatch) {
    const d = detailOf(detailMatch[1], bookmarks);
    return d ? json(res, d) : json(res, { message: "not found" }, 404);
  }

  if (path === "/api/bookmarks" && method === "GET") {
    const saved = disclosures.filter(d => bookmarks.has(d.rceptNo));
    return json(res, page(saved.map(d => mark(d, bookmarks))));
  }

  const bookmarkMatch = /^\/api\/bookmarks\/(\d+)$/.exec(path);
  if (bookmarkMatch) {
    const no = bookmarkMatch[1];
    if (method === "PUT") bookmarks.add(no);
    if (method === "DELETE") bookmarks.delete(no);
    return json(res, { rceptNo: no, bookmarked: bookmarks.has(no) });
  }

  if (path === "/api/stats") return json(res, stats());

  return false;
}

/** 목록 조회 — type·q·기간까지 실제처럼 걸러야 필터를 눌러본 결과가 말이 된다. */
function search(url: URL, bookmarks: Set<string>): PageResponse<DisclosureSummary> {
  const types = url.searchParams.getAll("type");
  const q = (url.searchParams.get("q") ?? "").trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const hit = disclosures.filter(d => {
    if (types.length > 0 && !types.includes(d.reportType)) return false;
    if (q && !`${d.corpName} ${d.reportNm} ${d.flrNm ?? ""}`.includes(q)) return false;
    if (from && d.rceptDt < from) return false;
    if (to && d.rceptDt > to) return false;
    return true;
  });

  return page(hit.map(d => mark(d, bookmarks)));
}

function mark(d: DisclosureSummary, bookmarks: Set<string>): DisclosureSummary {
  return { ...d, bookmarked: bookmarks.has(d.rceptNo) };
}

function page<T>(content: T[]): PageResponse<T> {
  return {
    content,
    page: 0,
    size: 50,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
    last: true,
  };
}

function stats(): Stats {
  return {
    today: { total: disclosures.length, parsed: disclosures.length - 1, failed: 0 },
    byType: disclosures.map(d => ({
      report_type: d.reportType,
      parse_status: d.parseStatus,
      cnt: 1,
    })),
    lastRuns: [
      {
        detail_ty: "D",
        fetched: disclosures.length,
        inserted: disclosures.length,
        ok: true,
        started_at: `${disclosures[0].rceptDt}T09:05:00`,
      },
    ],
  };
}

/**
 * SSE — 연결만 열어두고 아무 일도 일어나지 않는다.
 * 404로 두면 프론트가 백오프로 재연결을 반복해 콘솔이 지저분해지고,
 * streamConnected 가 false라 30초 폴링까지 돌기 때문이다.
 */
function stream(res: ServerResponse): boolean {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("event: connected\ndata: {}\n\n");
  const beat = setInterval(() => res.write(": keep-alive\n\n"), 30_000);
  res.on("close", () => clearInterval(beat));
  return true;
}

function json(res: ServerResponse, body: unknown, status = 200): boolean {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
  return true;
}
