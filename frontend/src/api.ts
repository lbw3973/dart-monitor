import type { DisclosureDetail, DisclosureSummary, Me, PageResponse, ReportType } from "./types";

export interface SearchParams {
  type?: ReportType | "";
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
  if (p.type) qs.set("type", p.type);
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
