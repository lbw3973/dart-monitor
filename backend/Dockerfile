# ── 빌드 ──
FROM gradle:8-jdk21-alpine AS build
WORKDIR /src
COPY settings.gradle build.gradle ./
# 의존성만 먼저 받아 레이어 캐시를 살린다 (소스만 바뀌면 재다운로드 없음)
RUN gradle --no-daemon dependencies --quiet || true
COPY src ./src
RUN gradle --no-daemon bootJar --quiet

# ── 실행 ──
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /src/build/libs/*.jar app.jar
RUN mkdir -p /data/raw && chown -R app:app /data
USER app
EXPOSE 8080
# 컨테이너 메모리에 맞춰 힙을 자동 조정한다 (소형 인스턴스 대응)
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
