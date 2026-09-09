#!/bin/sh
# DB 덤프 + 원본 ZIP 백업.
# PLAN §8.3 — 이 스크립트의 산출물이 곧 다른 서버로의 마이그레이션 입력이다.
set -eu

DIR="${BACKUP_DIR:-/srv/backup}"
KEEP="${KEEP_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M)
cd "$(dirname "$0")/.."

mkdir -p "$DIR"

docker compose -f docker-compose.deploy.yml exec -T postgres \
    pg_dump -U dart dart | gzip > "$DIR/db-$STAMP.sql.gz"

docker run --rm \
    -v dart-disclosure-monitor_rawdata:/data:ro \
    -v "$DIR":/backup alpine \
    tar czf "/backup/raw-$STAMP.tar.gz" -C /data .

find "$DIR" -name '*.gz' -mtime +"$KEEP" -delete

echo "백업 완료: $DIR/db-$STAMP.sql.gz, $DIR/raw-$STAMP.tar.gz"
