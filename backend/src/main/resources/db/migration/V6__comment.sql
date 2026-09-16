-- 공시 의견. 답글은 1단까지다 — 답글에는 다시 답글을 달 수 없다.
--
-- 그 규칙은 등록할 때 서비스에서 막는다(§CommentService.add).
-- "부모의 부모가 NULL인가"는 순수 CHECK 로 표현되지 않고,
-- 생성 컬럼 + 복합 외래키로 스키마에 넣을 수는 있지만 마이그레이션이 읽기 어려워지는 값을 하지 않는다.
CREATE TABLE comment (
    id         BIGSERIAL   PRIMARY KEY,
    rcept_no   VARCHAR(14) NOT NULL REFERENCES disclosure(rcept_no) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    -- 최상위 의견이면 NULL. 부모가 지워지면 답글도 함께 사라진다.
    parent_id  BIGINT      REFERENCES comment(id) ON DELETE CASCADE,
    body       TEXT        NOT NULL CHECK (char_length(body) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 답글이 달린 의견을 지우면 본문만 비우고 자리는 남긴다 — 대화가 끊기지 않게.
    -- 그래서 body 는 빈 문자열이 될 수 있다(등록 시 빈 값은 서비스가 막는다).
    deleted_at TIMESTAMPTZ
);

-- 상세를 열 때마다 한 공시의 의견을 통째로 긁는다
CREATE INDEX ix_comment_rcept  ON comment (rcept_no, created_at);
-- 답글 묶기, 그리고 삭제 전 "답글이 달려 있나" 확인
CREATE INDEX ix_comment_parent ON comment (parent_id);
