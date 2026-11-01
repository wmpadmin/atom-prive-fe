import { lazy, Suspense } from "react";

// The client view is the one screen that draws with ECharts, a heavy library; loaded only when a client is
// opened, so nobody else downloads it to sign in.
const ClientViewPage = lazy(() =>
  import("./client-view-page").then((module) => ({ default: module.ClientViewPage })),
);

export function LazyClientViewPage() {
  return (
    <Suspense fallback={null}>
      <ClientViewPage />
    </Suspense>
  );
}
