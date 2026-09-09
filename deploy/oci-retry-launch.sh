#!/usr/bin/env bash
#
# Oracle Cloud ARM(Ampere A1) 인스턴스 자동 재시도 생성.
#
# "Out of host capacity"는 물량이 없다는 뜻이라 기다렸다 다시 시도하는 수밖에 없다.
# 다만 빠르게 반복하면 OCI가 요청을 차단(TooManyRequests)하므로 간격을 넉넉히 둔다.
#
#   ./deploy/oci-retry-launch.sh            # 설정 확인 후 재시도 루프 시작
#   ./deploy/oci-retry-launch.sh --discover # 필요한 OCID들을 찾아서 출력만
#
set -uo pipefail

# ── 설정 (환경변수로 덮어쓸 수 있다) ───────────────────────────
DISPLAY_NAME="${DISPLAY_NAME:-bwlee-oracle}"   # 인스턴스는 범용 서버다 — 특정 앱 이름을 붙이지 않는다
SHAPE="${SHAPE:-VM.Standard.A1.Flex}"
OCPUS="${OCPUS:-1}"             # 1로 시작하는 편이 훨씬 잘 잡힌다. 확보 후 늘릴 수 있다
MEM_GB="${MEM_GB:-6}"
BOOT_GB="${BOOT_GB:-50}"
SSH_PUBKEY="${SSH_PUBKEY:-$HOME/.ssh/oracle.pub}"

INTERVAL="${INTERVAL:-180}"     # 한 바퀴(모든 AD) 실패 후 대기 (초)
THROTTLE_WAIT="${THROTTLE_WAIT:-900}"   # 429를 맞으면 이만큼 쉰다
MAX_HOURS="${MAX_HOURS:-24}"    # 이 시간이 지나면 포기

log() { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { printf '\n오류: %s\n' "$*" >&2; exit 1; }

command -v oci >/dev/null || die "OCI CLI가 없습니다.
  설치:  bash -c \"\$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)\"
  설정:  oci setup config"

[[ -f "$SSH_PUBKEY" ]] || die "SSH 공개키가 없습니다: $SSH_PUBKEY
  생성:  ssh-keygen -t ed25519 -C oracle -f ${SSH_PUBKEY%.pub}"

# ── 필요한 OCID 자동 탐색 ──────────────────────────────────────
TENANCY="${OCI_TENANCY:-$(oci iam availability-domain list --query 'data[0]."compartment-id"' --raw-output 2>/dev/null)}"
[[ -n "${TENANCY:-}" ]] || die "테넌시를 찾지 못했습니다. 'oci setup config'를 먼저 실행하세요."

COMPARTMENT="${OCI_COMPARTMENT_ID:-$TENANCY}"

# macOS 기본 bash 3.2에는 mapfile이 없어 while-read로 채운다
ADS=()
while IFS= read -r line; do
    [[ -n "$line" ]] && ADS+=("$line")
done < <(oci iam availability-domain list -c "$TENANCY" \
    --query 'data[].name' --raw-output 2>/dev/null | tr -d '[]," ')
[[ ${#ADS[@]} -gt 0 ]] || die "가용 도메인 목록을 가져오지 못했습니다."

SUBNET="${OCI_SUBNET_ID:-$(oci network subnet list -c "$COMPARTMENT" \
    --query 'data[?"prohibit-public-ip-on-vnic"==`false`]|[0].id' --raw-output 2>/dev/null)}"
[[ -n "${SUBNET:-}" && "$SUBNET" != "null" ]] \
    || die "퍼블릭 서브넷을 찾지 못했습니다. 콘솔에서 VCN/퍼블릭 서브넷을 먼저 만드세요."

IMAGE="${OCI_IMAGE_ID:-$(oci compute image list -c "$COMPARTMENT" \
    --operating-system 'Canonical Ubuntu' --shape "$SHAPE" \
    --sort-by TIMECREATED --sort-order DESC \
    --query 'data[0].id' --raw-output 2>/dev/null)}"
[[ -n "${IMAGE:-}" && "$IMAGE" != "null" ]] || die "Ubuntu ARM 이미지를 찾지 못했습니다."

cat <<INFO

  이름        $DISPLAY_NAME
  형상        $SHAPE  ${OCPUS} OCPU / ${MEM_GB}GB / 부트 ${BOOT_GB}GB
  가용 도메인  ${#ADS[@]}개  (${ADS[*]})
  서브넷      ${SUBNET:0:40}…
  이미지      ${IMAGE:0:40}…
  SSH 키      $SSH_PUBKEY
  간격        한 바퀴 실패 시 ${INTERVAL}초 대기 / 차단 시 ${THROTTLE_WAIT}초

INFO

[[ "${1:-}" == "--discover" ]] && exit 0

# ── 재시도 루프 ────────────────────────────────────────────────
PUBKEY_CONTENT="$(cat "$SSH_PUBKEY")"
METADATA="$(printf '{"ssh_authorized_keys":"%s"}' "$PUBKEY_CONTENT")"
SHAPE_CONFIG="$(printf '{"ocpus":%s,"memoryInGBs":%s}' "$OCPUS" "$MEM_GB")"

DEADLINE=$(( $(date +%s) + MAX_HOURS * 3600 ))
attempt=0

while (( $(date +%s) < DEADLINE )); do
    for AD in "${ADS[@]}"; do
        attempt=$((attempt + 1))
        log "시도 #${attempt}  AD=${AD##*:}"

        OUT=$(oci compute instance launch \
                --availability-domain "$AD" \
                --compartment-id "$COMPARTMENT" \
                --display-name "$DISPLAY_NAME" \
                --shape "$SHAPE" \
                --shape-config "$SHAPE_CONFIG" \
                --image-id "$IMAGE" \
                --subnet-id "$SUBNET" \
                --assign-public-ip true \
                --boot-volume-size-in-gbs "$BOOT_GB" \
                --metadata "$METADATA" \
                --wait-for-state RUNNING \
                2>&1)
        RC=$?

        if [[ $RC -eq 0 ]]; then
            ID=$(printf '%s' "$OUT" | grep -o '"id": *"ocid1.instance[^"]*"' | head -1 | cut -d'"' -f4)
            log "✅ 생성 성공"
            IP=$(oci compute instance list-vnics --instance-id "$ID" \
                    --query 'data[0]."public-ip"' --raw-output 2>/dev/null)
            printf '\n  인스턴스  %s\n  공인 IP   %s\n\n  접속:  ssh -i %s ubuntu@%s\n\n' \
                "$ID" "$IP" "${SSH_PUBKEY%.pub}" "$IP"
            command -v osascript >/dev/null && \
                osascript -e 'display notification "인스턴스 생성 완료" with title "Oracle Cloud"' 2>/dev/null
            exit 0
        fi

        if grep -qi 'out of host capacity\|OutOfCapacity' <<<"$OUT"; then
            log "   물량 없음 — 다음 AD"
            continue
        fi

        if grep -qi 'TooManyRequests\|429\|too many requests' <<<"$OUT"; then
            log "   ⚠️ 요청 차단됨 — ${THROTTLE_WAIT}초 대기"
            sleep "$THROTTLE_WAIT"
            continue
        fi

        # 용량 문제가 아닌 오류(권한, 한도 초과, 잘못된 설정 등)는 재시도해도 소용없다
        printf '\n예상치 못한 오류 — 중단합니다:\n%s\n' "$OUT" >&2
        exit 1
    done

    JITTER=$(( RANDOM % 30 ))
    log "한 바퀴 실패 — $((INTERVAL + JITTER))초 대기"
    sleep $(( INTERVAL + JITTER ))
done

log "제한 시간(${MAX_HOURS}시간) 초과 — 종료"
exit 2
