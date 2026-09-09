package kr.irm.dart.parser;

import kr.irm.dart.domain.DisclosureRepository;
import kr.irm.dart.service.ParseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/** 원본이 확보된(FETCHED) 건을 파싱한다. 수집과 파싱을 분리해 한쪽 실패가 다른 쪽을 막지 않게 한다. */
@Component
public class ParseWorker {

    private static final Logger log = LoggerFactory.getLogger(ParseWorker.class);
    private static final int BATCH = 200;

    private final DisclosureRepository repository;
    private final ParseService parseService;

    public ParseWorker(DisclosureRepository repository, ParseService parseService) {
        this.repository = repository;
        this.parseService = parseService;
    }

    @Scheduled(fixedDelay = 15_000, initialDelay = 10_000)
    public void run() {
        List<String> due = repository.findFetchedIds(BATCH);
        if (due.isEmpty()) return;

        log.info("파싱 대상 {}건", due.size());
        int ok = 0;
        for (String id : due) {
            try {
                parseService.parseOne(id);
                ok++;
            } catch (Exception e) {
                log.error("파싱 워커 오류 {}", id, e);
            }
        }
        log.info("파싱 처리 {}/{}", ok, due.size());
    }
}
