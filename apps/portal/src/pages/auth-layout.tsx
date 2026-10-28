import type { ReactNode } from "react";

/**
 * Split screen for signed-out pages: brand panel on the left, the form on the right.
 *
 * <p>The same shape as the back-office's, deliberately. The two front doors belong to one firm, and a
 * client who has seen their relationship manager's screen should recognise their own as the same place.
 * What changes is the words: this side is read by somebody whose money it is, not by somebody who works
 * here.
 */
export function AuthLayout({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen font-sans lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-linear-to-b from-brand-900 to-brand-950 p-12 text-on-fill lg:flex">
        <span aria-hidden="true" />
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-slate-300 uppercase">Atom Privé</p>
          <h1 className="text-4xl font-bold">{heading}</h1>
          <p className="max-w-sm text-slate-300">
            Your account with the firm, and the family who share it.
          </p>
        </div>
        {/* Not the back-office's line. Telling a client their sign-ins are audited reads as a warning;
            telling them the firm will never ask for their password is the thing that protects them. */}
        <p className="text-xs text-slate-400">Atom Privé will never ask you for your password.</p>
      </div>
      <main className="flex items-center justify-center bg-canvas px-6 py-12">{children}</main>
    </div>
  );
}
