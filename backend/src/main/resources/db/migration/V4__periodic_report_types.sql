-- 정기공시 3종(사업·반기·분기)을 report_type에 추가한다.
-- 세 서식은 AASSOCNOTE 목차 ID가 동일하지만(M8 발견 1), 화면에서 구분해 보여주므로
-- 하나로 합치지 않고 각각 값을 둔다.
ALTER TABLE disclosure DROP CONSTRAINT disclosure_report_type_check;
ALTER TABLE disclosure ADD CONSTRAINT disclosure_report_type_check
    CHECK (report_type IN ('MAJOR_HOLDING_SIMPLE','MAJOR_HOLDING_GENERAL','EXEC_OWNERSHIP',
                           'BUSINESS_REPORT','HALF_YEAR_REPORT','QUARTER_REPORT',
                           'OTHER'));
