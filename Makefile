# 이미지 레포지토리 및 태그 정의
IMAGE_NAME = ghcr.io/lbw3973/dart
VERSION    = 0.1.0
LATEST     = latest
PLATFORM   = linux/arm64

docker:
	docker build --platform $(PLATFORM) \
		-t $(IMAGE_NAME)-backend:$(VERSION) \
		-t $(IMAGE_NAME)-backend:$(LATEST) \
		--push ./backend
	docker build --platform $(PLATFORM) \
		-t $(IMAGE_NAME)-web:$(VERSION) \
		-t $(IMAGE_NAME)-web:$(LATEST) \
		--push -f ./deploy/Dockerfile.web .
