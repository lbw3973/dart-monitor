# 이미지 레포지토리 및 태그 정의
# 프론트와 백엔드는 별개 이미지다. 각각의 버전을 따로 올린다.
IMAGE_NAME       = ghcr.io/lbw3973/dart
BACKEND_VERSION  = 1.2.3
FRONTEND_VERSION = 1.2.5
LATEST           = latest
PLATFORM         = linux/arm64

# GA4 측정 ID — 루트 .env 의 VITE_GA_ID 를 읽는다.
# 페이지 소스에 그대로 드러나는 공개 식별자다. 비워두면 통계 수집이 꺼진 채 빌드된다.
GA_ID           ?= $(shell grep -sE '^VITE_GA_ID=' .env | cut -d= -f2-)

docker: docker-backend docker-frontend   ## 둘 다 빌드·푸시

docker-backend:                     ## 백엔드만
	docker build --platform $(PLATFORM) \
		-t $(IMAGE_NAME)-backend:$(BACKEND_VERSION) \
		-t $(IMAGE_NAME)-backend:$(LATEST) \
		--push ./backend

docker-frontend:                    ## 프론트만
	docker build --platform $(PLATFORM) \
		--build-arg VITE_GA_ID=$(GA_ID) \
		--build-arg VITE_APP_VERSION=$(FRONTEND_VERSION) \
		-t $(IMAGE_NAME)-frontend:$(FRONTEND_VERSION) \
		-t $(IMAGE_NAME)-frontend:$(LATEST) \
		--push -f ./deploy/Dockerfile.frontend .

# 서버 스크립트는 이미지에 들어가지 않는다(호스트에서 docker 를 호출하므로).
# 고칠 때마다 손으로 올려야 해서 잊기 쉬우니 명령으로 남긴다.
DEPLOY_HOST ?= bwlee
DEPLOY_DIR  ?= /opt/bwlee/lib/dart-monitor

deploy-scripts:                     ## 서버 스크립트·compose 파일 갱신
	scp deploy/_common.sh deploy/update-program.sh deploy/update-data.sh \
	    deploy/backup.sh deploy/restore.sh deploy/Caddyfile \
	    docker-compose.deploy.yml \
	    $(DEPLOY_HOST):$(DEPLOY_DIR)/
	ssh $(DEPLOY_HOST) 'chmod +x $(DEPLOY_DIR)/*.sh'
