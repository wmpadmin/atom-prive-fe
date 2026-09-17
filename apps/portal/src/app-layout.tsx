import { Outlet } from "react-router";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-brand-50 text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
