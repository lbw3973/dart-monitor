# ARM 인스턴스 자동 재시도

`Out of host capacity`는 해당 가용 도메인에 ARM 물량이 없다는 뜻이다.
기다렸다 다시 시도하는 것 외에 방법이 없지만, **빠르게 반복하면 OCI가 요청을 차단**한다
(`Too many requests for the user`). 이 스크립트는 간격을 벌려 그 함정을 피한다.

## 준비 (최초 1회)

### 1. SSH 키

```bash
ssh-keygen -t ed25519 -C oracle-dart -f ~/.ssh/oracle_dart
```

### 2. OCI CLI 설치

```bash
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
exec -l $SHELL          # PATH 반영
oci --version
```

### 3. API 키 등록

```bash
oci setup config
```

물어보는 값들:

| 항목 | 어디서 얻나 |
| --- | --- |
| User OCID | 콘솔 우상단 프로필 → **My profile** → OCID 복사 |
| Tenancy OCID | 프로필 → **Tenancy** → OCID 복사 |
| Region | 가입 시 고른 홈 리전 (예: `ap-seoul-1`, `ap-chuncheon-1`) |
| 키 생성 | **Y** — 새 API 키를 만들게 한다 |

키를 만들면 `~/.oci/oci_api_key_public.pem` 경로를 알려준다. 그 내용을 콘솔에 등록해야 한다:

**프로필 → My profile → API keys → Add API key → Paste public key** 에 붙여넣기

등록 후 확인:

```bash
oci iam region list --query 'data[0].name' --raw-output
```

### 4. VCN·퍼블릭 서브넷

콘솔에서 미리 만들어 둔다. 인스턴스 생성 폼에서 만들다 만 상태라면
**Networking → Virtual Cloud Networks → Start VCN Wizard → VCN with Internet Connectivity**로
한 번에 만드는 편이 확실하다. 스크립트가 퍼블릭 서브넷을 자동으로 찾는다.

## 실행

먼저 설정이 제대로 잡혔는지 확인만 한다:

```bash
./deploy/oci-retry-launch.sh --discover
```

이상 없으면 재시도 루프를 돌린다:

```bash
./deploy/oci-retry-launch.sh
```

성공하면 인스턴스 OCID와 공인 IP를 출력하고, macOS에서는 알림도 띄운다.

## 조절 가능한 값

| 환경변수 | 기본 | 설명 |
| --- | --- | --- |
| `OCPUS` | `1` | **1로 시작하는 편이 훨씬 잘 잡힌다.** 확보 후 늘릴 수 있다 |
| `MEM_GB` | `6` | 이 앱은 실사용 약 1GB라 6GB로 충분 |
| `INTERVAL` | `180` | 모든 AD 실패 후 대기(초) |
| `THROTTLE_WAIT` | `900` | 요청 차단(429)을 맞았을 때 대기(초) |
| `MAX_HOURS` | `24` | 이 시간이 지나면 포기 |
| `BOOT_GB` | `50` | 부트 볼륨 |

```bash
# 예: 2 OCPU로 노려보되 더 여유 있게
OCPUS=2 MEM_GB=12 INTERVAL=300 ./deploy/oci-retry-launch.sh
```

## 동작 방식

```
가용 도메인을 돌아가며 시도
├─ 성공              → 공인 IP 출력 후 종료
├─ Out of capacity   → 다음 AD로 즉시 이동
├─ TooManyRequests   → 15분 대기 (기본값)
└─ 그 외 오류        → 즉시 중단
```

마지막 항목이 중요하다. 권한 부족·한도 초과·잘못된 설정은 **재시도해도 소용없으므로**
계속 두드리지 않고 오류를 보여주고 멈춘다.

한 바퀴(모든 AD) 실패하면 `INTERVAL` + 최대 30초 지터만큼 쉰다.
지터를 두는 이유는 여러 사람이 같은 주기로 몰리는 것을 피하기 위해서다.

## 주의

- **간격을 줄이지 말 것.** 60초 미만으로 두면 차단당해 오히려 느려진다
- 백그라운드로 오래 돌릴 거면 `nohup ./deploy/oci-retry-launch.sh > oci-retry.log 2>&1 &`
- 며칠 걸릴 수 있다. 그동안 개발은 로컬에서 계속하면 된다
- 확보 후 사양 변경: 콘솔에서 인스턴스 **중지 → Edit → Shape 변경 → 시작**
