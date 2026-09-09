package kr.irm.dart.parser;

import java.util.List;

public record ParseResult(List<ExtractedSection> sections, List<String> warnings) {

    public boolean hasWarnings() { return !warnings.isEmpty(); }
}
