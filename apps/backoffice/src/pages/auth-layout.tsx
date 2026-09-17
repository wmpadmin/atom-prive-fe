import type { ReactNode } from "react";

/** Split screen for signed-out pages: brand panel on the left, the form on the right. */
export function AuthLayout({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen font-sans lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-linear-to-b from-brand-900 to-brand-950 p-12 text-white lg:flex">
        <p className="text-xl font-bold">Atom Privé</p>
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-slate-300 uppercase">Back-office</p>
          <h1 className="text-4xl font-bold">{heading}</h1>
          <p className="max-w-sm text-slate-300">For Admin, Advisor, Compliance and Operations teams.</p>
        </div>
        <p className="text-xs text-slate-400">Every sign-in is recorded in the audit trail.</p>
      </div>
      <main className="flex items-center justify-center bg-canvas px-6 py-12">{children}</main>
    </div>
  );
}
