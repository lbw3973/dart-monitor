package kr.irm.dart.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties(prefix = "dart")
public record DartProperties(
        String apiKey,
        String baseUrl,
        List<String> detailTypes,
        Duration pollInterval,
        int lookbackDays,
        int catchUpMaxDays,
        String rawDir,
        int fetchConcurrency,
        int maxRetry
) {}
