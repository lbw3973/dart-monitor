export type ReportType =
  | "MAJOR_HOLDING_SIMPLE"
  | "MAJOR_HOLDING_GENERAL"
  | "EXEC_OWNERSHIP"
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
  OTHER: "기타",
};

export const REPORT_TYPE_STYLE: Record<ReportType, string> = {
  MAJOR_HOLDING_SIMPLE: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  MAJOR_HOLDING_GENERAL: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  EXEC_OWNERSHIP: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  OTHER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

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
