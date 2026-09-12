package kr.irm.dart.service;

import kr.irm.dart.config.DartProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 운영 중 바꿀 수 있는 설정. app_setting 테이블에서 읽는다.
 *
 * 값을 고치면 재배포 없이 다음 사용 시점부터 반영된다. 캐시를 두지 않는 이유는
 * 호출 빈도가 낮아서다 — 원본 확보 실패 시에만 읽으므로 하루 수백 회 수준이고,
 * 캐시를 두면 "DB를 고쳤는데 안 바뀐다"는 혼란이 생긴다.
 */
@Service
public class SettingService {

    private static final Logger log = LoggerFactory.getLogger(SettingService.class);

    static final String FETCH_MAX_RETRY = "fetch.max-retry";

    private final JdbcTemplate jdbc;
    private final DartProperties props;

    public SettingService(JdbcTemplate jdbc, DartProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    /** 원본 확보 최대 재시도 횟수. */
    public int fetchMaxRetry() {
        return readInt(FETCH_MAX_RETRY, props.maxRetry());
    }

    /**
     * 값이 없거나 깨져 있으면 설정 파일 기본값으로 떨어진다.
     * 설정 하나가 수집 전체를 멈추게 하면 안 된다.
     */
    private int readInt(String name, int fallback) {
        try {
            List<Integer> rows = jdbc.queryForList(
                    "SELECT value::int FROM app_setting WHERE name = ?", Integer.class, name);
            if (rows.isEmpty() || rows.get(0) == null) return fallback;
            return rows.get(0);
        } catch (Exception e) {
            log.warn("설정 '{}' 읽기 실패 — 기본값 {} 사용 ({})", name, fallback, e.getMessage());
            return fallback;
        }
    }
}
