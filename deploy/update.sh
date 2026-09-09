#!/usr/bin/env bash
#
# dart 서비스 관리 스크립트 (버전 선택 + pull + 기동).
#
#   ./update.sh                        메뉴 — 최근 5개 버전 중 선택
#   ./update.sh latest                 latest 로 재기동
#   ./update.sh 0.1.0                  특정 버전으로 재기동 (롤백도 동일)
#   ./update.sh status | down | logs
#   ./update.sh backfill 2026-09-01    과거 구간 소급 수집
#   ./update.sh reparse                파싱 실패 건 재처리
#
# 설정 파일 경로는 환경변수로 바꾼다:
#   DART_ENV=/opt/bwlee/etc/dart-monitor.env ./update.sh
#   DART_COMPOSE=/opt/bwlee/lib/dart-monitor/docker-compose.deploy.yml ./update.sh
# 기본 탐색 순서: $DART_ENV → /opt/bwlee/etc/dart-monitor.env → 스크립트 옆 .env
#
# 버전 목록은 GHCR API 로 읽는다. private 패키지라 토큰이 필요하다.
# 토큰은 다음 순서로 찾는다:
#   1) $GHCR_TOKEN
#   2) ~/.config/ghcr-token
#   3) ~/.docker/config.json  ← docker login 만 해두면 자동
# 셋 다 없으면 목록 조회를 건너뛰고 태그를 직접 입력받는다.
#
set -euo pipefail

REGISTRY="${DART_REGISTRY:-ghcr.io}"
OWNER="${DART_OWNER:-lbw3973}"
IMAGE_BASE="${DART_IMAGE_BASE:-dart}"
case "${1:-}" in -h|--help)
    awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
    exit 0 ;;
esac

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
    if [ -f "$TOKEN_FILE" ]; then tr -d '\n' < "$TOKEN_FILE"; return; fi
    # docker login 이 저장해 둔 자격증명에서 꺼낸다 (별도 토큰 파일 없이 동작)
    command -v python3 >/dev/null || return 1
    python3 - <<'PYEOF' 2>/dev/null
import base64, json, os
try:
    with open(os.path.expanduser('~/.docker/config.json')) as f:
        auth = json.load(f).get('auths', {}).get('ghcr.io', {}).get('auth')
    if auth:
        print(base64.b64decode(auth).decode().split(':', 1)[1], end='')
except Exception:
    pass
PYEOF
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

#	관리자 API 는 외부에 노출하지 않으므로(Caddy 가 404) 컨테이너 안에서 호출한다
admin_api() {
    $DC exec -T backend sh -c "wget -qO- --post-data='' 'http://localhost:8080$1'"
}

case "${1:-}" in
    backfill)
        FROM="${2:-}"
        [ -n "$FROM" ] || { echo "사용법: $0 backfill 2026-09-01 [2026-09-09]"; exit 1; }
        TO="${3:-}"
        Q="/api/admin/backfill?from=$FROM"
        [ -n "$TO" ] && Q="$Q&to=$TO"
        echo "== 백필 $FROM ~ ${TO:-오늘}"
        admin_api "$Q"
        echo
        echo "   원본 다운로드·파싱은 비동기로 이어집니다. 진행: $0 logs"
        exit 0 ;;
    reparse)
        echo "== 실패 건 재파싱 요청"
        admin_api "/api/admin/reparse?status=FAILED"
        echo; exit 0 ;;
    status) exec $DC ps ;;
    down)   exec $DC down ;;
    logs)   exec $DC logs -f --tail=100 backend ;;
    "")     deploy "$(choose_tag)" ;;
    *)      deploy "$1" ;;
esac
