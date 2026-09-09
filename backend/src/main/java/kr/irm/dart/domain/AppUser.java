package kr.irm.dart.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String provider = "kakao";

    @Column(name = "provider_uid", nullable = false, length = 64)
    private String providerUid;

    private String nickname;

    @Column(name = "profile_image")
    private String profileImage;

    @Column(nullable = false, length = 16)
    private String role = "USER";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected AppUser() {}

    public AppUser(String providerUid, String nickname, String profileImage) {
        this.providerUid = providerUid;
        this.nickname = nickname;
        this.profileImage = profileImage;
        this.lastLoginAt = Instant.now();
    }

    public void touch(String nickname, String profileImage) {
        if (nickname != null) this.nickname = nickname;
        if (profileImage != null) this.profileImage = profileImage;
        this.lastLoginAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getNickname() { return nickname; }
    public String getProfileImage() { return profileImage; }
    public String getRole() { return role; }
    public boolean isAdmin() { return "ADMIN".equals(role); }
}
