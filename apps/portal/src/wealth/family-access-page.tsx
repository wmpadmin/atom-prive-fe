import { ApiError } from "@atomprive/api-client";
import {
  getFamilyQueryKey,
  getMyInviteAsksQueryKey,
  getPermissionsQueryKey,
  getWealthGrantsQueryKey,
  getFamilyWealthQueryKey,
  getAccountsQueryKey,
  useAccounts,
  useAskToInvite,
  useFamily,
  useGiveBackWealth,
  useMyInviteAsks,
  usePermissions,
  useRelinquish,
  useRevoke,
  useStopSharingWealth,
  useWealthGrants,
  useWithdrawInviteAsk,
  type AccountRow,
  type FamilyPerson,
  type GrantRow,
  type InviteAsk,
  type MyFamily,
  type MyPermissions,
  type WealthGrant,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, KeyRound, Mail, Send, Share2, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { when } from "../lib/dates";
import { accountKind, initialsOf } from "../lib/money";
import { AccessPill } from "./access-pill";
import { GrantDialog } from "./accounts-page";
import { ShareDialog } from "./family-wealth-page";

/**
 * Who is in the client's family, who may see what of whose, and who has been invited. Every member gives and
 * takes back sight of their own accounts and wealth; only the account's holder may ask the firm to invite
 * somebody new, and the firm checks and sends that invitation itself.
 */

const TABS = [
  { id: "members", label: "Members" },
  { id: "given", label: "Access I've given" },
  { id: "held", label: "Access I have" },
  { id: "invitations", label: "Invitations" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** The firm's relationship types a client may name. The server refuses any other. */
const RELATIONSHIPS = [
  { code: "SPOUSE", name: "Spouse" },
  { code: "CHILD", name: "Child" },
  { code: "PARENT", name: "Parent" },
  { code: "SIBLING", name: "Sibling" },
  { code: "OTHER", name: "Other" },
] as const;

const HEAD = "border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase";

const ENDED: Record<string, string> = {
  REVOKED: "Taken back",
  RELINQUISHED: "Given back",
  LEFT_FAMILY: "Ended when they left the family",
  ACCOUNT_CLOSED: "Account closed",
};

function Face({ name, photo }: { name: string; photo: string | null }) {
  return photo ? (
    <img src={photo} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{initialsOf(name)}</span>
  );
}

function Pill({ tone, children }: { tone: "live" | "waiting" | "ended" | "refused"; children: ReactNode }) {
  const tones = {
    live: "bg-access-full-soft text-access-full-ink",
    waiting: "bg-access-view-soft text-access-view-ink",
    ended: "bg-canvas text-ink-soft",
    refused: "bg-access-none-soft text-access-none-ink",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-ink-muted">{children}</p>;
}

/** One line of sharing, an account or the whole of somebody's wealth, as a table row. */
type Line = {
  key: string;
  who: string;
  photo: string | null;
  what: string;
  detail: string;
  since: string;
  until: string | null;
  live: boolean;
  ended: string | null;
  action?: { label: string; run: () => void; busy: boolean };
};

function Lines({ lines, whoHead, empty }: { lines: Line[]; whoHead: string; empty: string }) {
  if (lines.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className={HEAD}>
            <th scope="col" className="py-3 pr-4 pl-3">{whoHead}</th>
            <th scope="col" className="px-4 py-3">What</th>
            <th scope="col" className="px-4 py-3">Permission</th>
            <th scope="col" className="px-4 py-3">Since</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="py-3 pr-3 pl-4"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((one) => (
            <tr key={one.key} className={one.live ? "" : "text-ink-muted"}>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-3">
                  <Face name={one.who} photo={one.photo} />
                  <span className="font-semibold text-ink">{one.who}</span>
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="block font-semibold text-ink">{one.what}</span>
                <span className="block text-xs text-ink-muted">{one.detail}</span>
              </td>
              <td className="px-3 py-2.5">
                <AccessPill mine={false} />
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{when(one.since)}</td>
              <td className="px-3 py-2.5">
                {one.live ? (
                  <Pill tone="live">{one.until ? `Active until ${when(one.until)}` : "Active"}</Pill>
                ) : (
                  <Pill tone="ended">{one.ended ?? "Ended"}</Pill>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                {one.live && one.action && (
                  <Button variant="secondary" size="sm" disabled={one.action.busy} onClick={one.action.run}>
                    {one.action.label}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The holder says who to invite. Nothing is sent from here: the firm checks it and sends the invitation. */
function InviteDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [relationshipCode, setRelationshipCode] = useState<string>("SPOUSE");
  const [message, setMessage] = useState("");
  const ask = useAskToInvite<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getMyInviteAsksQueryKey() });
        onClose();
      },
    },
  });
  const field = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600";
  const label = "mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase";

  return (
    <Dialog
      open
      onClose={onClose}
      title="Invite a family member"
      description="Tell us who to invite. Your relationship manager checks the details and sends the invitation; you'll see here when it has gone."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          ask.mutate({ data: { fullName, email, relationshipCode, personalMessage: message || null } });
        }}
      >
        <div>
          <label htmlFor="invite-name" className={label}>Full name</label>
          <input id="invite-name" name="invite-name" required maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="invite-email" className={label}>Email</label>
          <input id="invite-email" name="invite-email" type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="invite-relationship" className={label}>They are your</label>
          <select id="invite-relationship" name="invite-relationship" value={relationshipCode} onChange={(event) => setRelationshipCode(event.target.value)} className={field}>
            {RELATIONSHIPS.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="invite-message" className={label}>A line from you (optional)</label>
          <textarea
            id="invite-message"
            name="invite-message"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </div>
        {ask.isError && <Alert tone="danger">{ask.error.message}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={ask.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!fullName.trim() || !email.trim() || ask.isPending}>
            <Send aria-hidden="true" />
            {ask.isPending ? "Sending…" : "Send to my relationship manager"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Members({ people, wealth }: { people: FamilyPerson[]; wealth: WealthGrant[] }) {
  const me = people.find((one) => one.you);
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {people.map((one) => {
        const showsMe = wealth.some((grant) => !grant.mine && grant.ownerId === one.id);
        const seesMine = wealth.some((grant) => grant.mine && grant.granteeId === one.id);
        return (
          <li key={one.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <Face name={one.fullName} photo={one.photo} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-bold text-ink">
                  {one.fullName}
                  {one.you && <span className="font-medium text-ink-muted">(you)</span>}
                  {one.primaryHolder && <Crown aria-label="Account holder" className="size-4 shrink-0 text-amber-500" />}
                </p>
                <p className="text-xs text-ink-muted">
                  {one.relationshipToPrimary ?? one.relationship ?? (one.primaryHolder ? "Account holder" : "Family member")} · joined {when(one.joinedOn)}
                </p>
              </div>
            </div>
            {!one.you && me && (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-sidebar px-3 py-2">
                  <dt className="text-ink-muted">Sees your accounts</dt>
                  <dd className="font-semibold text-ink tabular-nums">{one.theyCanSeeMine}</dd>
                </div>
                <div className="rounded-xl bg-sidebar px-3 py-2">
                  <dt className="text-ink-muted">You see theirs</dt>
                  <dd className="font-semibold text-ink tabular-nums">{one.iCanSeeTheirs}</dd>
                </div>
                <div className="rounded-xl bg-sidebar px-3 py-2">
                  <dt className="text-ink-muted">Sees your wealth</dt>
                  <dd className="font-semibold text-ink">{seesMine ? "Yes" : "No"}</dd>
                </div>
                <div className="rounded-xl bg-sidebar px-3 py-2">
                  <dt className="text-ink-muted">Shows you theirs</dt>
                  <dd className="font-semibold text-ink">{showsMe ? "Yes" : "No"}</dd>
                </div>
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function askStatus(ask: InviteAsk) {
  switch (ask.status) {
    case "SENT":
      return <Pill tone="live">Invitation sent</Pill>;
    case "DECLINED":
      return <Pill tone="refused">Not sent</Pill>;
    case "WITHDRAWN":
      return <Pill tone="ended">Withdrawn</Pill>;
    default:
      return <Pill tone="waiting">With your relationship manager</Pill>;
  }
}

function Invitations({ family, asks, onWithdraw, busy }: { family: MyFamily; asks: InviteAsk[]; onWithdraw: (id: string) => void; busy: boolean }) {
  // An ask the firm sent is the invitation listed below it; showing both would read as two invitations.
  const asked = asks.filter((one) => one.status !== "SENT");
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-bold text-ink">Your requests</h3>
        {asked.length === 0 ? (
          <Empty>{family.youArePrimary ? "You haven't asked us to invite anybody." : "Only the account holder can ask us to invite somebody."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className={HEAD}>
                  <th scope="col" className="py-3 pr-4 pl-3">Person</th>
                  <th scope="col" className="px-4 py-3">Relationship</th>
                  <th scope="col" className="px-4 py-3">Asked</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="py-3 pr-3 pl-4"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {asked.map((one) => (
                  <tr key={one.id}>
                    <td className="px-3 py-2.5">
                      <span className="block font-semibold text-ink">{one.fullName}</span>
                      <span className="block text-xs text-ink-muted">{one.email}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{one.relationship}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{when(one.askedAt)}</td>
                    <td className="px-3 py-2.5">
                      {askStatus(one)}
                      {one.reason && <span className="mt-1 block max-w-64 text-xs text-ink-muted">{one.reason}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {one.status === "ASKED" && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onWithdraw(one.id)}>
                          Withdraw
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-ink">Invitations sent</h3>
        {family.asked.length === 0 ? (
          <Empty>No invitations are out.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className={HEAD}>
                  <th scope="col" className="py-3 pr-4 pl-3">Email</th>
                  <th scope="col" className="px-4 py-3">Relationship</th>
                  <th scope="col" className="px-4 py-3">Invited</th>
                  <th scope="col" className="py-3 pr-3 pl-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {family.asked.map((one) => (
                  <tr key={one.id}>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <Mail aria-hidden="true" className="size-4 text-ink-muted" />
                        {one.email}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{one.relationship}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{when(one.invitedAt)}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={/invited|waiting/i.test(one.status) ? "waiting" : /joined|accepted/i.test(one.status) ? "live" : "ended"}>{one.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function FamilyAccessPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((one) => one.id === params.get("tab")) ? (params.get("tab") as TabId) : "members";
  const [dialog, setDialog] = useState<"grant" | "share" | "invite" | null>(null);

  const family = useFamily<MyFamily, ApiError>();
  const permissions = usePermissions<MyPermissions, ApiError>();
  const wealth = useWealthGrants<WealthGrant[], ApiError>();
  const asks = useMyInviteAsks<InviteAsk[], ApiError>();
  const accounts = useAccounts<AccountRow[], ApiError>();

  const refresh = () => {
    for (const queryKey of [getPermissionsQueryKey(), getWealthGrantsQueryKey(), getFamilyQueryKey(), getFamilyWealthQueryKey(), getAccountsQueryKey(), getMyInviteAsksQueryKey()]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
  const revoke = useRevoke<ApiError>({ mutation: { onSuccess: refresh } });
  const relinquish = useRelinquish<ApiError>({ mutation: { onSuccess: refresh } });
  const stop = useStopSharingWealth<ApiError>({ mutation: { onSuccess: refresh } });
  const giveBack = useGiveBackWealth<ApiError>({ mutation: { onSuccess: refresh } });
  const withdraw = useWithdrawInviteAsk<ApiError>({ mutation: { onSuccess: refresh } });

  const people = family.data?.people ?? [];
  const person = (id: string) => people.find((one) => one.id === id);
  const grants = wealth.data ?? [];
  const accountLine = (one: GrantRow, given: boolean): Line => ({
    key: one.id,
    who: one.theirName,
    photo: one.theirPhoto,
    what: `${one.bankName} ${accountKind(one.accountType)}`,
    detail: `•••• ${one.lastFour}`,
    since: one.grantedAt,
    until: one.expiresOn,
    live: one.live,
    ended: one.endedHow ? (ENDED[one.endedHow] ?? "Ended") : one.endedAt ? "Ended" : "Expired",
    action: given
      ? { label: "Revoke", run: () => revoke.mutate({ id: one.id }), busy: revoke.isPending }
      : { label: "Give back", run: () => relinquish.mutate({ id: one.id }), busy: relinquish.isPending },
  });
  const wealthLine = (one: WealthGrant, given: boolean): Line => {
    const them = person(given ? one.granteeId : one.ownerId);
    return {
      key: `wealth-${one.id}`,
      who: them?.fullName ?? "A family member",
      photo: them?.photo ?? null,
      what: "Wealth",
      detail: "Portfolio, owned assets and loans",
      since: one.grantedAt,
      until: one.expiresOn,
      live: true,
      ended: null,
      action: given
        ? { label: "Stop sharing", run: () => stop.mutate({ id: one.id }), busy: stop.isPending }
        : { label: "Give back", run: () => giveBack.mutate({ id: one.id }), busy: giveBack.isPending },
    };
  };
  const byLiveThenNewest = (a: Line, b: Line) => Number(b.live) - Number(a.live) || b.since.localeCompare(a.since);
  const given = [...grants.filter((one) => one.mine).map((one) => wealthLine(one, true)), ...(permissions.data?.given ?? []).map((one) => accountLine(one, true))].sort(byLiveThenNewest);
  const held = [...grants.filter((one) => !one.mine).map((one) => wealthLine(one, false)), ...(permissions.data?.held ?? []).map((one) => accountLine(one, false))].sort(byLiveThenNewest);
  const waiting = (asks.data ?? []).filter((one) => one.status === "ASKED").length + (family.data?.asked ?? []).filter((one) => /invited/i.test(one.status)).length;
  const counts: Record<TabId, number> = {
    members: people.length,
    given: given.filter((one) => one.live).length,
    held: held.filter((one) => one.live).length,
    invitations: waiting,
  };
  const failed = family.isError || permissions.isError || wealth.isError || asks.isError;
  const error = revoke.error ?? relinquish.error ?? stop.error ?? giveBack.error ?? withdraw.error;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Family &amp; Access</h1>
          <p className="mt-1 text-sm text-ink-muted">Your family, who can see what, and who has been invited.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialog("grant")} disabled={!accounts.data}>
            <KeyRound aria-hidden="true" />
            Grant account access
          </Button>
          <Button variant="secondary" onClick={() => setDialog("share")} disabled={!family.data}>
            <Share2 aria-hidden="true" />
            Share my wealth
          </Button>
          {family.data?.youArePrimary && (
            <Button onClick={() => setDialog("invite")}>
              <UserPlus aria-hidden="true" />
              Invite a family member
            </Button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Family and access" className="flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() =>
              setParams(
                (was) => {
                  const next = new URLSearchParams(was);
                  next.set("tab", one.id);
                  return next;
                },
                { replace: true },
              )
            }
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap ${
              tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {one.label} ({counts[one.id]})
          </button>
        ))}
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {failed ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">Your family could not be loaded. Refresh the page to try again.</p>
      ) : !family.data || !permissions.data || !wealth.data || !asks.data ? (
        <div className="h-60 animate-pulse rounded-2xl bg-white/60" />
      ) : tab === "members" ? (
        <Members people={people} wealth={grants} />
      ) : (
        <section className="rounded-2xl border border-line bg-white p-5">
          {tab === "given" && <Lines lines={given} whoHead="Shared with" empty="You haven't shared anything with your family." />}
          {tab === "held" && <Lines lines={held} whoHead="Shared by" empty="Nobody has shared anything with you yet." />}
          {tab === "invitations" && <Invitations family={family.data} asks={asks.data} onWithdraw={(id) => withdraw.mutate({ id })} busy={withdraw.isPending} />}
        </section>
      )}

      {dialog === "grant" && <GrantDialog own={(accounts.data ?? []).filter((one) => one.mine)} onClose={() => setDialog(null)} />}
      {dialog === "share" && <ShareDialog people={people} onClose={() => setDialog(null)} />}
      {dialog === "invite" && <InviteDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
