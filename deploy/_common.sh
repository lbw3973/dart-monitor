#!/usr/bin/env bash
#
# update-program.sh / update-data.sh 가 함께 쓰는 설정.
# 단독 실행용이 아니라 source 로 읽어 들인다.
#
# compose·비밀값 파일을 찾는 규칙이 미묘해서(탐색 순서, --env-file 두 번, 볼륨 이름)
# 두 스크립트에 복사하면 한쪽만 고쳤을 때 조용히 어긋난다. 그래서 여기 모은다.

REGISTRY="${DART_REGISTRY:-ghcr.io}"
OWNER="${DART_OWNER:-lbw3973}"
IMAGE_BASE="${DART_IMAGE_BASE:-dart}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
[ -f "$STATE_FILE" ] || printf 'BACKEND_TAG=latest\nFRONTEND_TAG=latest\n' > "$STATE_FILE"

ENV_ARGS="--env-file $ENV_FILE --env-file $STATE_FILE"
if docker compose version >/dev/null 2>&1; then DC="docker compose $ENV_ARGS -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose $ENV_ARGS -f $COMPOSE_FILE"
else echo "docker compose 를 찾지 못했습니다."; exit 1; fi

get_tag() { sed -n "s/^$1=//p" "$STATE_FILE" | head -1; }

set_tag() {   # key value — 상태 파일에만 쓴다
    local key="$1" val="$2" tmp
    tmp=$(mktemp)
    grep -v "^$key=" "$STATE_FILE" > "$tmp" || true
    printf '%s=%s\n' "$key" "$val" >> "$tmp"
    cat "$tmp" > "$STATE_FILE"
    rm -f "$tmp"
}

show_state() {
    echo
    printf '  backend %s / frontend %s\n' "$(get_tag BACKEND_TAG)" "$(get_tag FRONTEND_TAG)"
    $DC ps --format 'table {{.Service}}\t{{.Status}}' 2>/dev/null || $DC ps
}

#	운영 배치 API(/api/ops/*)는 Caddy가 외부에 404로 막으므로 컨테이너 안에서 호출한다.
#	쿠키가 없어도 되는 이유가 여기 있다 — 네트워크 경계가 곧 통제다(§OpsController).
#	--timeout=0: 백필은 구간이 길면 수 분이 걸린다.
ops_api() {
    $DC exec -T backend sh -c \
        "wget -qO- --timeout=0 --post-data='' 'http://localhost:8080$1'"
}

#	DB 한 줄 조회 (진행 상황 확인용)
db_query() { $DC exec -T postgres psql -U dart -d dart -c "$1"; }
