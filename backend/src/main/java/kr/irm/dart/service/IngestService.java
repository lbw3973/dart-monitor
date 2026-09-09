package kr.irm.dart.service;

import kr.irm.dart.collector.DartApiClient.ListItem;
import kr.irm.dart.domain.Disclosure;
import kr.irm.dart.domain.DisclosureRepository;
import kr.irm.dart.domain.ReportType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class IngestService {

    private static final Logger log = LoggerFactory.getLogger(IngestService.class);

    private final DisclosureRepository repository;

    public IngestService(DisclosureRepository repository) {
        this.repository = repository;
    }

    /**
     * 목록 응답에서 신규 건만 저장하고 그 목록을 돌려준다.
     * 접수번호가 PK이므로 재실행해도 중복 저장되지 않는다.
     */
    @Transactional
    public List<Disclosure> saveNew(List<ListItem> items) {
        if (items.isEmpty()) return List.of();

        Set<String> ids = new HashSet<>();
        items.forEach(i -> ids.add(i.rceptNo()));
        Set<String> existing = new HashSet<>(repository.findExistingIds(ids));

        List<Disclosure> fresh = items.stream()
                .filter(i -> !existing.contains(i.rceptNo()))
                .collect(java.util.stream.Collectors.toMap(
                        ListItem::rceptNo, i -> i, (a, b) -> a, java.util.LinkedHashMap::new))
                .values().stream()
                .map(i -> new Disclosure(i.rceptNo(), i.corpCode(), i.corpName(), i.stockCode(),
                        i.corpCls(), i.reportNm(), i.flrNm(), i.rceptDate()))
                .toList();

        if (fresh.isEmpty()) return List.of();

        List<Disclosure> saved = repository.saveAll(fresh);
        saved.stream()
                .filter(d -> d.getReportType() == ReportType.OTHER)
                .forEach(d -> log.warn("대상 외 서식 수집됨 rcept_no={} report_nm={}",
                        d.getRceptNo(), d.getReportNm()));
        return saved;
    }
}
