package kr.irm.dart.parser;

public record ExtractedSection(
        String sectionNo,
        String sectionId,
        String title,
        int seq,
        String tableHtml,
        String tableJson,
        String plainText) {}
