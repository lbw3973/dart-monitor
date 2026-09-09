import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initAnalytics } from "./analytics";
import App from "./App";
import "./index.css";

// 이전 방문에서 동의했다면 여기서 gtag 를 붙인다. 아니면 아무 일도 하지 않는다.
initAnalytics();

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 10_000 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
