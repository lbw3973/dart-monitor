package kr.irm.dart.web.dto;

import kr.irm.dart.domain.DisclosureSection;

public record SectionDto(String sectionNo, String sectionTitle, int seq, String tableHtml) {

    public static SectionDto from(DisclosureSection s) {
        return new SectionDto(s.getSectionNo(), s.getSectionTitle(), s.getSeq(), s.getTableHtml());
    }
}
