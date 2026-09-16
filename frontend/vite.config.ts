import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { mockApi } from "./dev/mock-api.ts";

/**
 * 화면에 표시할 프론트엔드 버전. 출처는 Makefile의 FRONTEND_VERSION 하나다.
 *
 * 도커 빌드에는 Makefile이 복사되지 않으므로 그쪽은 build-arg 로 주입된다(§Dockerfile.frontend).
 * 개발 서버에서는 여기서 Makefile을 직접 읽어, 배포본과 같은 값을 그대로 보여준다.
 */
function frontendVersion(): string {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION;
  try {
    const makefile = readFileSync(fileURLToPath(new URL("../Makefile", import.meta.url)), "utf8");
    return makefile.match(/^FRONTEND_VERSION\s*=\s*(\S+)/m)?.[1] ?? "";
  } catch {
    return "";
  }
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(frontendVersion()),
  },
  // MOCK_API=1 이면 백엔드 없이 고정 데이터로 화면을 띄운다(§dev/mock-api.ts).
  plugins: [react(), tailwindcss(), ...(process.env.MOCK_API ? [mockApi()] : [])],
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
