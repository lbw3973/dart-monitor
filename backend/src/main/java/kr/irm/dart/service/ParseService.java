package kr.irm.dart.service;

import kr.irm.dart.domain.*;
import kr.irm.dart.parser.DartDocumentParser;
import kr.irm.dart.parser.DocumentTooLargeException;
import kr.irm.dart.parser.ParseResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

@Service
public class ParseService {

    private static final Logger log = LoggerFactory.getLogger(ParseService.class);

    private final DisclosureRepository disclosures;
    private final DisclosureSectionRepository sections;
    private final DartDocumentParser parser;
    private final DisclosureEventPublisher events;

    public ParseService(DisclosureRepository disclosures, DisclosureSectionRepository sections,
                        DartDocumentParser parser, DisclosureEventPublisher events) {
        this.disclosures = disclosures;
        this.sections = sections;
        this.parser = parser;
        this.events = events;
    }

    /** 보관된 원본 ZIP을 파싱해 섹션을 저장한다. 재파싱해도 안전하도록 기존 섹션은 지우고 다시 쓴다. */
    @Transactional
    public void parseOne(String rceptNo) {
        Disclosure d = disclosures.findById(rceptNo).orElse(null);
        if (d == null || !d.getReportType().isTarget()) return;
        if (d.getRawFilePath() == null) {
            log.debug("원본 미확보라 파싱 건너뜀 {}", rceptNo);
            return;
        }

        try {
            Path path = Path.of(d.getRawFilePath());
            if (!Files.exists(path)) {
                d.markParseFailed("원본 파일 없음: " + path);
                disclosures.save(d);
                return;
            }

            ParseResult result = parser.parse(Files.readAllBytes(path), rceptNo, d.getReportType());

            if (result.sections().isEmpty()) {
                d.markParseFailed("추출된 섹션 없음 " + result.warnings());
                disclosures.save(d);
                log.warn("파싱 실패 {} {}", rceptNo, result.warnings());
                return;
            }

            sections.deleteByRceptNo(rceptNo);
            sections.flush();
            sections.saveAll(result.sections().stream()
                    .map(s -> new DisclosureSection(rceptNo, s.sectionNo(), s.sectionId(), s.title(),
                            s.seq(), s.tableHtml(), s.tableJson(), s.plainText()))
                    .toList());

            d.markParsed(result.hasWarnings(),
                    result.hasWarnings() ? String.join("; ", result.warnings()) : null);
            disclosures.save(d);

            if (result.hasWarnings()) {
                log.warn("파싱 경고 {} {}", rceptNo, result.warnings());
            } else {
                log.debug("파싱 완료 {} 섹션 {}개", rceptNo, result.sections().size());
            }
            // 목록에 '수집중'으로 떠 있던 항목이 파싱을 마쳤음을 알린다
            events.publishParsed(d);
        } catch (DocumentTooLargeException e) {
            // 재시도해도 같은 결과다. FAILED로 두면 재처리 대상에 계속 남으므로 SKIPPED로 구분한다.
            d.markSkipped(e.getMessage());
            disclosures.save(d);
            log.warn("문서가 너무 커 파싱 건너뜀 {} — {}", rceptNo, e.getMessage());
        } catch (Exception e) {
            d.markParseFailed(e.toString());
            disclosures.save(d);
            log.error("파싱 오류 {}", rceptNo, e);
        }
    }

    @Transactional(readOnly = true)
    public List<DisclosureSection> sectionsOf(String rceptNo) {
        return sections.findByRceptNoOrderBySectionNoAscSeqAsc(rceptNo);
    }
}
