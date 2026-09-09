import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,        // 같은 와이파이의 휴대폰에서 접속해 반응형을 확인할 수 있다
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
