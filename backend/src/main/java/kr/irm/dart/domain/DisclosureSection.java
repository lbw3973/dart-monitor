package kr.irm.dart.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "disclosure_section")
public class DisclosureSection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rcept_no", length = 14, nullable = false)
    private String rceptNo;

    @Column(name = "section_no", length = 8, nullable = false)
    private String sectionNo;

    /** AASSOCNOTE (예: D-1-3-0-0). 매칭 근거를 남겨 서식 개정 추적에 쓴다. */
    @Column(name = "section_id", length = 32)
    private String sectionId;

    @Column(name = "section_title", nullable = false)
    private String sectionTitle;

    @Column(name = "seq", nullable = false)
    private int seq;

    @Column(name = "table_html", columnDefinition = "text")
    private String tableHtml;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "table_json")
    private String tableJson;

    @Column(name = "plain_text", columnDefinition = "text")
    private String plainText;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected DisclosureSection() {}

    public DisclosureSection(String rceptNo, String sectionNo, String sectionId, String sectionTitle,
                             int seq, String tableHtml, String tableJson, String plainText) {
        this.rceptNo = rceptNo;
        this.sectionNo = sectionNo;
        this.sectionId = sectionId;
        this.sectionTitle = sectionTitle;
        this.seq = seq;
        this.tableHtml = tableHtml;
        this.tableJson = tableJson;
        this.plainText = plainText;
    }

    public Long getId() { return id; }
    public String getRceptNo() { return rceptNo; }
    public String getSectionNo() { return sectionNo; }
    public String getSectionTitle() { return sectionTitle; }
    public int getSeq() { return seq; }
    public String getTableHtml() { return tableHtml; }
    public String getPlainText() { return plainText; }
}
