package kr.irm.dart.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DisclosureSectionRepository extends JpaRepository<DisclosureSection, Long> {

    List<DisclosureSection> findByRceptNoOrderBySectionNoAscSeqAsc(String rceptNo);

    void deleteByRceptNo(String rceptNo);
}
