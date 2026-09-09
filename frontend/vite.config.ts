import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 설정을 한 곳에 모은다 — 루트의 .env 를 읽는다.
  // VITE_ 로 시작하는 값만 번들에 노출된다.
  envDir: "..",
  server: {
    port: 5173,
    host: true,        // 같은 와이파이의 휴대폰에서 접속해 반응형을 확인할 수 있다
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
