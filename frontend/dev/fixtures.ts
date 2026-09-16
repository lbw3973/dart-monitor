import type {
  Comment, DisclosureDetail, DisclosureSummary, PageResponse, Section,
} from "../src/types.ts";

export type { Comment, DisclosureDetail, DisclosureSummary, PageResponse, Section };

/** src/api.ts 의 Stats 와 같은 모양. 그쪽은 DOM(fetch)을 함께 들고 있어 여기에 다시 적는다. */
export interface Stats {
  today: { total: number; parsed: number; failed: number };
  byType: { report_type: string; parse_status: string; cnt: number }[];
  lastRuns: { detail_ty: string; fetched: number; inserted: number; ok: boolean; started_at: string }[];
}

/**
 * 기본 검색 기간이 "오늘 포함 최근 7일"이라(§useUrlState.defaultRange)
 * 날짜를 고정해 두면 언젠가 목록이 비어 버린다. 실행 시점 기준으로 만든다.
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DATES = [daysAgo(0), daysAgo(1), daysAgo(3)];
const rceptNo = (date: string, seq: string) => date.replace(/-/g, "") + seq;

const NO = [
  rceptNo(DATES[0], "000412"),
  rceptNo(DATES[1], "000178"),
  rceptNo(DATES[2], "000903"),
];

/**
 * 실존 기업의 공시를 지어내지 않으려고 회사·보고자 이름은 모두 가상이다.
 * 확인해야 할 건 배지·정렬·아이콘이지 내용이 아니다.
 */
export const disclosures: DisclosureSummary[] = [
  {
    rceptNo: NO[0],
    corpCode: "00912345",
    corpName: "한빛중공업",
    stockCode: "004560",
    corpCls: "Y",
    reportNm: "주식등의대량보유상황보고서(일반)",
    reportType: "MAJOR_HOLDING_GENERAL",
    correction: false,
    flrNm: "케이앤파트너스 사모투자합자회사",
    rceptDt: DATES[0],
    parseStatus: "PARSED",
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${NO[0]}`,
    bookmarked: false,
  },
  {
    rceptNo: NO[1],
    corpCode: "00874321",
    corpName: "대성테크놀로지",
    stockCode: "213470",
    corpCls: "K",
    reportNm: "임원ㆍ주요주주특정증권등소유상황보고서",
    reportType: "EXEC_OWNERSHIP",
    correction: true,
    flrNm: "정하윤",
    rceptDt: DATES[1],
    parseStatus: "PARSED_WITH_WARN",
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${NO[1]}`,
    bookmarked: false,
  },
  {
    rceptNo: NO[2],
    corpCode: "00660987",
    corpName: "서진바이오사이언스",
    stockCode: "391220",
    corpCls: "K",
    reportNm: "주식등의대량보유상황보고서(약식)",
    reportType: "MAJOR_HOLDING_SIMPLE",
    correction: false,
    flrNm: "한서자산운용",
    rceptDt: DATES[2],
    parseStatus: "PARSED",
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${NO[2]}`,
    bookmarked: false,
  },
];

const th = (s: string) => `<th>${s}</th>`;
const td = (s: string, wrap = false) => `<td${wrap ? ' data-wrap=""' : ""}>${s}</td>`;
const tr = (cells: string) => `<tr>${cells}</tr>`;
const table = (rows: string) => `<table><tbody>${rows}</tbody></table>`;

const SECTIONS: Record<string, Section[]> = {
  [NO[0]]: [
    {
      sectionNo: "1",
      sectionTitle: "발행회사에 관한 사항",
      seq: 0,
      tableHtml: table(
        tr(th("발행회사명") + td("한빛중공업") + th("종목코드") + td("004560")) +
        tr(th("발행회사와의 관계") + td("해당사항 없음") + th("시장구분") + td("유가증권시장"))
      ),
    },
    {
      sectionNo: "2",
      sectionTitle: "대량보유자에 관한 사항",
      seq: 0,
      tableHtml: table(
        tr(th("성명(명칭)") + th("생년월일 또는 사업자등록번호") + th("주소")) +
        tr(
          td("케이앤파트너스 사모투자합자회사") +
          td("110-86-00000") +
          td("서울특별시 영등포구 여의대로 000, 00층", true)
        )
      ),
    },
    {
      sectionNo: "3",
      sectionTitle: "보유주식등에 관한 사항",
      seq: 0,
      tableHtml:
        `<h4>가. 보유주식등의 수 및 보유비율</h4>` +
        table(
          tr(
            `<th rowspan="2">보고서 작성기준일</th>` +
            `<th colspan="2">보유주식등의 수</th>` +
            `<th colspan="2">보유비율</th>`
          ) +
          tr(th("직전 보고서") + th("이번 보고서") + th("직전 보고서") + th("이번 보고서")) +
          tr(td(DATES[0]) + td("1,204,880") + td("1,682,310") + td("7.12%") + td("9.94%"))
        ),
    },
    {
      sectionNo: "3",
      sectionTitle: "보유주식등에 관한 사항",
      seq: 1,
      tableHtml:
        `<h4>나. 변동 사유</h4>` +
        `<p>장내매수를 통한 추가 취득이며, 경영권에 영향을 주기 위한 목적이 아닙니다.</p>`,
    },
  ],

  [NO[1]]: [
    {
      sectionNo: "1",
      sectionTitle: "발행회사에 관한 사항",
      seq: 0,
      tableHtml: table(
        tr(th("발행회사명") + td("대성테크놀로지") + th("종목코드") + td("213470")) +
        tr(th("시장구분") + td("코스닥시장") + th("결산월") + td("12월"))
      ),
    },
    {
      sectionNo: "2",
      sectionTitle: "보고자에 관한 사항",
      seq: 0,
      tableHtml: table(
        tr(th("성명") + td("정하윤") + th("발행회사와의 관계") + td("등기임원(사내이사)")) +
        tr(
          th("정정 사유") +
          td("최초 보고 시 장내매도 수량을 잘못 기재하여 정정합니다.", true) +
          th("정정 연월일") +
          td(DATES[1])
        )
      ),
    },
    {
      sectionNo: "3",
      sectionTitle: "특정증권등의 소유상황",
      seq: 0,
      tableHtml:
        `<h4>가. 특정증권등의 소유상황</h4>` +
        table(
          tr(th("보고사유") + th("특정증권등의 종류") + th("변동일") + th("변동수량") + th("소유 후 수량")) +
          tr(td("장내매도") + td("보통주") + td(DATES[1]) + td("△12,000") + td("148,500"))
        ),
    },
  ],

  [NO[2]]: [
    {
      sectionNo: "1",
      sectionTitle: "발행회사에 관한 사항",
      seq: 0,
      tableHtml: table(
        tr(th("발행회사명") + td("서진바이오사이언스") + th("종목코드") + td("391220")) +
        tr(th("보고구분") + td("신규") + th("시장구분") + td("코스닥시장"))
      ),
    },
    {
      sectionNo: "2",
      sectionTitle: "보유주식등에 관한 사항",
      seq: 0,
      tableHtml: table(
        tr(th("보고자") + th("보유 주식수") + th("보유비율") + th("보유목적")) +
        tr(td("한서자산운용") + td("612,400") + td("5.03%") + td("단순투자"))
      ),
    },
  ],
};

export function detailOf(no: string, bookmarks: Set<string>): DisclosureDetail | null {
  const d = disclosures.find(x => x.rceptNo === no);
  if (!d) return null;
  return {
    disclosure: { ...d, bookmarked: bookmarks.has(no) },
    sections: SECTIONS[no] ?? [],
    parseError: null,
  };
}

/* ── 의견 ── */

/** 서버가 보관하는 모양 — 평평한 한 줄짜리. 화면에 줄 때만 답글을 묶는다. */
export interface StoredComment {
  id: number;
  rceptNo: string;
  parentId: number | null;
  author: string;
  mine: boolean;
  body: string;
  createdAt: string;
  deleted: boolean;
}

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

/**
 * 시드 의견. 확인해야 할 건 답글 1단·삭제 자리표시·빈 목록이라
 * 세 가지가 다 나오도록 골라 뒀다.
 */
export function seedComments(): StoredComment[] {
  return [
    {
      id: 1, rceptNo: NO[0], parentId: null, author: "이준호", mine: false, deleted: false,
      createdAt: minutesAgo(182),
      body: "7.12% → 9.94%. 변동 사유에는 경영권 목적이 아니라고 적혀 있는데, 한 달 새 2.8%p면 다음 보고서까지 봐야 그림이 나올 것 같습니다.",
    },
    {
      id: 2, rceptNo: NO[0], parentId: 1, author: "박서연", mine: false, deleted: false,
      createdAt: minutesAgo(97),
      body: "정정 아니고 신규 접수 맞습니다. 접수번호 끝자리가 다르네요.",
    },
    {
      id: 3, rceptNo: NO[0], parentId: 1, author: "테스트 계정", mine: true, deleted: false,
      createdAt: minutesAgo(41),
      body: "확인 감사합니다. 원문 대조해 보니 맞네요.",
    },
    {
      id: 4, rceptNo: NO[0], parentId: null, author: "김도현", mine: false, deleted: true,
      createdAt: minutesAgo(1_500),
      body: "",
    },
    {
      id: 5, rceptNo: NO[0], parentId: 4, author: "최유진", mine: false, deleted: false,
      createdAt: minutesAgo(1_440),
      body: "위 의견은 지워졌지만 답글은 남습니다 — 대화가 끊기지 않게.",
    },
    {
      id: 6, rceptNo: NO[1], parentId: null, author: "정민석", mine: false, deleted: false,
      createdAt: minutesAgo(12),
      body: "정정 사유가 장내매도 수량 오기재인데, 소유 후 수량은 그대로입니다. 어느 쪽이 맞는 건가요?",
    },
  ];
}

/**
 * 평평한 목록을 화면이 쓰는 모양(최상위 + 답글)으로 묶는다.
 * authed=false 면 내 글 판정도 끈다 — 실제 백엔드가 세션으로 정하는 값이다.
 */
export function threadOf(rceptNo: string, all: StoredComment[], authed = true): Comment[] {
  const mine = all.filter(c => c.rceptNo === rceptNo);
  const view = (c: StoredComment): Comment => ({
    id: c.id,
    author: c.author,
    mine: authed && c.mine,
    body: c.deleted ? "" : c.body,
    createdAt: c.createdAt,
    deleted: c.deleted,
  });

  return mine
    .filter(c => c.parentId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(c => ({
      ...view(c),
      replies: mine
        .filter(r => r.parentId === c.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(view),
    }));
}
