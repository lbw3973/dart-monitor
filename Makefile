# 이미지 레포지토리 및 태그 정의
# 프론트와 백엔드는 별개 이미지다. 각각의 버전을 따로 올린다.
IMAGE_NAME      = ghcr.io/lbw3973/dart
BACKEND_VERSION = 0.1.0
WEB_VERSION     = 0.1.0
LATEST          = latest
PLATFORM        = linux/arm64

# 카카오 JavaScript 키 — 루트 .env 의 VITE_KAKAO_JS_KEY 를 읽는다.
# 공개 키이고 도메인으로 제한되므로 번들에 들어가도 된다.
# 콘솔: [앱] → [플랫폼 키] → [JavaScript 키]
KAKAO_JS_KEY   ?= $(shell grep -sE '^VITE_KAKAO_JS_KEY=' .env | cut -d= -f2-)

docker: docker-backend docker-web   ## 둘 다 빌드·푸시

docker-backend:                     ## 백엔드만
	docker build --platform $(PLATFORM) \
		-t $(IMAGE_NAME)-backend:$(BACKEND_VERSION) \
		-t $(IMAGE_NAME)-backend:$(LATEST) \
		--push ./backend

docker-web:                         ## 프론트만
	docker build --platform $(PLATFORM) \
		--build-arg VITE_KAKAO_JS_KEY=$(KAKAO_JS_KEY) \
		-t $(IMAGE_NAME)-web:$(WEB_VERSION) \
		-t $(IMAGE_NAME)-web:$(LATEST) \
		--push -f ./deploy/Dockerfile.web .
