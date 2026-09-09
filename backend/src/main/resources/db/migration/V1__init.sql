-- 공시 메타 (접수번호가 자연키 → 중복 수집 방지)
CREATE TABLE disclosure (
    rcept_no      VARCHAR(14)    PRIMARY KEY,
    corp_code     VARCHAR(8)    NOT NULL,
    corp_name     TEXT        NOT NULL,
    stock_code    VARCHAR(6),
    corp_cls      VARCHAR(1),
    report_nm     TEXT        NOT NULL,
    report_type   VARCHAR(32) NOT NULL
                  CHECK (report_type IN ('MAJOR_HOLDING_SIMPLE','MAJOR_HOLDING_GENERAL',
                                         'EXEC_OWNERSHIP','OTHER')),
    is_correction BOOLEAN     NOT NULL DEFAULT FALSE,
    flr_nm        TEXT,
    rcept_dt      DATE        NOT NULL,
    parse_status  VARCHAR(24) NOT NULL DEFAULT 'PENDING'
                  CHECK (parse_status IN ('PENDING','FETCHING','FETCHED','PARSED',
                                          'PARSED_WITH_WARN','FAILED','SKIPPED')),
    parse_error   TEXT,
    retry_count   INT         NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    raw_file_path TEXT,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fetched_at    TIMESTAMPTZ,
    parsed_at     TIMESTAMPTZ
);

CREATE INDEX ix_disc_recent  ON disclosure (rcept_dt DESC, rcept_no DESC);
CREATE INDEX ix_disc_type    ON disclosure (report_type, rcept_dt DESC);
CREATE INDEX ix_disc_pending ON disclosure (parse_status, next_retry_at);

-- 섹션별 표 (문서 원문 그대로 보존)
CREATE TABLE disclosure_section (
    id            BIGSERIAL PRIMARY KEY,
    rcept_no      VARCHAR(14) NOT NULL REFERENCES disclosure(rcept_no) ON DELETE CASCADE,
    section_no    VARCHAR(8) NOT NULL,
    section_id    VARCHAR(32),
    section_title TEXT        NOT NULL,
    seq           INT         NOT NULL,
    table_html    TEXT,
    table_json    JSONB,
    plain_text    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rcept_no, section_no, seq)
);
CREATE INDEX ix_sec_rcept ON disclosure_section (rcept_no);

-- 폴링 관측
CREATE TABLE ingest_run (
    id         BIGSERIAL PRIMARY KEY,
    detail_ty  VARCHAR(8),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fetched    INT,
    inserted   INT,
    ok         BOOLEAN,
    error      TEXT
);
CREATE INDEX ix_ingest_started ON ingest_run (started_at DESC);
