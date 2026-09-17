# DART 지분공시 수집·조회 시스템

전자공시(DART)의 **5%·임원보고**를 1분마다 수집해, 보고서 유형별 지정 섹션의 표를
**원문 그대로** 저장하고 웹에서 조회한다.

| 보고서 | 저장 섹션 |
| --- | --- |
| 주식등의 대량보유상황보고서 **(약식)** | 1부 3(보유주식등의 수 및 보유비율), 4(변동[변경]사유) |
| 주식등의 대량보유상황보고서 **(일반)** | 1부 3, 4(보유목적), 5(변동[변경]사유) |
| 임원ㆍ주요주주 특정증권등 소유상황보고서 | 3. 특정증권등의 소유상황 (가·나·다) |

**스택**: PostgreSQL 16 · Spring Boot 4 (Java 21) · React 19 + Vite · Caddy

---

## 로컬 개발

사전 준비: Docker, pnpm. **JDK는 없어도 된다** — Gradle 툴체인이 JDK 21을 자동으로 받아온다.

```bash
cp .env.example .env && chmod 600 .env
vi .env                                   # DART_API_KEY, KAKAO_* 입력

docker compose up -d                      # ① Postgres (localhost:5433)
cd backend  && set -a && . ../.env && set +a && ./gradlew bootRun   # ② 백엔드 :8080
cd frontend && pnpm install && pnpm dev                             # ③ 프론트 :5173
```

`http://localhost:5173` 접속. 1분 뒤부터 공시가 쌓인다.

---

## 배포

이미지는 맥에서 빌드해 레지스트리에 올리고, 서버는 받아서 실행만 한다.
서버(2GB)에서 Gradle 빌드를 돌리면 느리고 OOM 위험이 있다.

### 1. 이미지 빌드 · 푸시 (맥)

프론트와 백엔드는 **별개 이미지이고 버전도 따로 간다.** 고친 쪽만 올리면 된다.

```bash
make docker-frontend   # 프론트만
make docker-backend    # 백엔드만
make docker            # 둘 다
```

버전은 `Makefile`의 `FRONTEND_VERSION` / `BACKEND_VERSION`을 각각 올린다.
`t4g`(Graviton)가 ARM이므로 `linux/arm64`로 빌드한다.

### 2. 서버에 파일 전송

서버에 필요한 건 셋뿐이다. 소스코드는 올리지 않는다.

```bash
scp docker-compose.deploy.yml deploy/Caddyfile deploy/backup.sh deploy/restore.sh     ubuntu@<서버IP>:~/dart/
```

### 3. 서버에서 기동

```bash
cd ~/dart
cp .env.prod.example .env && chmod 600 .env
vi .env        # DOMAIN, POSTGRES_PASSWORD, DART_API_KEY, KAKAO_* 입력

./update.sh    # 최근 5개 버전 중 선택 → pull → 기동
```

`update.sh`는 버전 목록을 GHCR API로 읽는다. private 패키지라 토큰이 필요하다.

```bash
mkdir -p ~/.config
echo '<read:packages 토큰>' > ~/.config/ghcr-token
chmod 600 ~/.config/ghcr-token
```

토큰이 없으면 목록 조회를 건너뛰고 태그를 직접 입력받는다.

Caddy가 Let's Encrypt 인증서를 자동 발급한다. DNS A 레코드가 서버 IP를 가리킨 뒤에 올려야 한다.

### 서버 초기 설정 (최초 1회)

```bash
scp deploy/server-init.sh ubuntu@<서버IP>:~/
ssh ubuntu@<서버IP> 'bash ~/server-init.sh'
```

Docker 설치 + 스왑 2GB + 방화벽(22/80/443)을 처리한다.

---

## 운영

```bash
# 업데이트 (맥에서 make docker 후)
./update.sh              # 버전 선택
./update.sh 0.2.0        # 특정 버전
./update.sh latest

# 롤백도 같은 방법 — 이전 버전 태그를 고르면 된다
./update.sh 0.1.0

# 상태 · 로그 · 정지
./update.sh status
./update.sh logs
./update.sh down

# 백업 (DB + 원본 ZIP)
./backup.sh

# 과거 구간 소급 수집
docker compose -f docker-compose.deploy.yml exec backend \
    sh -c 'wget -qO- --post-data="" "http://localhost:8080/api/ops/backfill?from=2026-09-01"'
```

운영 배치 API(`/api/ops/**`)는 Caddy가 외부에서 404로 막는다. 서버 내부에서만 호출한다.
관리자 화면 API(`/api/admin/**`)는 통과시키고 백엔드의 `AdminGuard`가 인증으로 막는다.

---

## 재파싱

DART 서식이 바뀌어 파싱 룰(`backend/src/main/resources/parse-rules.yml`)을 고쳤다면,
상태만 되돌리면 전건 재처리된다. **원본 ZIP을 보관하는 이유가 이것이다.**

```sql
UPDATE disclosure SET parse_status='FETCHED'
WHERE parse_status IN ('PARSED','PARSED_WITH_WARN','FAILED');
```

15초 뒤 `ParseWorker`가 집어간다.

---

## 문서

설계·구현 기록은 `docs/`에 있다. **저장소에는 포함되지 않는다**(`.gitignore`).

| 파일 | 내용 |
| --- | --- |
| `docs/PLAN.md` | 전체 설계 — 아키텍처, 스키마, 파싱 전략, 인프라 |
| `docs/M0-FINDINGS.md` | DART 문서 구조 실측 결과 (`AASSOCNOTE` 매칭 체계) |
| `docs/M1`~`M6-NOTES.md` | 단계별 구현 기록과 잡은 버그 |
| `docs/M7-ADDITIONS.md` | 백필·반응형 등 추가 작업 |
| `docs/M8-PERIODIC.md` | 정기공시 3종 추가 |
| `docs/M9-COMMENTS-ADMIN.md` | 의견·관리자 페이지 — **남은 작업과 인계 사항** |
| `docs/DEPLOY.md` | 배포 절차 (Oracle / AWS) |

---

## 주의

- `.env`는 **절대 커밋하지 않는다** (`.gitignore` 등록됨)
- `backend/raw/`(원본 ZIP)도 커밋 대상이 아니다
- 운영 배치 API `/api/ops/**`는 운영에서 **네트워크 레벨로 차단**한다 (`deploy/Caddyfile`)
- 관리자 화면 API `/api/admin/**`는 **로그인 + 관리자 권한**으로 막는다 (`AdminGuard`)
