package kr.irm.dart.parser;

import kr.irm.dart.domain.ReportType;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Map;

@ConfigurationProperties(prefix = "dart")
public record ParseRules(Map<ReportType, RuleSet> rules) {

    public enum Scope { PART1, DOCUMENT }

    public record RuleSet(Scope scope, List<Section> sections) {}

    /** no: 화면에 보일 섹션 번호, id: AASSOCNOTE, expect: 제목 검증값 */
    public record Section(String sectionNo, String id, String expect) {}

    public RuleSet forType(ReportType type) {
        return rules == null ? null : rules.get(type);
    }
}
