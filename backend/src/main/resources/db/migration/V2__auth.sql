-- 사용자 (카카오 OAuth). DART API 키와 무관 — 키는 서버 배치만 보유한다.
CREATE TABLE app_user (
    id            BIGSERIAL PRIMARY KEY,
    provider      VARCHAR(16) NOT NULL DEFAULT 'kakao',
    provider_uid  VARCHAR(64) NOT NULL,
    nickname      TEXT,
    profile_image TEXT,
    role          VARCHAR(16) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    UNIQUE (provider, provider_uid)
);

-- 세션. 쿠키에는 원문 토큰을, DB에는 SHA-256 해시만 저장한다.
-- DB가 유출돼도 세션을 탈취할 수 없다.
CREATE TABLE user_session (
    token_hash  VARCHAR(64) PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_session_user    ON user_session (user_id);
CREATE INDEX ix_session_expires ON user_session (expires_at);

-- 스크랩
CREATE TABLE bookmark (
    user_id    BIGINT      NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    rcept_no   VARCHAR(14) NOT NULL REFERENCES disclosure(rcept_no) ON DELETE CASCADE,
    memo       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, rcept_no)
);
CREATE INDEX ix_bookmark_user ON bookmark (user_id, created_at DESC);
