#!/usr/bin/env bash
#
# 프로그램 배포 — 이미지를 받아 교체한다.
#
# 프론트와 백엔드는 별개 이미지라 버전을 따로 올린다.
# 프론트만 고쳤으면 프론트만 배포하면 된다.
#
#   ./update-program.sh                    둘 다 — 각각 버전을 고른다
#   ./update-program.sh backend            백엔드만 — 버전을 고른다
#   ./update-program.sh frontend 1.0.0     프론트만 1.0.0 으로
#   ./update-program.sh all 1.0.0          둘 다 1.0.0 으로
#   ./update-program.sh status | down | logs
#
# 데이터 수집·재처리는 update-data.sh 를 쓴다.
#
# 배포한 버전은 compose 파일 옆의 deployed.env 에 기록된다.
# 그래서 한쪽만 올려도 다른 쪽은 쓰던 버전 그대로 유지된다.
#
# 설정 파일 경로:
#   DART_ENV=/opt/bwlee/etc/dart-monitor.env ./update-program.sh
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

. "$(cd "$(dirname "$0")" && pwd)/_common.sh"

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

list_tags() {   # image-suffix (backend|frontend)
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
    cur=$(get_tag "$([ "$svc" = backend ] && echo BACKEND_TAG || echo FRONTEND_TAG)")
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
    [ "$svc" = backend ] && key=BACKEND_TAG || key=FRONTEND_TAG

    set_tag "$key" "$tag"
    export "$key=$tag"

    echo "== $IMAGE_BASE-$svc:$tag"
    $DC pull "$svc"
    #	서비스 이름을 바꾼 적이 있으면 옛 컨테이너가 포트를 쥔 채 남는다
    $DC up -d --remove-orphans "$svc"
}

case "${1:-}" in
    backend|frontend)
        deploy "$1" "${2:-$(choose_tag "$1")}"
        show_state ;;
    all)
        TAG="${2:-}"
        [ -n "$TAG" ] || { echo "사용법: $0 all <태그>"; exit 1; }
        deploy backend  "$TAG"
        deploy frontend "$TAG"
        show_state ;;
    status) show_state ;;
    down)   exec $DC down ;;
    logs)   exec $DC logs -f --tail=100 backend ;;
    "")
        deploy backend  "$(choose_tag backend)"
        deploy frontend "$(choose_tag frontend)"
        show_state ;;
    *) echo "알 수 없는 명령: $1  ($0 --help)"; exit 1 ;;
esac
