import { ApiError } from "@atomprive/api-client";
import { useEnterWorkspace, type StaffProfileRolesItem } from "@atomprive/api-client/backoffice";
import { Alert, Badge } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChartColumn, ChartLine, Settings, Shield, ShieldCheck, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useSession, useStaffUser } from "../auth/session";

/** How each role's workspace is introduced, in the wording of the design. */
const workspaces: Record<StaffProfileRolesItem, { name: string; description: string; icon: LucideIcon }> = {
  ADMIN: { name: "Admin", description: "Users, roles & permissions, and platform configuration.", icon: ShieldCheck },
  ADVISOR: {
    name: "Relationship Advisor",
    description: "Client portfolios, aggregation, analytics and advisory proposals.",
    icon: ChartLine,
  },
  COMPLIANCE: {
    name: "Compliance Officer",
    description: "KYC / AML / source-of-funds review and the accept-reject decision.",
    icon: Shield,
  },
  OPERATIONS: {
    name: "Operations",
    description: "Onboarding forms, e-signatures, new-bank registration and feed health.",
    icon: Settings,
  },
  PORTFOLIO_MANAGER: {
    name: "Product Portfolio Manager",
    description: "Model portfolio, mandate rebalancing and house view allocation across books.",
    icon: ChartColumn,
  },
};

/** After sign-in, people holding several roles pick the one to work in (#14). The menu follows that role. */
export function WorkspacePage() {
  const user = useStaffUser();
  const { applyProfile, signOut } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();

  const enter = useEnterWorkspace<ApiError>({
    mutation: {
      onSuccess: (profile) => {
        // Nothing loaded in the previous role carries over into the new one.
        queryClient.clear();
        applyProfile(profile);
        navigate("/", { replace: true });
      },
      onError: (caught) => setError(caught.message),
    },
  });

  // Someone with a single role has nothing to choose.
  if (user.roles.length === 1 && user.activeRole) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="grid min-h-screen font-sans text-ink lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-linear-to-b from-[#0d3f86] via-brand-900 to-brand-950 px-14 py-12 text-white lg:flex">
        <span aria-hidden="true" />
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">Role-based workspace</p>
          <h1 className="mt-4 text-6xl leading-[1.02] font-bold tracking-tight text-balance">Choose your workspace.</h1>
          <p className="mt-6 text-lg leading-relaxed text-white/75">
            Each role lands on its own dashboard with a navigation menu scoped to its access. Select the panel you want to
            enter.
          </p>
        </div>
        <p className="text-xs text-white/70">Atom Financial Services Group · Bengaluru · Dubai · Singapore</p>
      </section>

      <main className="flex flex-col bg-canvas px-6 py-8 sm:px-12">
        <div className="flex items-center justify-end gap-3 text-sm text-ink-muted">
          <span>{user.fullName}</span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => void signOut()} className="font-semibold text-ink-soft hover:text-ink">
            Sign out
          </button>
        </div>

        <div className="my-auto w-full max-w-2xl self-center py-10">
          <h1 className="mb-6 text-3xl font-bold lg:sr-only">Choose your workspace</h1>
          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <ul className="space-y-4">
            {user.roles.map((role) => {
              const workspace = workspaces[role];
              const Icon = workspace.icon;
              const entering = enter.isPending && enter.variables?.data.role === role;
              return (
                <li key={role}>
                  <button
                    type="button"
                    disabled={enter.isPending}
                    onClick={() => {
                      setError(undefined);
                      enter.mutate({ data: { role } });
                    }}
                    className="group flex w-full items-start gap-4 rounded-2xl border border-line bg-white px-6 py-5 text-left transition hover:border-primary-600 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-wait"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">{workspace.name}</span>
                        {user.activeRole === role && <Badge tone="info">Current</Badge>}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-muted">{workspace.description}</span>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600">
                        {entering ? "Entering…" : "Enter panel"}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
