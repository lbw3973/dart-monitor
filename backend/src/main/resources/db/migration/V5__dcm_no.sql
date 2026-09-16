-- DART 뷰어 문서번호. 정기공시 본문의 이미지를 화면에 띄우는 데 쓴다.
--
-- 이미지 파일은 공시서류원본파일(ZIP)에 들어있지 않고 XML에는 파일명만 있다.
-- 실제 파일은 뷰어 경로로만 받을 수 있는데, 그 주소에 dcm_no가 필요하다:
--   https://dart.fss.or.kr/report/download.do?dcmNo={dcm_no}&flNm={파일명}
--
-- dcm_no는 OpenDART API가 주지 않아 dsaf001/main.do HTML에서 긁어야 한다.
-- 비공식 경로라 실패할 수 있으므로 NULL을 허용하고, 없으면 이미지 대신 자리표시를 보여준다.
ALTER TABLE disclosure ADD COLUMN dcm_no VARCHAR(16);
