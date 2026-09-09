package kr.irm.dart.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface BookmarkRepository extends JpaRepository<Bookmark, Bookmark.Key> {

    @Query("select b.rceptNo from Bookmark b where b.userId = :userId and b.rceptNo in :ids")
    List<String> findMarkedIds(@Param("userId") Long userId, @Param("ids") Collection<String> ids);

    @Query("select b.rceptNo from Bookmark b where b.userId = :userId")
    List<String> findAllRceptNos(@Param("userId") Long userId);
}
