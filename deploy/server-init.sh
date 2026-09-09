#!/usr/bin/env bash
#
# 새 서버 초기 설정 — Docker 설치 + 스왑 구성.
# Ubuntu 24.04/26.04 (ARM/x86 공통). 서버에서 한 번만 실행한다.
#
#   curl -fsSL <이 파일> | bash      또는   bash server-init.sh
set -euo pipefail

log() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

log "시스템 업데이트"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

log "스왑 2GB 구성"
# 2GB 인스턴스에서는 스왑이 없으면 빌드 중 OOM으로 죽는다
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
    # 스왑은 비상용이므로 되도록 쓰지 않게 한다
    echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf >/dev/null
    sudo sysctl -p /etc/sysctl.d/99-swap.conf >/dev/null
    echo "  스왑 2GB 활성화"
else
    echo "  이미 구성됨"
fi

log "Docker 설치"
if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo "  설치 완료 — 그룹 반영을 위해 재로그인이 필요합니다"
else
    echo "  이미 설치됨: $(docker --version)"
fi

log "방화벽 (ufw)"
# AWS는 보안 그룹이 1차 방어선이지만, 서버 자체에도 걸어 이중으로 둔다
if command -v ufw >/dev/null; then
    sudo ufw allow 22/tcp  >/dev/null
    sudo ufw allow 80/tcp  >/dev/null
    sudo ufw allow 443/tcp >/dev/null
    sudo ufw --force enable >/dev/null
    echo "  22 / 80 / 443 허용"
fi

log "결과"
free -h | head -2
echo
df -h / | tail -1
echo
echo "다음: 재로그인 후  docker ps  가 sudo 없이 되는지 확인하세요."
