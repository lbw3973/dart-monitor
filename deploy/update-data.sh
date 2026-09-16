#!/usr/bin/env bash
#
# 데이터 수집·재처리 — 공시 종류와 기간을 골라 받아온다.
#
#   ./update-data.sh                   대화식 — 공시 종류와 기간을 고른다
#   ./update-data.sh backfill A002 2026-08-01 2026-08-31
#   ./update-data.sh backfill A001,A002,A003 2026-09-01
#   ./update-data.sh reparse           파싱 실패 건 재처리
#   ./update-data.sh status            수집 현황
#
# 프로그램 배포는 update-program.sh 를 쓴다.
#
# 종류를 고르는 이유:
#   섹션 규칙을 바꾼 뒤에는 그 서식만 다시 받으면 된다. 전체를 돌리면
#   규칙이 그대로인 서식까지 원본을 다시 내려받아 시간과 API 호출을 버린다.
#
# 기간 제한:
#   공시검색 API는 회사코드 없이 조회할 때 구간이 3개월까지다.
#   더 과거를 받으려면 구간을 나눠 여러 번 실행한다.
#
set -euo pipefail

case "${1:-}" in
    -h|--help) awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; exit 0 ;;
esac

. "$(cd "$(dirname "$0")" && pwd)/_common.sh"

#	공시상세유형 — application.yml 의 dart.detail-types 와 맞춰야 한다.
#	코드|이름|설명 순서이고, 목록에 보이는 순서가 곧 번호다.
TYPES=(
    "D001|대량보유상황보고|5% 지분 변동"
    "D002|임원·주요주주 소유상황|특정증권등 소유"
    "A001|사업보고서|정기공시 (연 1회, 3월)"
    "A002|반기보고서|정기공시 (연 1회, 8월)"
    "A003|분기보고서|정기공시 (연 2회, 5·11월)"
)

#	한글은 printf 의 %-Ns 가 바이트로 세어 열이 어긋난다.
#	코드(ASCII)만 폭을 맞추고 이름·설명은 구분자로 나눈다.
show_types() {
    echo "  수집할 공시 종류"
    local i=1 code name desc
    for row in "${TYPES[@]}"; do
        IFS='|' read -r code name desc <<< "$row"
        printf '   %d) %-5s %s — %s\n' "$i" "$code" "$name" "$desc"
        i=$((i + 1))
    done
    printf '   %d) %-5s 지분공시 — D001 + D002\n'          "$i"       ""
    printf '   %d) %-5s 정기공시 — A001 + A002 + A003\n'   "$((i+1))" ""
    printf '   %d) %-5s 전체 — 위 5종 모두\n'              "$((i+2))" ""
}

#	번호 → 코드 목록(쉼표 구분)
resolve_choice() {
    local sel="$1" n=${#TYPES[@]}
    if [ "$sel" -ge 1 ] 2>/dev/null && [ "$sel" -le "$n" ]; then
        printf '%s' "$(cut -d'|' -f1 <<< "${TYPES[$((sel-1))]}")"
    elif [ "$sel" = "$((n+1))" ]; then printf 'D001,D002'
    elif [ "$sel" = "$((n+2))" ]; then printf 'A001,A002,A003'
    elif [ "$sel" = "$((n+3))" ]; then printf ''      # 빈 값 = 서버가 전체를 돈다
    else return 1
    fi
}

run_backfill() {   # codes from [to]
    local codes="$1" from="$2" to="${3:-}"
    local q="/api/admin/backfill?from=$from"
    [ -n "$to" ] && q="$q&to=$to"
    #	detailTy 는 반복 지정한다. 비어 있으면 서버가 설정된 전체를 돈다.
    #	IFS 를 바꿔 자르면 함수 끝까지 남아 뒤따르는 $DC 가 분리되지 않는다. tr 로 바꾼다.
    local c
    for c in $(tr ',' ' ' <<< "$codes"); do q="$q&detailTy=$c"; done

    echo
    echo "== 백필  종류=${codes:-전체}  기간=$from ~ ${to:-오늘}"
    admin_api "$q"; echo
    echo
    echo "   목록 저장까지 끝났습니다. 원본 다운로드와 파싱은 백그라운드로 이어집니다."
    echo "   진행 상황:  $0 status"
}

case "${1:-}" in
    backfill)
        [ -n "${3:-}" ] || { echo "사용법: $0 backfill <종류> <시작일> [종료일]"; exit 1; }
        run_backfill "$2" "$3" "${4:-}" ;;

    reparse)
        echo "== 파싱 실패 건 재처리"
        admin_api "/api/admin/reparse?status=FAILED"; echo ;;

    status)
        echo "== 수집 현황"
        db_query "select report_type as 서식, parse_status as 상태, count(*) as 건수
                    from disclosure group by 1,2 order by 3 desc"
        echo "== 섹션"
        db_query "select section_no as 순서, section_title as 섹션, count(*) as 블록
                    from disclosure_section group by 1,2 order by 1,2" ;;

    "")
        show_types
        read -rp "  번호: " sel
        CODES=$(resolve_choice "$sel") || { echo "잘못된 번호입니다."; exit 1; }

        DEFAULT_FROM=$(date -u -d '7 days ago' +%F 2>/dev/null || date -u -v-7d +%F)
        read -rp "  시작일 [$DEFAULT_FROM]: " FROM
        FROM="${FROM:-$DEFAULT_FROM}"
        read -rp "  종료일 [오늘]: " TO

        echo
        echo "  종류: ${CODES:-전체}"
        echo "  기간: $FROM ~ ${TO:-오늘}"
        read -rp "  진행할까요? [y/N]: " OK
        [ "$OK" = "y" ] || [ "$OK" = "Y" ] || { echo "취소했습니다."; exit 0; }

        run_backfill "$CODES" "$FROM" "$TO" ;;

    *) echo "알 수 없는 명령: $1  ($0 --help)"; exit 1 ;;
esac
