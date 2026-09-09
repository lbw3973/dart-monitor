#!/usr/bin/env bash
#
# dart 서비스 관리 스크립트 (버전 선택 + pull + 기동).
#
#   ./update.sh                 메뉴 — 최근 5개 버전 중 선택
#   ./update.sh latest          latest 로 재기동
#   ./update.sh 0.1.0           특정 버전으로 재기동
#   ./update.sh status | down | logs
#
# 태그는 DART_TAG 환경변수로도 준다:  DART_TAG=0.1.0 ./update.sh
#
# 버전 목록은 GHCR API 로 읽는다. private 패키지라 토큰이 필요하다.
#   ~/.config/ghcr-token 에 read:packages 토큰을 넣어두거나 GHCR_TOKEN 으로 준다.
#   토큰이 없으면 목록 조회를 건너뛰고 직접 입력받는다.
#
set -euo pipefail

REGISTRY="${DART_REGISTRY:-ghcr.io}"
OWNER="${DART_OWNER:-lbw3973}"
IMAGE_BASE="${DART_IMAGE_BASE:-dart}"
COMPOSE_FILE="${DART_COMPOSE:-$(cd "$(dirname "$0")" && pwd)/docker-compose.deploy.yml}"
TOKEN_FILE="${GHCR_TOKEN_FILE:-$HOME/.config/ghcr-token}"

cd "$(dirname "$COMPOSE_FILE")"

if docker compose version >/dev/null 2>&1; then DC="docker compose -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose -f $COMPOSE_FILE"
else echo "docker compose 를 찾지 못했습니다."; exit 1; fi

[ -f .env ] || { echo ".env 가 없습니다: $(pwd)/.env"; exit 1; }

#	GHCR 태그 목록. 실패해도 스크립트를 죽이지 않는다(직접 입력으로 넘어간다).
ghcr_token() {
    if [ -n "${GHCR_TOKEN:-}" ]; then printf '%s' "$GHCR_TOKEN"; return; fi
    [ -f "$TOKEN_FILE" ] && tr -d '\n' < "$TOKEN_FILE"
}

list_tags() {
    local pkg="$1" pat
    pat=$(ghcr_token) || true
    [ -n "${pat:-}" ] || return 1
    # GHCR 의 /v2/ 는 PAT 를 base64 로 감싼 bearer 를 받는다
    curl -sf -H "Authorization: Bearer $(printf '%s' "$pat" | base64)" \
        "https://$REGISTRY/v2/$OWNER/$pkg/tags/list" 2>/dev/null \
      | sed -n 's/.*"tags":\[\([^]]*\)\].*/\1/p' \
      | tr ',' '\n' | tr -d '" ' \
      | grep -vE '^(latest)?$' \
      | sort -Vr | head -5
}

#	사용할 태그를 정한다
choose_tag() {
    local tags
    tags=$(list_tags "${IMAGE_BASE}-backend" || true)

    if [ -z "$tags" ]; then
        echo "  (버전 목록을 가져오지 못했습니다 — 토큰 미설정이거나 조회 실패)" >&2
        read -rp "  사용할 태그 [latest]: " t
        printf '%s' "${t:-latest}"
        return
    fi

    echo "  사용 가능한 최근 버전:" >&2
    local i=1
    while IFS= read -r t; do
        printf '   %d) %s\n' "$i" "$t" >&2
        i=$((i + 1))
    done <<< "$tags"
    printf '   %d) latest\n' "$i" >&2
    echo >&2

    read -rp "  번호 선택 [$i]: " sel
    sel="${sel:-$i}"
    if [ "$sel" = "$i" ]; then printf 'latest'; return; fi
    printf '%s' "$(sed -n "${sel}p" <<< "$tags")"
}

deploy() {
    local tag="$1"
    [ -n "$tag" ] || { echo "태그가 비었습니다."; exit 1; }

    export IMAGE_TAG="$tag"
    echo
    echo "== ${IMAGE_BASE}-{backend,web}:$tag 받는 중"
    $DC pull

    echo "== 기동"
    $DC up -d

    echo
    sleep 3
    $DC ps --format 'table {{.Service}}\t{{.Status}}'
    echo
    echo "== 완료 (tag=$tag)"
    echo "   로그: $0 logs"
}

case "${1:-}" in
    status) exec $DC ps ;;
    down)   exec $DC down ;;
    logs)   exec $DC logs -f --tail=100 backend ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    "")     deploy "$(choose_tag)" ;;
    *)      deploy "$1" ;;
esac
