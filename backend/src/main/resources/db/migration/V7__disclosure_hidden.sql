-- 관리자가 목록에서 내린 공시.
--
-- 행을 지우지 않는 이유가 둘이다.
--  1) 폴러가 하루 첫 조회에서 최근 3일을(기동 캐치업은 최대 30일) 다시 훑는다.
--     지운 행은 신규로 재삽입되고 SSE 로 "신규 공시 도착"까지 나간다(§DisclosurePoller.publishNew).
--     행을 남겨 두면 rcept_no 가 PK 라 IngestService.saveNew 가 건너뛰므로 숨김이 유지된다.
--  2) 행을 지우면 ON DELETE CASCADE 로 그 공시의 의견·즐겨찾기·섹션까지 영구히 사라진다.
--     공시는 되돌아오는데 거기 달렸던 의견만 없어지는 게 가장 나쁜 조합이다.
ALTER TABLE disclosure ADD COLUMN hidden_at TIMESTAMPTZ;

-- 목록 조회는 거의 항상 "숨기지 않은 것"이라 부분 인덱스로 둔다
CREATE INDEX ix_disc_visible ON disclosure (rcept_dt DESC, rcept_no DESC) WHERE hidden_at IS NULL;
