import { ApiError } from "@atomprive/api-client";
import {
  getClientsWithSessionsQueryKey,
  getStaffWithSessionsQueryKey,
  useClientSessionHistory,
  useClientsWithSessions,
  useEndClientSession,
  useEndStaffSession,
  useStaffHistory,
  useStaffWithSessions,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, StaffAvatar, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDateTime, formatRelative } from "../../lib/labels";

/**
 * Where everybody has signed in, for the Admin.
 *
 * <p>Two of these, staff and clients, because they are two different populations and confusing one for
 * the other is the mistake worth designing against. The screens are the same shape: everybody, with the
 * last time they signed in, and opening one shows every session they have had.
 *
 * <p>"Where is somebody signed in now" is a different question, answered on their own Security tab.
 * This answers "where have they been", which is the one asked after the fact.
 */
export function SessionsTab({ of }: { of: "staff" | "clients" }) {
  const [open, setOpen] = useState<string | null>(null);
  return of === "staff" ? <StaffSessions open={open} onOpen={setOpen} /> : <ClientSessions open={open} onOpen={setOpen} />;
}

function StaffSessions({ open, onOpen }: { open: string | null; onOpen: (id: string | null) => void }) {
  const people = useStaffWithSessions<Person[], ApiError>();
  const queries = useQueryClient();
  const end = useEndStaffSession<ApiError>({
    mutation: { onSuccess: () => void queries.invalidateQueries({ queryKey: getStaffWithSessionsQueryKey() }) },
  });
  return (
    <People
      title="Staff"
      lead="Everybody at the firm, and the last time they signed into the back office."
      people={people.data}
      error={people.error}
      loading={people.isPending}
      open={open}
      onOpen={onOpen}
      face={(person) => <StaffAvatar name={person.fullName} photo={person.photo} />}
      history={(id) => <StaffHistory staffUserId={id} onEnd={(s) => end.mutate({ staffUserId: id, sessionId: s })} ending={end.isPending} />}
    />
  );
}

function ClientSessions({ open, onOpen }: { open: string | null; onOpen: (id: string | null) => void }) {
  const people = useClientsWithSessions<ClientPerson[], ApiError>();
  const queries = useQueryClient();
  const end = useEndClientSession<ApiError>({
    mutation: { onSuccess: () => void queries.invalidateQueries({ queryKey: getClientsWithSessionsQueryKey() }) },
  });
  return (
    <People
      title="Clients"
      lead="Every client who has a way into the portal, and the last time they used it."
      people={people.data?.map((one) => ({ ...one, personId: one.clientLoginId }))}
      error={people.error}
      loading={people.isPending}
      open={open}
      onOpen={onOpen}
      face={(person) => <Avatar name={person.fullName} photo={person.photo} />}
      history={(id) => <ClientHistory clientLoginId={id} onEnd={(s) => end.mutate({ clientLoginId: id, sessionId: s })} ending={end.isPending} />}
    />
  );
}

type Session = {
  id: string;
  device?: string | null;
  ipAddress?: string | null;
  location?: string | null;
  signedInAt: string;
  lastActiveAt: string;
  expiresAt: string;
  endedAt?: string | null;
  endedReason?: string | null;
  workingAs?: string | null;
  live: boolean;
};

type Person = { personId: string; fullName: string; photo?: string | null; mark?: string | null; latest?: Session | null };

type ClientPerson = Omit<Person, "personId"> & { clientLoginId: string; customerId: string };

/** The list of people, and whichever of them is open. */
function People({
  title,
  lead,
  people,
  error,
  loading,
  open,
  onOpen,
  face,
  history,
}: {
  title: string;
  lead: string;
  people: Person[] | undefined;
  error: ApiError | null;
  loading: boolean;
  open: string | null;
  onOpen: (id: string | null) => void;
  face: (person: Person) => React.ReactNode;
  history: (id: string) => React.ReactNode;
}) {
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  if (loading) return <p className="text-sm text-ink-muted">Reading the sessions…</p>;
  const rows = people ?? [];

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{lead}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem]">
          <thead>
            <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th className="px-5 py-2.5 text-left">Person</th>
              <th className="px-4 py-2.5 text-left">Last signed in</th>
              <th className="px-4 py-2.5 text-left">Where from</th>
              <th className="px-4 py-2.5 text-left">State</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {/* The headings stay when there is nobody under them, so an empty list reads as empty rather
                than as a screen that failed to draw. */}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">
                  Nobody here yet.
                </td>
              </tr>
            )}
            {rows.map((person) => (
              <RowAndHistory
                key={person.personId}
                person={person}
                face={face}
                open={open === person.personId}
                onOpen={() => onOpen(open === person.personId ? null : person.personId)}
                history={history}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RowAndHistory({
  person,
  face,
  open,
  onOpen,
  history,
}: {
  person: Person;
  face: (person: Person) => React.ReactNode;
  open: boolean;
  onOpen: () => void;
  history: (id: string) => React.ReactNode;
}) {
  const latest = person.latest;
  return (
    <>
      <tr
        onClick={onOpen}
        className={cn("cursor-pointer border-b border-line hover:bg-slate-50/60", open && "bg-primary-50/40")}
      >
        <td className="px-5 py-3">
          <span className="flex items-center gap-3">
            {face(person)}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{person.fullName}</span>
              {person.mark && <span className="block truncate text-xs text-ink-muted">{person.mark}</span>}
            </span>
          </span>
        </td>
        {/* Never signed in is a thing worth seeing, so it is said rather than left as an empty row. */}
        <td className="px-4 py-3 text-sm whitespace-nowrap text-ink-soft">
          {latest ? formatRelative(latest.lastActiveAt) : <span className="text-ink-muted">Never</span>}
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap text-ink-muted">
          {latest ? [latest.location, latest.device].filter(Boolean).join(" · ") || "—" : "—"}
        </td>
        <td className="px-4 py-3">{latest ? <State session={latest} /> : <span className="text-sm text-ink-muted">—</span>}</td>
        <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap text-primary-700">
          {open ? "Hide" : "Every session"}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-canvas/60">
          <td colSpan={5} className="px-5 py-4">
            {history(person.personId)}
          </td>
        </tr>
      )}
    </>
  );
}

function State({ session }: { session: Session }) {
  if (session.live) return <Badge tone="success">Active</Badge>;
  if (session.endedAt) return <Badge tone="neutral">{said(session.endedReason)}</Badge>;
  return <Badge tone="warning">Expired</Badge>;
}

/** The firm's own words for why a session ended, rather than the enum it is stored as. */
function said(reason?: string | null) {
  const words: Record<string, string> = {
    LOGOUT: "Signed out",
    PASSWORD_CHANGED: "Password changed",
    PASSWORD_RESET: "Password reset",
    ROLE_CHANGED: "Role changed",
    DEACTIVATED: "Deactivated",
    ENDED_BY_ADMIN: "Ended by an Admin",
  };
  return (reason && words[reason]) ?? "Ended";
}

function StaffHistory({ staffUserId, onEnd, ending }: { staffUserId: string; onEnd: (id: string) => void; ending: boolean }) {
  const history = useStaffHistory<Session[], ApiError>(staffUserId);
  return <History sessions={history.data} error={history.error} loading={history.isPending} onEnd={onEnd} ending={ending} />;
}

function ClientHistory({ clientLoginId, onEnd, ending }: { clientLoginId: string; onEnd: (id: string) => void; ending: boolean }) {
  const history = useClientSessionHistory<Session[], ApiError>(clientLoginId);
  return <History sessions={history.data} error={history.error} loading={history.isPending} onEnd={onEnd} ending={ending} />;
}

/** Every session one person has had, newest first. */
function History({
  sessions,
  error,
  loading,
  onEnd,
  ending,
}: {
  sessions: Session[] | undefined;
  error: ApiError | null;
  loading: boolean;
  onEnd: (id: string) => void;
  ending: boolean;
}) {
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  if (loading) return <p className="text-sm text-ink-muted">Reading their sessions…</p>;
  const rows = sessions ?? [];
  if (rows.length === 0) return <p className="text-sm text-ink-muted">They have never signed in.</p>;

  return (
    <table className="w-full">
      <thead>
        <tr className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          <th className="py-2 pr-4 text-left">Signed in</th>
          <th className="py-2 pr-4 text-left">Last used</th>
          <th className="py-2 pr-4 text-left">Where from</th>
          <th className="py-2 pr-4 text-left">Ended</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {rows.map((session) => (
          <tr key={session.id} className="border-t border-line/70 text-sm">
            <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(session.signedInAt)}</td>
            <td className="py-2 pr-4 whitespace-nowrap text-ink-muted">{formatRelative(session.lastActiveAt)}</td>
            <td className="py-2 pr-4 text-ink-muted">
              {[session.location, session.device, session.ipAddress].filter(Boolean).join(" · ") || "—"}
            </td>
            <td className="py-2 pr-4 whitespace-nowrap">
              {session.live ? <Badge tone="success">Still open</Badge> : <span className="text-ink-muted">{said(session.endedReason)}</span>}
            </td>
            <td className="py-2 text-right whitespace-nowrap">
              {/* Only a live one can be ended, and ending it signs them out at once — which is the point
                  of it, for a laptop somebody no longer has. */}
              {session.live && (
                <Button variant="secondary" size="sm" disabled={ending} onClick={() => onEnd(session.id)}>
                  Sign them out
                </Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
