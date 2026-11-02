import { ApiError } from "@atomprive/api-client";
import {
  getGetClientSecurityQueryKey,
  useGenerateTemporaryPassword,
  useGetClientSecurity,
  useResetAuthentication,
  useRevokeSessions,
  type SecurityActivity,
  type SecurityStanding,
  type TemporaryPasswordIssued,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  History,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  MonitorSmartphone,
  RefreshCcw,
  ShieldCheck,
  ShieldPlus,
  UserRoundCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";

/*
 * A client's way into the portal: how it stands, the firm's three actions on it, and what has happened to it.
 *
 * Operations and Admin act; Compliance reads. A temporary password is shown once, in the window that made it,
 * and never again: the client's own password is never seen by anybody.
 */

function dateTime(at: string | null | undefined) {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function day(at: string) {
  return new Date(at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const PASSWORD: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  EXPIRED: { label: "Expired", tone: "danger" },
  TEMPORARY: { label: "Temporary", tone: "warning" },
  TEMPORARY_EXPIRED: { label: "Temporary · expired", tone: "danger" },
  NONE: { label: "Not set", tone: "neutral" },
};

const ACCOUNT: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  LOCKED: { label: "Locked for an hour", tone: "warning" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  NO_LOGIN: { label: "No portal login", tone: "neutral" },
};

const ACTION_ICON: Record<string, LucideIcon> = {
  login_succeeded: LogIn,
  login_failed: XCircle,
  temporary_password: KeyRound,
  authentication_reset: RefreshCcw,
  sessions_revoked: LogOut,
  authenticator_set_up: ShieldPlus,
  password_created: UserRoundCheck,
};

function Card({ title, icon: Icon, action, children }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Overview({ standing }: { standing: SecurityStanding }) {
  const password = PASSWORD[standing.password] ?? PASSWORD.NONE!;
  const cells: { label: string; value: ReactNode }[] = [
    {
      label: "Authentication (MFA)",
      value: standing.authenticatorSetUp ? <Badge tone="success">Enabled</Badge> : <Badge tone="warning">Not set up</Badge>,
    },
    { label: "Password status", value: <Badge tone={password.tone}>{password.label}</Badge> },
    { label: "Last login", value: <span className="text-sm font-semibold text-ink">{dateTime(standing.lastSignedInAt)}</span> },
    { label: "Active sessions", value: <span className="text-lg font-bold text-ink tabular-nums">{standing.activeSessions}</span> },
    { label: "Last auth reset", value: <span className="text-sm font-semibold text-ink">{dateTime(standing.lastAuthenticationReset)}</span> },
  ];
  return (
    <Card title="Authentication overview" icon={ShieldCheck}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5 xl:divide-x xl:divide-line">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0 space-y-1.5 xl:px-4 xl:first:pl-0">
            <dt className="text-xs font-medium text-ink-muted">{cell.label}</dt>
            <dd>{cell.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function ActionRow({ icon: Icon, title, lead, button }: { icon: LucideIcon; title: string; lead: string; button: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{lead}</p>
      </div>
      <div className="shrink-0">{button}</div>
    </li>
  );
}

function Recent({ rows }: { rows: SecurityActivity[] }) {
  return (
    <Card
      title="Recent security activity"
      icon={History}
      action={
        <Link to="/audit-log" className="text-xs font-semibold text-primary-700 hover:underline">
          View full audit log →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Nothing has happened to this client's sign-in yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="bg-sidebar text-xs text-ink-muted">
                <th scope="col" className="rounded-l-lg px-3 py-2 font-semibold">Date &amp; time</th>
                <th scope="col" className="px-3 py-2 font-semibold">Action</th>
                <th scope="col" className="px-3 py-2 font-semibold">Performed by</th>
                <th scope="col" className="rounded-r-lg px-3 py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => {
                const Icon = ACTION_ICON[row.action] ?? Circle;
                return (
                  <tr key={`${row.at}-${index}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft tabular-nums">{dateTime(row.at)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`flex items-center gap-2 font-semibold ${row.succeeded ? "text-ink" : "text-red-700"}`}>
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        {row.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{row.by}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{row.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const FLOW = [
  { title: "Onboarding", lead: "The firm generates a temporary password and gives it to the client." },
  { title: "First login", lead: "The client signs in with the temporary password, sets up an authenticator app and creates a new password." },
  { title: "Normal login", lead: "The client uses their own password and the code from their authenticator app." },
  { title: "Reset (anytime)", lead: "Operations or Admin can generate a new temporary password or reset authentication. The client completes setup again." },
];

function Flow() {
  return (
    <Card title="Authentication flow" icon={Info}>
      <ol className="space-y-4">
        {FLOW.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                index === FLOW.length - 1 ? "bg-slate-200 text-ink-soft" : "bg-primary-600 text-on-accent"
              }`}
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{step.title}</p>
              <p className="text-xs text-ink-muted">{step.lead}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Status({ standing }: { standing: SecurityStanding }) {
  const account = ACCOUNT[standing.account] ?? ACCOUNT.NO_LOGIN!;
  const temporaryLive = standing.password === "TEMPORARY";
  const rows: { label: string; value: string; good: boolean }[] = [
    {
      label: "Temporary password",
      value: temporaryLive && standing.temporaryExpiresAt ? `Active until ${dateTime(standing.temporaryExpiresAt)}` : "Not active",
      good: !temporaryLive,
    },
    { label: "MFA / Authenticator", value: standing.authenticatorSetUp ? "Enabled" : "Not set up", good: standing.authenticatorSetUp },
    {
      label: "Password expiry",
      value: standing.passwordExpiresAt ? `90 days (${day(standing.passwordExpiresAt)})` : "—",
      good: standing.password === "ACTIVE",
    },
    { label: "Account status", value: account.label, good: standing.account === "ACTIVE" },
  ];
  return (
    <Card title="Security status" icon={MonitorSmartphone}>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            {row.good ? (
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
            )}
            <span className="flex-1 text-sm font-semibold text-ink">{row.label}</span>
            <span className="text-right text-sm text-ink-soft">{row.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The temporary password, once, with a way to copy it. */
function Issued({ name, issued, onDone }: { name: string; issued: TemporaryPasswordIssued; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onClose={onDone} title="Temporary password created" description={`A temporary password has been generated for ${name}.`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">Temporary password</p>
            <p className="font-mono text-lg font-bold break-all text-ink">{issued.temporaryPassword}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigator.clipboard.writeText(issued.temporaryPassword).then(() => setCopied(true))}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-primary-50 px-4 py-3 text-xs text-primary-700">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Valid for 24 hours, until the client uses it to set up their sign-in. It won't be shown again.
          {issued.sessionsEnded > 0 && ` ${issued.sessionsEnded} active session${issued.sessionsEnded === 1 ? " was" : "s were"} ended.`}
        </p>
        <div className="flex justify-end">
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}

type Asking = "temporary" | "reset" | "revoke" | null;

const ASKS: Record<Exclude<Asking, null>, { title: string; lead: (name: string) => string; note: string; confirm: string }> = {
  temporary: {
    title: "Generate temporary password",
    lead: (name) => `A new temporary password will be generated for ${name}. Their current password stops working.`,
    note: "The client signs in with it and their authenticator code, then creates a new password.",
    confirm: "Generate",
  },
  reset: {
    title: "Reset authentication",
    lead: (name) => `This removes ${name}'s authenticator app, signs them out of every device and gives them a temporary password.`,
    note: "The client must sign in with the temporary password, set up authentication again and create a new password.",
    confirm: "Reset authentication",
  },
  revoke: {
    title: "Revoke all sessions",
    lead: (name) => `${name} will be signed out of every device and browser at once.`,
    note: "Their password and authenticator stay as they are. They sign in again as usual.",
    confirm: "Revoke sessions",
  },
};

export function SecurityTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const user = useStaffUser();
  const canAct = hasAuthority(user, "CLIENT_SIGN_IN:CHANGE");
  const queryClient = useQueryClient();
  const security = useGetClientSecurity<SecurityStanding, ApiError>(clientId);
  const [asking, setAsking] = useState<Asking>(null);
  const [issued, setIssued] = useState<TemporaryPasswordIssued>();
  const [notice, setNotice] = useState<string>();
  const [problem, setProblem] = useState<string>();

  const settled = {
    onSettled: () => void queryClient.invalidateQueries({ queryKey: getGetClientSecurityQueryKey(clientId) }),
    onError: (failed: ApiError) => setProblem(failed.message),
  };
  const temporary = useGenerateTemporaryPassword<ApiError>({
    mutation: { ...settled, onSuccess: (answer: TemporaryPasswordIssued) => { setAsking(null); setIssued(answer); } },
  });
  const reset = useResetAuthentication<ApiError>({
    mutation: { ...settled, onSuccess: (answer: TemporaryPasswordIssued) => { setAsking(null); setIssued(answer); } },
  });
  const revoke = useRevokeSessions<ApiError>({
    mutation: {
      ...settled,
      onSuccess: (answer) => {
        setAsking(null);
        setNotice(answer.sessionsEnded === 1 ? "1 session was ended." : `${answer.sessionsEnded} sessions were ended.`);
      },
    },
  });
  const busy = temporary.isPending || reset.isPending || revoke.isPending;

  if (security.isError) {
    return <Alert tone="danger">{security.error.message}</Alert>;
  }
  if (!security.data) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white" />;
  }
  const standing = security.data;

  const ask = (which: Exclude<Asking, null>) => {
    setProblem(undefined);
    setNotice(undefined);
    setAsking(which);
  };
  const confirm = () => {
    if (asking === "temporary") temporary.mutate({ customerId: clientId });
    if (asking === "reset") reset.mutate({ customerId: clientId });
    if (asking === "revoke") revoke.mutate({ customerId: clientId });
  };
  const asked = asking ? ASKS[asking] : null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {notice && <Alert tone="success">{notice}</Alert>}
        {!standing.canSignIn && (
          <Alert tone="info">
            {clientName} has no portal login yet. Generating a temporary password gives them one
            {standing.email ? ` on ${standing.email}` : ""}.
          </Alert>
        )}
        <Overview standing={standing} />
        <Card title="Security actions" icon={KeyRound}>
          <p className="-mt-2 mb-4 text-xs text-ink-muted">Manage the client's password and authentication setup.</p>
          <ul className="space-y-3">
            <ActionRow
              icon={KeyRound}
              title="Generate temporary password"
              lead="Create a new temporary password for the client. They sign in with it, enter their authenticator code and create a new password."
              button={canAct && <Button size="sm" onClick={() => ask("temporary")}>+ Generate temporary password</Button>}
            />
            <ActionRow
              icon={RefreshCcw}
              title="Reset authentication"
              lead="Remove the client's authenticator app and sign them out everywhere. They sign in with a temporary password and set up authentication again."
              button={canAct && standing.canSignIn && <Button size="sm" variant="secondary" onClick={() => ask("reset")}>Reset authentication</Button>}
            />
            <ActionRow
              icon={LogOut}
              title="Revoke all sessions"
              lead="Sign the client out of every device and browser immediately."
              button={canAct && standing.canSignIn && (
                <Button size="sm" variant="secondary" disabled={standing.activeSessions === 0} onClick={() => ask("revoke")}>
                  Revoke sessions
                </Button>
              )}
            />
          </ul>
          {!canAct && <p className="mt-3 text-xs text-ink-muted">Only Operations and Admin can take these actions.</p>}
        </Card>
        <Recent rows={standing.recent} />
      </div>
      <div className="min-w-0 space-y-5">
        <Flow />
        <Status standing={standing} />
      </div>

      {asked && (
        <Dialog open onClose={() => !busy && setAsking(null)} title={asked.title} description={asked.lead(clientName)}>
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-xl bg-primary-50 px-4 py-3 text-xs text-primary-700">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {asked.note}
            </p>
            {problem && <Alert tone="danger">{problem}</Alert>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setAsking(null)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={confirm}>
                {busy ? "Working…" : asked.confirm}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      {issued && <Issued name={clientName} issued={issued} onDone={() => setIssued(undefined)} />}
    </div>
  );
}
