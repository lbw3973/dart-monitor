#!/usr/bin/env bash
#
# dart 서비스 관리 스크립트.
#
# 프론트와 백엔드는 별개 이미지라 버전을 따로 올린다.
# 프론트만 고쳤으면 프론트만 배포하면 된다.
#
#   ./update.sh                        둘 다 — 각각 버전을 고른다
#   ./update.sh backend                백엔드만 — 버전을 고른다
#   ./update.sh web 0.3.0              프론트만 0.3.0 으로
#   ./update.sh all 0.2.0              둘 다 0.2.0 으로
#   ./update.sh status | down | logs
#   ./update.sh backfill 2026-09-01    과거 구간 소급 수집
#   ./update.sh reparse                파싱 실패 건 재처리
#
# 배포한 버전은 compose 파일 옆의 deployed.env 에 기록된다.
# 그래서 한쪽만 올려도 다른 쪽은 쓰던 버전 그대로 유지된다.
# 비밀값 파일은 읽기만 하므로 root 소유(600)로 두어도 된다.
#
# 설정 파일 경로:
#   DART_ENV=/opt/bwlee/etc/dart-monitor.env ./update.sh
#   기본 탐색: $DART_ENV → /opt/bwlee/etc/dart-monitor.env → 스크립트 옆 .env
#
# 버전 목록은 GHCR API 로 읽는다(private 이라 토큰 필요).
#   1) $GHCR_TOKEN  2) ~/.config/ghcr-token  3) ~/.docker/config.json (docker login)
#   셋 다 없으면 태그를 직접 입력받는다.
#
set -euo pipefail

case "${1:-}" in
    -h|--help) awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; exit 0 ;;
esac

REGISTRY="${DART_REGISTRY:-ghcr.io}"
OWNER="${DART_OWNER:-lbw3973}"
IMAGE_BASE="${DART_IMAGE_BASE:-dart}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="${DART_COMPOSE:-$SCRIPT_DIR/docker-compose.deploy.yml}"
TOKEN_FILE="${GHCR_TOKEN_FILE:-$HOME/.config/ghcr-token}"

if [ -n "${DART_ENV:-}" ]; then ENV_FILE="$DART_ENV"
elif [ -f /opt/bwlee/etc/dart-monitor.env ]; then ENV_FILE=/opt/bwlee/etc/dart-monitor.env
else ENV_FILE="$SCRIPT_DIR/.env"; fi

[ -f "$COMPOSE_FILE" ] || { echo "compose 파일이 없습니다: $COMPOSE_FILE"; exit 1; }
[ -f "$ENV_FILE" ]     || { echo "설정 파일이 없습니다: $ENV_FILE"; exit 1; }

#	볼륨 이름이 디렉터리명에서 오므로 항상 같은 곳에서 실행한다
cd "$(dirname "$COMPOSE_FILE")"

#	배포 상태(현재 태그)는 여기 기록한다. 비밀값 파일에는 쓰지 않는다.
#	--env-file 을 두 번 주면 뒤엣것이 우선한다.
STATE_FILE="$(dirname "$COMPOSE_FILE")/deployed.env"
[ -f "$STATE_FILE" ] || printf 'BACKEND_TAG=latest\nWEB_TAG=latest\n' > "$STATE_FILE"

ENV_ARGS="--env-file $ENV_FILE --env-file $STATE_FILE"
if docker compose version >/dev/null 2>&1; then DC="docker compose $ENV_ARGS -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose $ENV_ARGS -f $COMPOSE_FILE"
else echo "docker compose 를 찾지 못했습니다."; exit 1; fi

# ── 설정 파일 읽기·쓰기 ────────────────────────────────────────

get_tag() { sed -n "s/^$1=//p" "$STATE_FILE" | head -1; }

set_tag() {   # key value — 상태 파일에만 쓴다
    local key="$1" val="$2" tmp
    tmp=$(mktemp)
    grep -v "^$key=" "$STATE_FILE" > "$tmp" || true
    printf '%s=%s\n' "$key" "$val" >> "$tmp"
    cat "$tmp" > "$STATE_FILE"
    rm -f "$tmp"
}

# ── GHCR 태그 목록 ─────────────────────────────────────────────

ghcr_token() {
    if [ -n "${GHCR_TOKEN:-}" ]; then printf '%s' "$GHCR_TOKEN"; return; fi
    if [ -f "$TOKEN_FILE" ]; then tr -d '\n' < "$TOKEN_FILE"; return; fi
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

list_tags() {   # image-suffix (backend|web)
    local pat
    pat=$(ghcr_token) || true
    [ -n "${pat:-}" ] || return 1
    curl -sf -H "Authorization: Bearer $(printf '%s' "$pat" | base64)" \
        "https://$REGISTRY/v2/$OWNER/$IMAGE_BASE-$1/tags/list" 2>/dev/null \
      | sed -n 's/.*"tags":\[\([^]]*\)\].*/\1/p' \
      | tr ',' '\n' | tr -d '" ' \
      | grep -vE '^(latest)?$' \
      | sort -Vr | head -5
}

choose_tag() {   # service — 현재 배포된 버전을 기본값으로 제시한다
    local svc="$1" cur tags i=1
    cur=$(get_tag "$([ "$svc" = backend ] && echo BACKEND_TAG || echo WEB_TAG)")
    tags=$(list_tags "$svc" || true)

    if [ -z "$tags" ]; then
        echo "  ($svc 버전 목록을 가져오지 못했습니다)" >&2
        read -rp "  $svc 태그 [${cur:-latest}]: " t
        printf '%s' "${t:-${cur:-latest}}"
        return
    fi

    echo "  $svc — 현재 ${cur:-latest}" >&2
    while IFS= read -r t; do
        printf '   %d) %s\n' "$i" "$t" >&2
        i=$((i + 1))
    done <<< "$tags"
    printf '   %d) latest\n' "$i" >&2

    read -rp "  번호 [$i]: " sel
    sel="${sel:-$i}"
    if [ "$sel" = "$i" ]; then printf 'latest'; return; fi
    printf '%s' "$(sed -n "${sel}p" <<< "$tags")"
}

# ── 배포 ───────────────────────────────────────────────────────

deploy() {   # service tag
    local svc="$1" tag="$2" key
    [ -n "$tag" ] || { echo "태그가 비었습니다."; exit 1; }
    [ "$svc" = backend ] && key=BACKEND_TAG || key=WEB_TAG

    set_tag "$key" "$tag"
    export "$key=$tag"

    echo "== $IMAGE_BASE-$svc:$tag"
    $DC pull "$svc"
    $DC up -d "$svc"
}

show_state() {
    echo
    printf '  backend %s / web %s\n' "$(get_tag BACKEND_TAG)" "$(get_tag WEB_TAG)"
    $DC ps --format 'table {{.Service}}\t{{.Status}}' 2>/dev/null || $DC ps
}

admin_api() { $DC exec -T backend sh -c "wget -qO- --post-data='' 'http://localhost:8080$1'"; }

# ── 명령 ───────────────────────────────────────────────────────

case "${1:-}" in
    backend|web)
        deploy "$1" "${2:-$(choose_tag "$1")}"
        show_state ;;
    all)
        TAG="${2:-}"
        [ -n "$TAG" ] || { echo "사용법: $0 all <태그>"; exit 1; }
        deploy backend "$TAG"
        deploy web     "$TAG"
        show_state ;;
    backfill)
        [ -n "${2:-}" ] || { echo "사용법: $0 backfill 2026-09-01 [2026-09-09]"; exit 1; }
        Q="/api/admin/backfill?from=$2"
        [ -n "${3:-}" ] && Q="$Q&to=$3"
        echo "== 백필 $2 ~ ${3:-오늘}"
        admin_api "$Q"; echo
        echo "   원본 다운로드·파싱은 비동기로 이어집니다. 진행: $0 logs" ;;
    reparse)
        echo "== 실패 건 재파싱"; admin_api "/api/admin/reparse?status=FAILED"; echo ;;
    status) show_state ;;
    down)   exec $DC down ;;
    logs)   exec $DC logs -f --tail=100 backend ;;
    "")
        deploy backend "$(choose_tag backend)"
        deploy web     "$(choose_tag web)"
        show_state ;;
    *) echo "알 수 없는 명령: $1  ($0 --help)"; exit 1 ;;
esac
