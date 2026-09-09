package kr.irm.dart.web;

import kr.irm.dart.auth.CurrentUser;
import kr.irm.dart.domain.AppUser;
import kr.irm.dart.domain.ParseStatus;
import kr.irm.dart.domain.ReportType;
import kr.irm.dart.service.DisclosureQueryService;
import kr.irm.dart.web.dto.DisclosureDetail;
import kr.irm.dart.web.dto.DisclosureSummary;
import kr.irm.dart.web.dto.PageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/disclosures")
public class DisclosureController {

    private final DisclosureQueryService service;

    public DisclosureController(DisclosureQueryService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<DisclosureSummary> list(
            @RequestParam(required = false) ReportType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ParseStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @CurrentUser AppUser user) {
        return service.search(type, from, to, q, status, page, size, user);
    }

    @GetMapping("/{rceptNo}")
    public ResponseEntity<DisclosureDetail> detail(@PathVariable String rceptNo,
                                                   @CurrentUser AppUser user) {
        DisclosureDetail d = service.detail(rceptNo, user);
        return d == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(d);
    }
}
