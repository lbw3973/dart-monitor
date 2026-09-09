package kr.irm.dart.collector;

import jakarta.annotation.PreDestroy;
import kr.irm.dart.config.DartProperties;
import kr.irm.dart.domain.Disclosure;
import kr.irm.dart.domain.DisclosureRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;

/**
 * 공시 원본 ZIP을 내려받아 보관한다.
 * 파싱 룰이 바뀌면 재파싱해야 하므로 원본 보관은 필수다.
 */
@Component
public class DocumentFetcher {

    private static final Logger log = LoggerFactory.getLogger(DocumentFetcher.class);

    private final DartApiClient client;
    private final DisclosureRepository repository;
    private final DartProperties props;
    private final ExecutorService pool;
    private final Semaphore rateLimit;

    public DocumentFetcher(DartApiClient client, DisclosureRepository repository, DartProperties props) {
        this.client = client;
        this.repository = repository;
        this.props = props;
        this.pool = Executors.newFixedThreadPool(props.fetchConcurrency(), r -> {
            Thread t = new Thread(r, "doc-fetch");
            t.setDaemon(true);
            return t;
        });
        this.rateLimit = new Semaphore(props.fetchConcurrency());
    }

    public void submit(Disclosure d) {
        if (!d.getReportType().isTarget()) return;   // 대상 외 서식은 원본을 받지 않는다
        pool.submit(() -> fetchOne(d.getRceptNo()));
    }

    /** 재시도 대상(원본 미확보 건)을 주기적으로 쓸어담는다. */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void retryPending() {
        List<Disclosure> due = repository.findDueForFetch(Instant.now(), Limit.of(50));
        if (due.isEmpty()) return;
        log.info("원본 재시도 대상 {}건", due.size());
        due.forEach(d -> pool.submit(() -> fetchOne(d.getRceptNo())));
    }

    // 풀 스레드에서 자기호출되므로 @Transactional은 프록시를 타지 않는다.
    // Spring Data의 메서드 단위 트랜잭션(findById/save)에 맡긴다.
    void fetchOne(String rceptNo) {
        Disclosure d = repository.findById(rceptNo).orElse(null);
        if (d == null) return;

        try {
            rateLimit.acquire();
            try {
                byte[] zip = client.downloadDocument(rceptNo);
                Path path = store(rceptNo, zip);
                d.markFetched(path.toString());
                repository.save(d);
                log.debug("원본 확보 {} ({} bytes) → {}", rceptNo, zip.length, path);
            } finally {
                rateLimit.release();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            d.markRetryable(e.getMessage(), props.maxRetry());
            repository.save(d);
            log.warn("원본 확보 실패 {} (시도 {}회) {}", rceptNo, d.getRetryCount(), e.getMessage());
        }
    }

    /** raw/{yyyy}/{MM}/{dd}/{rcept_no}.zip 으로 보관한다. */
    private Path store(String rceptNo, byte[] zip) throws IOException {
        Path dir = Path.of(props.rawDir(),
                rceptNo.substring(0, 4), rceptNo.substring(4, 6), rceptNo.substring(6, 8));
        Files.createDirectories(dir);
        Path target = dir.resolve(rceptNo + ".zip");
        Path tmp = Files.createTempFile(dir, rceptNo, ".tmp");
        Files.write(tmp, zip);
        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);   // 원자적 교체
        return target;
    }

    @PreDestroy
    void shutdown() {
        pool.shutdown();
        try {
            if (!pool.awaitTermination(10, TimeUnit.SECONDS)) pool.shutdownNow();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
