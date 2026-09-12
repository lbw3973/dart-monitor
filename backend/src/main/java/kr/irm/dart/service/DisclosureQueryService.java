package kr.irm.dart.service;

import kr.irm.dart.domain.*;
import kr.irm.dart.web.dto.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class DisclosureQueryService {

    private static final int MAX_SIZE = 100;

    private final DisclosureRepository disclosures;
    private final DisclosureSectionRepository sections;
    private final BookmarkService bookmarks;

    public DisclosureQueryService(DisclosureRepository disclosures,
                                  DisclosureSectionRepository sections,
                                  BookmarkService bookmarks) {
        this.disclosures = disclosures;
        this.sections = sections;
        this.bookmarks = bookmarks;
    }

    @Transactional(readOnly = true)
    public PageResponse<DisclosureSummary> search(List<ReportType> types, LocalDate from, LocalDate to,
                                                  String q, ParseStatus status, int page, int size,
                                                  AppUser user) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.clamp(size, 1, MAX_SIZE),
                Sort.by(Sort.Direction.DESC, "rceptDt", "rceptNo"));

        Specification<Disclosure> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            // 그룹(5%·임원보고 / 정기공시) 전체를 고르면 여러 유형이 함께 온다
            if (types != null && !types.isEmpty()) ps.add(root.get("reportType").in(types));
            if (status != null) ps.add(cb.equal(root.get("parseStatus"), status));
            if (from != null)   ps.add(cb.greaterThanOrEqualTo(root.get("rceptDt"), from));
            if (to != null)     ps.add(cb.lessThanOrEqualTo(root.get("rceptDt"), to));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                ps.add(cb.or(
                        cb.like(cb.lower(root.get("corpName")), like),
                        cb.like(cb.lower(root.get("flrNm")), like)));
            }
            return ps.isEmpty() ? null : cb.and(ps.toArray(Predicate[]::new));
        };

        var found = disclosures.findAll(spec, pageable);
        var marked = bookmarks.markedAmong(user,
                found.getContent().stream().map(Disclosure::getRceptNo).toList());
        return PageResponse.of(found, d -> DisclosureSummary.from(d, marked.contains(d.getRceptNo())));
    }

    @Transactional(readOnly = true)
    public DisclosureDetail detail(String rceptNo, AppUser user) {
        Disclosure d = disclosures.findById(rceptNo).orElse(null);
        if (d == null) return null;

        boolean marked = !bookmarks.markedAmong(user, List.of(rceptNo)).isEmpty();
        List<SectionDto> secs = sections.findByRceptNoOrderBySectionNoAscSeqAsc(rceptNo)
                .stream().map(SectionDto::from).toList();
        return new DisclosureDetail(DisclosureSummary.from(d, marked), secs, d.getParseError());
    }
}
