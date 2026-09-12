# 이미지 레포지토리 및 태그 정의
# 프론트와 백엔드는 별개 이미지다. 각각의 버전을 따로 올린다.
IMAGE_NAME       = ghcr.io/lbw3973/dart
BACKEND_VERSION  = 0.3.2
FRONTEND_VERSION = 0.5.1
LATEST           = latest
PLATFORM         = linux/arm64

# 카카오 JavaScript 키 — 루트 .env 의 VITE_KAKAO_JS_KEY 를 읽는다.
# 공개 키이고 도메인으로 제한되므로 번들에 들어가도 된다.
# 콘솔: [앱] → [플랫폼 키] → [JavaScript 키]
KAKAO_JS_KEY    ?= $(shell grep -sE '^VITE_KAKAO_JS_KEY=' .env | cut -d= -f2-)

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
		--build-arg VITE_KAKAO_JS_KEY=$(KAKAO_JS_KEY) \
		--build-arg VITE_GA_ID=$(GA_ID) \
		-t $(IMAGE_NAME)-frontend:$(FRONTEND_VERSION) \
		-t $(IMAGE_NAME)-frontend:$(LATEST) \
		--push -f ./deploy/Dockerfile.frontend .
