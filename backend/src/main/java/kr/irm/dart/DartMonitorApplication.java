package kr.irm.dart;

import kr.irm.dart.config.AdminProperties;
import kr.irm.dart.config.DartProperties;
import kr.irm.dart.config.KakaoProperties;
import kr.irm.dart.parser.ParseRules;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
@EnableConfigurationProperties({DartProperties.class, KakaoProperties.class, ParseRules.class,
        AdminProperties.class})
public class DartMonitorApplication {

	public static void main(String[] args) {
		SpringApplication.run(DartMonitorApplication.class, args);
	}
}
