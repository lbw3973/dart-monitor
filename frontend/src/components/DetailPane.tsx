import DOMPurify from "dompurify";
import { useMemo } from "react";
import type { DisclosureDetail, Section } from "../types";
import { REPORT_TYPE_LABEL, REPORT_TYPE_STYLE } from "../types";
import { ShareMenu } from "./ShareMenu";
import { StarButton } from "./StarButton";

interface Props {
  detail: DisclosureDetail | undefined;
  loading: boolean;
  error: unknown;
  onToggleBookmark: () => void;
  onBack: () => void;
  onNotice: (msg: string, tone?: "info" | "warn") => void;
}

export function DetailPane({ detail, loading, error, onToggleBookmark, onBack, onNotice }: Props) {
  if (loading) return <Placeholder text="불러오는 중…" />;
  if (error) return <Placeholder text="상세를 불러오지 못했습니다." />;
  if (!detail) return <Placeholder text="왼쪽 목록에서 공시를 선택하세요." />;

  const d = detail.disclosure;
  const grouped = groupByTitle(detail.sections);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-slate-200 px-3 py-3 sm:px-5 dark:border-slate-700">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {/* 모바일 전용 — 목록으로 돌아간다 */}
          <button
            onClick={onBack}
            className="mr-0.5 rounded px-1 text-sm text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
            aria-label="목록으로"
          >
            ←
          </button>
          <StarButton marked={d.bookmarked} onToggle={onToggleBookmark} size="md" />
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REPORT_TYPE_STYLE[d.reportType]}`}>
            {REPORT_TYPE_LABEL[d.reportType]}
          </span>
          {d.correction && (
            <span className="rounded border border-amber-500/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/50 dark:text-amber-300">
              정정
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ShareMenu disclosure={d} onNotice={onNotice} />
            <a
              href={d.dartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs whitespace-nowrap text-sky-600 hover:underline dark:text-sky-400"
            >
              DART 원문 ↗
            </a>
          </div>
        </div>

        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {d.corpName}
          {d.stockCode && (
            <span className="ml-2 text-xs font-normal tabular-nums text-slate-400">{d.stockCode}</span>
          )}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {d.reportNm} · 제출인 {d.flrNm ?? "-"} · {d.rceptDt} · <span className="tabular-nums">{d.rceptNo}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {/* 내부 오류 문자열은 노출하지 않는다 — 사용자에게 의미가 없고 정보 노출이기도 하다.
            상세 원인은 서버 로그와 parse_status로 확인한다. */}
        {d.parseStatus === "FAILED" && (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            이 공시는 자동 추출에 실패했습니다. 위의 <b>DART 원문</b> 링크에서 확인해 주세요.
          </div>
        )}

        {grouped.length === 0 ? (
          <p className="text-xs text-slate-400">
            {d.parseStatus === "FAILED"
              ? "표를 추출하지 못했습니다."
              : "원본을 받는 중입니다. 접수 직후에는 DART가 원본을 제공하기까지 몇 분 걸립니다."}
          </p>
        ) : (
          grouped.map(([title, secs]) => (
            <section key={title} className="mb-7 last:mb-0">
              <h3 className="mb-2 border-l-3 border-sky-500 pl-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {title}
              </h3>
              {secs.map(s => (
                <Block key={`${s.sectionNo}-${s.seq}`} html={s.tableHtml} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * 섹션을 이루는 블록 하나 — 표, 소제목, 문단 중 하나다.
 * 정기공시는 표 사이에 소제목·문단이 섞여 들어오므로(§DartDocumentParser.collectBlocks)
 * 종류에 따라 간격을 달리해 소제목이 뒤따르는 표에 붙어 보이게 한다.
 */
function Block({ html }: { html: string }) {
  // 백엔드가 화이트리스트로 재구성한 HTML이지만, 브라우저 삽입 전 한 번 더 정화한다
  const clean = useMemo(
    () => DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }),
    [html],
  );
  const spacing = html.startsWith("<h4")
    ? "mt-3 mb-1"
    : html.startsWith("<p")
      ? "mb-2"
      : "mb-3";
  return (
    <div className={`dart-table overflow-x-auto last:mb-0 ${spacing}`}>
      <div dangerouslySetInnerHTML={{ __html: clean }} />
    </div>
  );
}

/**
 * 제목 단위로 묶는다. 임원보고서는 3번 섹션 하나에 가/나/다가 각각 다른 제목으로 들어오므로
 * section_no로 묶으면 나·다 표가 "가." 제목 아래에 붙어버린다.
 * 백엔드가 이미 section_no, seq 순으로 정렬해 주므로 등장 순서를 그대로 유지한다.
 */
function groupByTitle(sections: Section[]): [string, Section[]][] {
  const map = new Map<string, Section[]>();
  for (const s of sections) {
    const list = map.get(s.sectionTitle) ?? [];
    list.push(s);
    map.set(s.sectionTitle, list);
  }
  return [...map.entries()];
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-slate-400">{text}</div>
  );
}
