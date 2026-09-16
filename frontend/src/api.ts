import type {
  AdminDisclosure, AdminUser, Comment, CommentBoard, DisclosureDetail, DisclosureSummary,
  Group, Me, PageResponse, ReportType,
} from "./types";
import { GROUP_TYPES } from "./types";

export interface SearchParams {
  /** 상세 유형. 지정되면 group보다 우선한다. */
  type?: ReportType | "";
  /** 상세를 고르지 않았으면(그룹 전체) 그룹에 속한 유형 전체를 조회한다. */
  group?: Group;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function fetchDisclosures(p: SearchParams) {
  const qs = new URLSearchParams();
  // URL은 group=periodic 으로 짧게 유지하고, API에는 유형 목록으로 펼쳐 보낸다.
  // (공시검색 조건은 유형 단위라 그룹 개념을 백엔드에 둘 필요가 없다)
  if (p.type) qs.set("type", p.type);
  else if (p.group) GROUP_TYPES[p.group].forEach(t => qs.append("type", t));
  if (p.q?.trim()) qs.set("q", p.q.trim());
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  qs.set("page", String(p.page ?? 0));
  qs.set("size", String(p.size ?? 50));
  return get<PageResponse<DisclosureSummary>>(`/api/disclosures?${qs}`);
}

export function fetchDetail(rceptNo: string) {
  return get<DisclosureDetail>(`/api/disclosures/${rceptNo}`);
}

export interface Stats {
  today: { total: number; parsed: number; failed: number };
  byType: { report_type: string; parse_status: string; cnt: number }[];
  lastRuns: { detail_ty: string; fetched: number; inserted: number; ok: boolean; started_at: string }[];
}

export function fetchStats() {
  return get<Stats>("/api/stats");
}

/* ── 인증 ── */

export function fetchMe() {
  return get<Me>("/api/auth/me");
}

export const KAKAO_LOGIN_URL = "/api/auth/kakao/login";

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}

/* ── 스크랩 ── */

export function fetchBookmarks(page = 0, size = 50) {
  return get<PageResponse<DisclosureSummary>>(`/api/bookmarks?page=${page}&size=${size}`);
}

async function mutate(path: string, method: "PUT" | "DELETE") {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function addBookmark(rceptNo: string) {
  return mutate(`/api/bookmarks/${rceptNo}`, "PUT");
}

export function removeBookmark(rceptNo: string) {
  return mutate(`/api/bookmarks/${rceptNo}`, "DELETE");
}

/* ── 의견 ── */

/** 최상위 의견과 각 답글을 한 번에 받는다. 답글은 보통 몇 건이라 따로 페이징하지 않는다. */
export function fetchComments(rceptNo: string) {
  return get<Comment[]>(`/api/disclosures/${rceptNo}/comments`);
}

/** parentId 가 있으면 답글. 그 대상이 이미 답글이면 서버가 400을 돌려준다(답글의 답글 금지). */
export async function addComment(rceptNo: string, body: string, parentId?: number) {
  const res = await fetch(`/api/disclosures/${rceptNo}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parentId }),
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<Comment>;
}

export function removeComment(id: number) {
  return mutate(`/api/comments/${id}`, "DELETE");
}

/* ── 관리자 ── */

/** hidden 을 생략하면 전체, true 면 숨긴 것만, false 면 보이는 것만 */
export function fetchAdminDisclosures(q: string, hidden: boolean | null, page = 0) {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  if (hidden !== null) qs.set("hidden", String(hidden));
  qs.set("page", String(page));
  qs.set("size", "50");
  return get<PageResponse<AdminDisclosure>>(`/api/admin/disclosures?${qs}`);
}

async function send<T>(path: string, method: "PUT" | "POST", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function setDisclosureHidden(rceptNo: string, hidden: boolean) {
  return send<AdminDisclosure>(`/api/admin/disclosures/${rceptNo}/hidden`, "PUT", { hidden });
}

export function fetchCommentBoards(limit = 50) {
  return get<CommentBoard[]>(`/api/admin/comment-boards?limit=${limit}`);
}

export function fetchAdminUsers() {
  return get<AdminUser[]>("/api/admin/users");
}

export function setUserAdmin(id: number, admin: boolean) {
  return send<AdminUser>(`/api/admin/users/${id}/admin`, "PUT", { admin });
}
