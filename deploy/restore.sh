#!/bin/sh
# 백업 복원 — 새 서버로 이전할 때도 동일하게 쓴다.
# 사용: ./deploy/restore.sh /srv/backup/db-20260908-1200.sql.gz /srv/backup/raw-20260908-1200.tar.gz
set -eu

DB_DUMP="${1:?DB 덤프 경로를 지정하세요}"
RAW_TAR="${2:-}"
cd "$(dirname "$0")/.."

docker compose -f docker-compose.deploy.yml up -d postgres
until docker compose -f docker-compose.deploy.yml exec -T postgres pg_isready -U dart -d dart; do
    sleep 2
done

gunzip -c "$DB_DUMP" | docker compose -f docker-compose.deploy.yml exec -T postgres psql -U dart dart

if [ -n "$RAW_TAR" ]; then
    docker run --rm \
        -v dart-disclosure-monitor_rawdata:/data \
        -v "$(cd "$(dirname "$RAW_TAR")" && pwd)":/backup alpine \
        tar xzf "/backup/$(basename "$RAW_TAR")" -C /data
fi

docker compose -f docker-compose.deploy.yml up -d
echo "복원 완료. DNS A레코드를 이 서버로 변경하세요."
