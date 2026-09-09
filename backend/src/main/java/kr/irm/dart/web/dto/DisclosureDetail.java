package kr.irm.dart.web.dto;

import java.util.List;

public record DisclosureDetail(DisclosureSummary disclosure, List<SectionDto> sections,
                               String parseError) {}
