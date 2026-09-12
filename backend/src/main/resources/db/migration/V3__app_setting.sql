-- 운영 중 조정이 필요한 값을 담는다.
-- 설정 파일에 두면 값 하나 바꾸려고 재배포해야 하므로, 여기 있는 값은 재배포 없이 반영된다.
-- 관리자 화면이 붙을 자리이기도 해서 단일 컬럼이 아닌 키·값 형태로 둔다.
CREATE TABLE app_setting (
    name       VARCHAR(64) PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 원본 확보 재시도 횟수. 간격이 5분이므로 18회 = 약 1시간 30분.
-- DART가 원본을 배치로 공개해 접수 후 25~40분에 준비되는 것으로 관측됐다(M0 재측정).
INSERT INTO app_setting (name, value) VALUES ('fetch.max-retry', '18');
