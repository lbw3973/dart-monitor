import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import type {
  AdminUser, DisclosureSummary, PageResponse, Stats, StoredComment,
} from "./fixtures.ts";
import { detailOf, disclosures, seedComments, seedUsers, threadOf } from "./fixtures.ts";

/**
 * MOCK_ANON=1 이면 로그아웃 상태로 띄운다(§package.json dev:anon).
 * 의견 입력창 비활성·카카오 로그인 버튼 같은 비로그인 화면은 이렇게만 확인할 수 있다.
 */
const ANON = !!process.env.MOCK_ANON;

/** 이 개발 서버가 살아 있는 동안만 유지되는 가짜 저장소 */
interface Store {
  bookmarks: Set<string>;
  comments: StoredComment[];
  nextId: number;
  users: AdminUser[];
  /** 관리자가 내린 공시(§V7__disclosure_hidden.sql). 행은 지우지 않는다. */
  hidden: Set<string>;
}

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
  const seed = seedComments();
  const store: Store = {
    bookmarks: new Set<string>(),
    comments: seed,
    nextId: Math.max(...seed.map(c => c.id)) + 1,
    users: seedUsers(),
    hidden: new Set<string>(),
  };

  return {
    name: "dev-mock-api",
    apply: "serve",
    // 내부 미들웨어보다 먼저 꽂혀야 :8080 프록시로 새지 않는다.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!path.startsWith("/api/")) return next();
        route(req, res, store) || next();
      });
    },
  };
}

function route(req: IncomingMessage, res: ServerResponse, store: Store): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";
  const { bookmarks } = store;

  if (path === "/api/stream") return stream(res);

  if (path === "/api/auth/me") {
    if (ANON) return json(res, { authenticated: false });
    return json(res, { authenticated: true, nickname: "테스트 계정", admin: isAdmin(store) });
  }
  if (path === "/api/auth/logout") return json(res, {});

  if (path === "/api/disclosures") return json(res, search(url, store));

  const detailMatch = /^\/api\/disclosures\/(\d+)$/.exec(path);
  if (detailMatch) {
    const d = detailOf(detailMatch[1], bookmarks);
    if (!d) return json(res, { message: "not found" }, 404);
    // 숨긴 공시는 공유 링크로도 열리지 않는다. 관리자만 확인·복구용으로 볼 수 있다.
    if (store.hidden.has(detailMatch[1]) && !isAdmin(store)) {
      return json(res, { message: "not found" }, 404);
    }
    return json(res, { ...d, disclosure: mark(d.disclosure, store) });
  }

  const commentMatch = /^\/api\/disclosures\/(\d+)\/comments$/.exec(path);
  if (commentMatch && method === "GET") {
    return json(res, threadOf(commentMatch[1], store.comments, !ANON, isAdmin(store)));
  }
  if (commentMatch && method === "POST") {
    if (ANON) return json(res, { message: "로그인이 필요합니다" }, 401);
    void post(req, res, commentMatch[1], store);
    return true;
  }

  const oneComment = /^\/api\/comments\/(\d+)$/.exec(path);
  if (oneComment && method === "DELETE") {
    if (ANON) return json(res, { message: "로그인이 필요합니다" }, 401);
    return del(res, Number(oneComment[1]), store);
  }

  if (path === "/api/bookmarks" && method === "GET") {
    const saved = disclosures.filter(
      d => bookmarks.has(d.rceptNo) && !store.hidden.has(d.rceptNo));
    return json(res, page(saved.map(d => mark(d, store))));
  }

  const bookmarkMatch = /^\/api\/bookmarks\/(\d+)$/.exec(path);
  if (bookmarkMatch) {
    const no = bookmarkMatch[1];
    if (method === "PUT") bookmarks.add(no);
    if (method === "DELETE") bookmarks.delete(no);
    return json(res, { rceptNo: no, bookmarked: bookmarks.has(no) });
  }

  if (path === "/api/stats") return json(res, stats());

  if (path.startsWith("/api/admin/")) return admin(req, res, path, method, store);

  return false;
}

/* ── 관리자 ── */

/** 실제 백엔드는 AdminGuard 가 경로 단위로 막는다(§WebConfig.addInterceptors). */
function admin(req: IncomingMessage, res: ServerResponse, path: string, method: string,
               store: Store): boolean {
  if (ANON) return json(res, { message: "로그인이 필요합니다" }, 401);
  if (!isAdmin(store)) return json(res, { message: "관리자만 접근할 수 있습니다" }, 403);

  if (path === "/api/admin/disclosures" && method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const q = (url.searchParams.get("q") ?? "").trim();
    const hidden = url.searchParams.get("hidden");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const hit = disclosures.filter(d => {
      const isHidden = store.hidden.has(d.rceptNo);
      if (hidden === "true" && !isHidden) return false;
      if (hidden === "false" && isHidden) return false;
      if (from && d.rceptDt < from) return false;
      if (to && d.rceptDt > to) return false;
      if (q && !`${d.corpName} ${d.reportNm} ${d.rceptNo}`.includes(q)) return false;
      return true;
    });
    return json(res, page(hit.map(d => adminView(d, store)), url));
  }

  const hideMatch = /^\/api\/admin\/disclosures\/(\d+)\/hidden$/.exec(path);
  if (hideMatch && method === "PUT") {
    void setHidden(req, res, hideMatch[1], store);
    return true;
  }

  if (path === "/api/admin/comment-boards" && method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const q = (url.searchParams.get("q") ?? "").trim();
    const hit = boards(store).filter(
      b => !q || `${b.corpName} ${b.reportNm} ${b.rceptNo}`.includes(q));
    return json(res, page(hit, url));
  }

  if (path === "/api/admin/users" && method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const q = (url.searchParams.get("q") ?? "").trim();
    const hit = store.users
      .filter(u => !q || `${u.nickname} ${u.providerUid}`.includes(q))
      // "ADMIN" < "USER" — 실제 백엔드도 role 오름차순으로 관리자를 위에 둔다
      .slice()
      .sort((a, b) => Number(b.admin) - Number(a.admin) || b.id - a.id);
    return json(res, page(hit, url));
  }

  const roleMatch = /^\/api\/admin\/users\/(\d+)\/admin$/.exec(path);
  if (roleMatch && method === "PUT") {
    void setAdmin(req, res, Number(roleMatch[1]), store);
    return true;
  }

  return json(res, { message: "not found" }, 404);
}

function isAdmin(store: Store): boolean {
  return store.users.some(u => u.me && u.admin);
}

function adminView(d: DisclosureSummary, store: Store) {
  return {
    rceptNo: d.rceptNo,
    corpName: d.corpName,
    reportNm: d.reportNm,
    rceptDt: d.rceptDt,
    parseStatus: d.parseStatus,
    hidden: store.hidden.has(d.rceptNo),
    hiddenAt: store.hidden.has(d.rceptNo) ? new Date().toISOString() : null,
    commentCount: countOf(d.rceptNo, store),
  };
}

async function setHidden(req: IncomingMessage, res: ServerResponse, rceptNo: string, store: Store) {
  const body = (await readJson(req)) as { hidden?: boolean };
  const d = disclosures.find(x => x.rceptNo === rceptNo);
  if (!d) return json(res, { message: "공시를 찾을 수 없습니다" }, 404);
  if (body.hidden) store.hidden.add(rceptNo);
  else store.hidden.delete(rceptNo);
  return json(res, adminView(d, store));
}

/** 의견이 달린 공시만, 최근에 달린 순으로 */
function boards(store: Store) {
  const live = store.comments.filter(c => !c.deleted);
  const byNo = new Map<string, StoredComment[]>();
  for (const c of live) {
    byNo.set(c.rceptNo, [...(byNo.get(c.rceptNo) ?? []), c]);
  }
  return [...byNo.entries()]
    .map(([rceptNo, cs]) => {
      const d = disclosures.find(x => x.rceptNo === rceptNo);
      const lastCommentAt = cs.map(c => c.createdAt).sort().at(-1) ?? "";
      return {
        rceptNo,
        corpName: d?.corpName ?? rceptNo,
        reportNm: d?.reportNm ?? "",
        rceptDt: d?.rceptDt ?? "",
        hidden: store.hidden.has(rceptNo),
        commentCount: cs.length,
        lastCommentAt,
      };
    })
    .sort((a, b) => b.lastCommentAt.localeCompare(a.lastCommentAt));
}

async function setAdmin(req: IncomingMessage, res: ServerResponse, id: number, store: Store) {
  const body = (await readJson(req)) as { admin?: boolean };
  const target = store.users.find(u => u.id === id);
  if (!target) return json(res, { message: "사용자를 찾을 수 없습니다" }, 404);
  // 자기 권한은 스스로 못 내린다 — 마지막 관리자가 내리면 아무도 되돌릴 수 없다
  if (target.me && !body.admin) {
    return json(res, { message: "자신의 관리자 권한은 해제할 수 없습니다" }, 400);
  }
  target.admin = !!body.admin;
  return json(res, target);
}

/** 목록 조회 — type·q·기간까지 실제처럼 걸러야 필터를 눌러본 결과가 말이 된다. */
function search(url: URL, store: Store): PageResponse<DisclosureSummary> {
  const types = url.searchParams.getAll("type");
  const q = (url.searchParams.get("q") ?? "").trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const hit = disclosures.filter(d => {
    // 관리자가 내린 공시는 일반 목록에 나오지 않는다(§V7)
    if (store.hidden.has(d.rceptNo)) return false;
    if (types.length > 0 && !types.includes(d.reportType)) return false;
    if (q && !`${d.corpName} ${d.reportNm} ${d.flrNm ?? ""}`.includes(q)) return false;
    if (from && d.rceptDt < from) return false;
    if (to && d.rceptDt > to) return false;
    return true;
  });

  return page(hit.map(d => mark(d, store)));
}

function mark(d: DisclosureSummary, store: Store): DisclosureSummary {
  return {
    ...d,
    bookmarked: store.bookmarks.has(d.rceptNo),
    commentCount: countOf(d.rceptNo, store),
  };
}

function countOf(rceptNo: string, store: Store): number {
  return store.comments.filter(c => c.rceptNo === rceptNo && !c.deleted).length;
}

/** 의견 등록. 답글의 답글은 여기서 막는다 — 스키마 CHECK 로는 표현되지 않는 규칙이다. */
async function post(req: IncomingMessage, res: ServerResponse, rceptNo: string, store: Store) {
  const body = (await readJson(req)) as { body?: string; parentId?: number };
  const text = (body.body ?? "").trim();
  if (!text) return json(res, { message: "내용이 비어 있습니다" }, 400);

  let parentId: number | null = null;
  if (body.parentId != null) {
    const parent = store.comments.find(c => c.id === body.parentId);
    if (!parent) return json(res, { message: "없는 의견입니다" }, 404);
    if (parent.parentId !== null) return json(res, { message: "답글에는 답글을 달 수 없습니다" }, 400);
    parentId = parent.id;
  }

  const created: StoredComment = {
    id: store.nextId++,
    rceptNo,
    parentId,
    author: "테스트 계정",
    mine: true,
    body: text,
    createdAt: new Date().toISOString(),
    deleted: false,
  };
  store.comments.push(created);
  return json(res, { ...created, replies: parentId === null ? [] : undefined }, 201);
}

/** 답글이 달려 있으면 자리만 남기고, 없으면 통째로 지운다. */
function del(res: ServerResponse, id: number, store: Store): boolean {
  const target = store.comments.find(c => c.id === id);
  if (!target) return json(res, { message: "없는 의견입니다" }, 404);
  if (!target.mine) return json(res, { message: "본인 의견만 지울 수 있습니다" }, 403);

  const hasReply = store.comments.some(c => c.parentId === id && !c.deleted);
  if (hasReply) {
    target.deleted = true;
    target.body = "";
  } else {
    store.comments = store.comments.filter(c => c.id !== id);
  }
  return json(res, { id, deleted: true });
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise(resolve => {
    let raw = "";
    req.on("data", chunk => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * 실제 백엔드처럼 잘라서 준다.
 * url 을 주면 page·size 를 읽어 그 구간만 — 안 주면 통째로(일반 목록은 고정 데이터가 적다).
 */
function page<T>(content: T[], url?: URL): PageResponse<T> {
  const size = url ? Math.min(Number(url.searchParams.get("size")) || 50, 100) : 50;
  const idx = url ? Math.max(Number(url.searchParams.get("page")) || 0, 0) : 0;
  const totalPages = Math.ceil(content.length / size);
  const slice = url ? content.slice(idx * size, idx * size + size) : content;
  return {
    content: slice,
    page: idx,
    size,
    totalElements: content.length,
    totalPages,
    last: idx >= totalPages - 1,
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
