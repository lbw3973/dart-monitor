package kr.irm.dart.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.time.LocalTime;
import java.util.List;

@ConfigurationProperties(prefix = "dart")
public record DartProperties(
        String apiKey,
        String baseUrl,
        List<String> detailTypes,
        List<String> corpClasses,
        Duration pollInterval,
        LocalTime activeFrom,
        LocalTime activeTo,
        boolean weekendPoll,
        int morningLookbackDays,
        int lookbackDays,
        int catchUpMaxDays,
        String rawDir,
        int fetchConcurrency,
        int maxRetry
) {}
