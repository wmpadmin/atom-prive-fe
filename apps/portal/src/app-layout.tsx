import { Outlet } from "react-router";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-brand-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <span className="text-lg font-semibold text-brand-900">Atom Privé</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
