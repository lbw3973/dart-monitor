package kr.irm.dart.web;

import kr.irm.dart.service.DisclosureEventPublisher;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class DisclosureStreamController {

    private final DisclosureEventPublisher publisher;

    public DisclosureStreamController(DisclosureEventPublisher publisher) {
        this.publisher = publisher;
    }

    /** 신규 공시를 실시간으로 밀어준다. 30초 폴링을 대체한다. */
    @GetMapping(value = "/api/stream", produces = "text/event-stream")
    public SseEmitter stream() {
        return publisher.subscribe();
    }
}
