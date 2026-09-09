set -euo pipefail

REGISTRY="${DART_REGISTRY:-ghcr.io}"
OWNER="${DART_OWNER:-lbw3973}"
IMAGE_BASE="${DART_IMAGE_BASE:-dart}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="${DART_COMPOSE:-$SCRIPT_DIR/docker-compose.deploy.yml}"
TOKEN_FILE="${GHCR_TOKEN_FILE:-$HOME/.config/ghcr-token}"

#	설정 파일 탐색
if [ -n "${DART_ENV:-}" ]; then
    ENV_FILE="$DART_ENV"
elif [ -f /opt/bwlee/etc/dart-monitor.env ]; then
    ENV_FILE=/opt/bwlee/etc/dart-monitor.env
else
    ENV_FILE="$SCRIPT_DIR/.env"
fi

[ -f "$COMPOSE_FILE" ] || { echo "compose 파일이 없습니다: $COMPOSE_FILE"; exit 1; }
[ -f "$ENV_FILE" ]     || { echo "설정 파일이 없습니다: $ENV_FILE"; exit 1; }

#	볼륨 이름이 디렉터리명에서 오므로 항상 같은 곳에서 실행한다
cd "$(dirname "$COMPOSE_FILE")"

# --env-file 은 compose 의 변수 치환에 쓰인다 (${DOMAIN} 등)
if docker compose version >/dev/null 2>&1; then
    DC="docker compose --env-file $ENV_FILE -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose --env-file $ENV_FILE -f $COMPOSE_FILE"
else
    echo "docker compose 를 찾지 못했습니다."; exit 1
fi

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
    echo "== 설정: $ENV_FILE"
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
