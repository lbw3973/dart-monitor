package kr.irm.dart.service;

import kr.irm.dart.domain.Disclosure;
import kr.irm.dart.web.dto.DisclosureSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * SSE 브로드캐스트. 구독자 수가 많지 않은 전제라 단순 리스트로 관리한다.
 * 다중 인스턴스로 늘리면 Redis pub/sub 등으로 바꿔야 한다.
 */
@Service
public class DisclosureEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(DisclosureEventPublisher.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;   // 30분 후 클라이언트가 재연결

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("ok", true)));
        } catch (IOException e) {
            emitters.remove(emitter);
        }
        log.debug("SSE 구독 시작 (총 {}명)", emitters.size());
        return emitter;
    }

    public void publishNew(List<Disclosure> disclosures) {
        if (disclosures.isEmpty() || emitters.isEmpty()) return;
        // 스크랩 여부는 구독자마다 다르므로 항상 false로 내려보내고, 클라이언트가 목록을 갱신한다
        List<DisclosureSummary> payload = disclosures.stream()
                .map(d -> DisclosureSummary.from(d, false))
                .toList();
        broadcast("disclosures", payload);
    }

    public void publishParsed(Disclosure d) {
        if (emitters.isEmpty()) return;
        broadcast("parsed", DisclosureSummary.from(d, false));
    }

    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        // 프록시가 유휴 연결을 끊지 않도록 주기적으로 신호를 보낸다
        broadcast("ping", Map.of("t", System.currentTimeMillis()));
    }

    private void broadcast(String event, Object data) {
        for (SseEmitter e : emitters) {
            try {
                e.send(SseEmitter.event().name(event).data(data));
            } catch (Exception ex) {
                emitters.remove(e);        // 끊긴 연결 정리
            }
        }
    }

    public int subscriberCount() {
        return emitters.size();
    }
}
