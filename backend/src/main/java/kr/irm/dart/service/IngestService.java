package kr.irm.dart.service;

import kr.irm.dart.collector.DartApiClient.ListItem;
import kr.irm.dart.config.DartProperties;
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
    private final DartProperties props;

    public IngestService(DisclosureRepository repository, DartProperties props) {
        this.repository = repository;
        this.props = props;
    }

    /**
     * 목록 응답에서 신규 건만 저장하고 그 목록을 돌려준다.
     * 접수번호가 PK이므로 재실행해도 중복 저장되지 않는다.
     */
    @Transactional
    public List<Disclosure> saveNew(List<ListItem> items) {
        if (items.isEmpty()) return List.of();

        // 상장 구분 필터. 목록 API의 corp_cls 파라미터로는 걸러 받을 수 없다 —
        // 값을 하나만 받고, 여러 값을 주면 에러 없이 기타법인 목록을 돌려준다(실측).
        // 그래서 전부 받아 여기서 거른다. 걸러진 수는 ingest_run의 fetched-inserted 차이로 드러난다.
        items = items.stream()
                .filter(i -> props.corpClasses().contains(i.corpCls()))
                .toList();
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
