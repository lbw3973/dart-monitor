export type ReportType =
  | "MAJOR_HOLDING_SIMPLE"
  | "MAJOR_HOLDING_GENERAL"
  | "EXEC_OWNERSHIP"
  | "OTHER";

export type ParseStatus =
  | "PENDING" | "FETCHING" | "FETCHED"
  | "PARSED" | "PARSED_WITH_WARN" | "FAILED" | "SKIPPED";

export interface DisclosureSummary {
  rceptNo: string;
  corpCode: string;
  corpName: string;
  stockCode: string | null;
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
