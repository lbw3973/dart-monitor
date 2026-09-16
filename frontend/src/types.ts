export type ReportType =
  /* 지분공시 */
  | "MAJOR_HOLDING_SIMPLE"
  | "MAJOR_HOLDING_GENERAL"
  | "EXEC_OWNERSHIP"
  /* 정기공시 */
  | "BUSINESS_REPORT"
  | "HALF_YEAR_REPORT"
  | "QUARTER_REPORT"
  | "OTHER";

export type ParseStatus =
  | "PENDING" | "FETCHING" | "FETCHED"
  | "PARSED" | "PARSED_WITH_WARN" | "FAILED" | "SKIPPED";

/** Y=유가(코스피), K=코스닥, N=코넥스, E=기타 */
export type CorpCls = "Y" | "K" | "N" | "E";

export interface DisclosureSummary {
  rceptNo: string;
  corpCode: string;
  corpName: string;
  stockCode: string | null;
  corpCls: CorpCls | null;
  reportNm: string;
  reportType: ReportType;
  correction: boolean;
  flrNm: string | null;
  rceptDt: string;
  parseStatus: ParseStatus;
  dartUrl: string;
  bookmarked: boolean;
  /** 답글까지 포함한 의견 수. 저장 수는 공개하지 않는다 — 스크랩은 개인 기능이다. */
  commentCount?: number;
}

/**
 * 공시에 달린 의견.
 *
 * 답글은 1단까지다 — 최상위 의견만 replies 를 갖고, 답글에는 아예 없다.
 * 화면에도 답글에는 "답글" 버튼을 그리지 않아 더 들어갈 길을 없앤다.
 */
export interface Comment {
  id: number;
  author: string;
  /** 내가 쓴 글이면 삭제할 수 있다 */
  mine: boolean;
  body: string;
  createdAt: string;
  /** 답글이 달린 의견을 지우면 자리만 남긴다 — 대화가 끊기지 않게 */
  deleted: boolean;
  replies?: Comment[];
}

export interface Me {
  authenticated: boolean;
  nickname?: string;
  profileImage?: string;
  admin?: boolean;
}

export interface Section {
  sectionNo: string;
  sectionTitle: string;
  seq: number;
  tableHtml: string;
}

export interface DisclosureDetail {
  disclosure: DisclosureSummary;
  sections: Section[];
  parseError: string | null;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  MAJOR_HOLDING_SIMPLE: "대량보유(약식)",
  MAJOR_HOLDING_GENERAL: "대량보유(일반)",
  EXEC_OWNERSHIP: "임원·주요주주",
  BUSINESS_REPORT: "사업보고서",
  HALF_YEAR_REPORT: "반기보고서",
  QUARTER_REPORT: "분기보고서",
  OTHER: "기타",
};

/**
 * 지분공시는 한색(sky·indigo·emerald), 정기공시는 난색(amber·orange·rose)으로 묶는다.
 * 목록에서 두 그룹이 섞여 보이므로 계열로 구분되면 훑기 쉽다.
 * 정정 배지도 amber를 쓰지만 그쪽은 테두리 없는 작은 딱지라 혼동되지 않는다.
 */
export const REPORT_TYPE_STYLE: Record<ReportType, string> = {
  MAJOR_HOLDING_SIMPLE: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  MAJOR_HOLDING_GENERAL: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  EXEC_OWNERSHIP: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  BUSINESS_REPORT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  HALF_YEAR_REPORT: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  QUARTER_REPORT: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  OTHER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

/* ── 공시 그룹 (화면의 1단 드롭다운) ── */

/**
 * 공시 그룹. 두 그룹을 함께 보는 "전체"는 두지 않는다 —
 * 서식 성격과 보여주는 섹션이 전혀 달라 섞어 놓으면 목록을 훑기 어렵다.
 */
export type Group = "equity" | "periodic";

/** 기본 그룹. 이 서비스가 처음부터 다루던 쪽이다. */
export const DEFAULT_GROUP: Group = "equity";

export const GROUP_LABEL: Record<Group, string> = {
  equity: "5%·임원보고",
  periodic: "정기공시",
};

/** 그룹별 상세 유형. 2단 드롭다운의 항목이고, 순서가 곧 표시 순서다. */
export const GROUP_TYPES: Record<Group, ReportType[]> = {
  equity: ["MAJOR_HOLDING_SIMPLE", "MAJOR_HOLDING_GENERAL", "EXEC_OWNERSHIP"],
  periodic: ["BUSINESS_REPORT", "HALF_YEAR_REPORT", "QUARTER_REPORT"],
};

/** 특정 유형이 속한 그룹. 공유 링크로 type만 들어온 경우 그룹을 되짚는 데 쓴다. */
export function groupOf(type: ReportType | ""): Group {
  return type && GROUP_TYPES.periodic.includes(type) ? "periodic" : DEFAULT_GROUP;
}

export const CORP_CLS_LABEL: Record<CorpCls, string> = {
  Y: "코스피",
  K: "코스닥",
  N: "코넥스",
  E: "기타",
};

/**
 * 배지가 아니라 글자색으로만 구분한다.
 * 목록 첫 줄이 이미 유형·정정·상태 배지로 차 있어서, 배지를 하나 더 넣으면
 * 정작 중요한 유형 배지가 묻힌다.
 */
export const CORP_CLS_STYLE: Record<CorpCls, string> = {
  Y: "text-blue-600 dark:text-blue-400",
  K: "text-violet-600 dark:text-violet-400",
  N: "text-slate-400 dark:text-slate-500",
  E: "text-slate-400 dark:text-slate-500",
};
