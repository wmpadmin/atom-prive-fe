import { ApiError } from "@atomprive/api-client";
import "@fontsource-variable/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { SessionProvider } from "./auth/session-provider";
import "./index.css";
import { applyDensity, preference } from "./lib/preferences";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retrying a 4xx (forbidden, not found, validation) can't succeed.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});

// Before the first paint, so a reader who asked for compact never sees one frame of comfortable. The
// theme does the same thing from its own hook; this is the other half of it.
applyDensity(preference("density"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
