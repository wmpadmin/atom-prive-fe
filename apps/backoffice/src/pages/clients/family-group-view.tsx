import { ApiError } from "@atomprive/api-client";
import { useRenameFamily, type FamilyGroupSummary, type FamilyMember } from "@atomprive/api-client/backoffice";
import { Avatar, Badge, Button, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Link2, Maximize2, Minimize2, PencilLine, UsersRound, Network, Rows3 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useRelationshipTypes } from "../../lib/relationship-types";
import { amount, roleOf, useFamilyValues } from "./family-values";
import type { Branch } from "./family-tree";

/** The four facts across the top: the group, how many are in it, what it is worth, and who is linked. */
export function FamilyTiles({ clientId, group, family, mayEdit }: {
  clientId: string;
  group: FamilyGroupSummary | null;
  family: FamilyMember[];
  mayEdit: boolean;
}) {
  const { sees, wealth } = useFamilyValues(clientId);
  const holder = group?.primaryHolderName ?? family.find((one) => one.primaryHolder)?.fullName ?? null;
  const twr = wealth?.twrYearToDate ?? null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile icon={<UsersRound />}>
        <FamilyName clientId={clientId} name={group?.name ?? "Family group"} mayEdit={mayEdit && group !== null} />
        {holder && <p className="truncate text-sm text-ink-muted">Primary holder: {holder}</p>}
      </Tile>
      <Tile icon={<UsersRound />}>
        <p className="text-2xl font-bold tabular-nums">{group?.members ?? family.length}</p>
        <p className="text-sm text-ink-muted">
          Family members{group && group.invited > 0 ? ` · ${group.invited} invited` : ""}
        </p>
      </Tile>
      <Tile icon={<Layers />}>
        {sees && wealth ? (
          <>
            <p className="text-2xl font-bold whitespace-nowrap tabular-nums">{amount(wealth.currency, wealth.managed)}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              Family wealth
              {twr !== null && (
                <Badge tone={twr < 0 ? "danger" : "success"}>{`${twr < 0 ? "▼" : "▲"} ${twr > 0 ? "+" : ""}${twr.toFixed(1)}% YTD`}</Badge>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-ink-muted">{sees ? "Adding up…" : "Not shown to you"}</p>
            <p className="text-sm text-ink-muted">Family wealth</p>
          </>
        )}
      </Tile>
      <Tile icon={<Link2 />}>
        <p className="text-2xl font-bold tabular-nums">{Math.max(0, family.length - 1)}</p>
        <p className="text-sm text-ink-muted">Linked clients</p>
      </Tile>
    </div>
  );
}

function Tile({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4">
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700 [&_svg]:size-6">
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The group's name, renamed in place by whoever looks after the family. Empty puts the worked-out name back. */
function FamilyName({ clientId, name, mayEdit }: { clientId: string; name: string; mayEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState(name);
  const queryClient = useQueryClient();
  const rename = useRenameFamily<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries();
        setEditing(false);
      },
    },
  });
  if (editing) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <TextInput id="family-name" aria-label="What the firm calls this family" className="h-8 w-44" value={typed} maxLength={120}
          onChange={(event) => setTyped(event.target.value)} />
        <Button size="sm" disabled={rename.isPending} onClick={() => rename.mutate({ id: clientId, data: { name: typed.trim() || null } })}>
          {rename.isPending ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" size="sm" disabled={rename.isPending} onClick={() => { setTyped(name); setEditing(false); }}>Cancel</Button>
        {rename.error && <span className="w-full text-xs text-red-600">{rename.error.message}</span>}
      </span>
    );
  }
  return (
    <p className="flex items-center gap-2 text-lg font-bold">
      <span className="truncate">{name}</span>
      {mayEdit && (
        <button type="button" aria-label="Rename this family group" onClick={() => setEditing(true)} className="text-ink-muted hover:text-primary-700">
          <PencilLine aria-hidden="true" className="size-4" />
        </button>
      )}
    </p>
  );
}

/** The structure card: the tree or the indented list, and a way to open it across the whole screen. */
export function FamilyStructure({ tree, list }: { tree: ReactNode; list: ReactNode }) {
  const [view, setView] = useState<"tree" | "list">("tree");
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const away = (event: KeyboardEvent) => event.key === "Escape" && setFull(false);
    window.addEventListener("keydown", away);
    return () => window.removeEventListener("keydown", away);
  }, [full]);
  const body = (
    <section aria-labelledby="family-structure" className={cn("rounded-2xl border border-line bg-white", full && "flex h-full flex-col")}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h2 id="family-structure" className="text-base font-bold">Family structure</h2>
        <div className="flex items-center gap-2">
          <span className="flex rounded-lg border border-line bg-white p-0.5 text-sm font-semibold">
            {([["tree", "Family tree", <Network key="t" />], ["list", "List view", <Rows3 key="l" />]] as const).map(([which, label, icon]) => (
              <button key={which} type="button" aria-pressed={view === which} onClick={() => setView(which)}
                className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 [&_svg]:size-4",
                  view === which ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-muted hover:text-ink")}>
                {icon}
                {label}
              </button>
            ))}
          </span>
          <button type="button" aria-label={full ? "Close the full screen" : "Open across the whole screen"} title={full ? "Close (Esc)" : "Full screen"}
            onClick={() => setFull((was) => !was)}
            className="grid size-9 place-items-center rounded-lg border border-line text-ink-muted hover:text-ink [&_svg]:size-4">
            {full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className={cn("overflow-auto px-6 pb-6", full && "min-h-0 flex-1")}>{view === "tree" ? tree : list}</div>
    </section>
  );
  if (!full) return body;
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 p-6" onClick={() => setFull(false)}>
      <div className="h-full" onClick={(event) => event.stopPropagation()}>{body}</div>
    </div>
  );
}

const TONES: Record<string, string> = {
  holder: "border-primary-200 bg-primary-50/70",
  spouse: "border-violet-500/30 bg-violet-500/10",
  child: "border-amber-200 bg-amber-50/60",
  other: "border-teal-500/30 bg-teal-500/10",
};
const BADGES: Record<string, string> = {
  holder: "bg-primary-600 text-white",
  spouse: "bg-violet-500/15 text-violet-500",
  child: "bg-amber-100 text-amber-800",
  other: "bg-teal-500/15 text-teal-500",
};

function toneFor(member: FamilyMember) {
  if (member.primaryHolder || member.accountHolder) return "holder";
  const said = `${member.relationship ?? ""} ${member.relationshipToPrimary ?? ""}`.toLowerCase();
  if (said.includes("spouse") || said.includes("wife") || said.includes("husband") || said.includes("partner")) return "spouse";
  if (said.includes("child") || said.includes("son") || said.includes("daughter")) return "child";
  return "other";
}

function isSpouse(member: FamilyMember) {
  return !member.accountHolder && toneFor(member) === "spouse";
}

/**
 * The family as a tree: the holders along the top, the people under each beneath them on a connecting line, and a
 * spouse drawn beside the person they are married to with a link between them rather than a tier below.
 */
export function FamilyTree({ roots, currency, valueOf, openTheir, clientId }: {
  roots: Branch[];
  currency: string | null;
  valueOf: (id: string) => number | null;
  openTheir: (id: string) => string;
  clientId: string;
}) {
  const { labelFor } = useRelationshipTypes();
  const node = (member: FamilyMember) => (
    <Node member={member} role={roleOf(member, labelFor)} value={currency ? amount(currency, valueOf(member.id)) : null}
      to={member.id === clientId ? null : openTheir(member.id)} />
  );
  // A spouse stands beside their partner; everybody else goes a tier down.
  const level = (branches: Branch[]): ReactNode => (
    <ul className="flex items-start justify-center gap-6">
      {branches.map((branch) => {
        const partners = branch.children.filter((one) => isSpouse(one.member));
        const below = [...branch.children.filter((one) => !isSpouse(one.member)), ...partners.flatMap((one) => one.children)];
        return (
          <li key={branch.member.id} className="flex flex-col items-center">
            <div className="flex items-center">
              {node(branch.member)}
              {partners.map((partner) => (
                <span key={partner.member.id} className="flex items-center">
                  <span aria-hidden="true" className="h-px w-5 bg-primary-300" />
                  <span title="Married" className="grid size-8 place-items-center rounded-full border border-primary-300 bg-white text-primary-600 [&_svg]:size-4">
                    <Link2 aria-hidden="true" />
                  </span>
                  <span aria-hidden="true" className="h-px w-5 bg-primary-300" />
                  {node(partner.member)}
                </span>
              ))}
            </div>
            {below.length > 0 && (
              <>
                <span aria-hidden="true" className="h-6 w-px bg-primary-300" />
                <ul className="flex items-start justify-center">
                  {below.map((child, at) => (
                    <li key={child.member.id} className="relative flex flex-col items-center px-3 pt-6">
                      {/* Each child draws its half of the line along the top, so the line ends over the first and last. */}
                      {at > 0 && <span aria-hidden="true" className="absolute top-0 right-1/2 left-0 h-px bg-primary-300" />}
                      {at < below.length - 1 && <span aria-hidden="true" className="absolute top-0 right-0 left-1/2 h-px bg-primary-300" />}
                      <span aria-hidden="true" className="absolute top-0 left-1/2 h-6 w-px bg-primary-300" />
                      {level([child])}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="overflow-x-auto py-4">
      <div className="mx-auto w-max">
        {roots.length > 1 ? (
          // Joint holders are peers: drawn side by side and linked, the families under each beneath them.
          <div className="flex items-start gap-6">{roots.map((root) => <div key={root.member.id}>{level([root])}</div>)}</div>
        ) : level(roots)}
      </div>
    </div>
  );
}

function Node({ member, role, value, to }: { member: FamilyMember; role: string; value: string | null; to: string | null }) {
  const tone = toneFor(member);
  const inside = (
    <>
      <span className="flex items-center gap-3">
        <Avatar name={member.fullName} photo={member.photo} className="size-11 text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-base font-bold">{member.fullName}</span>
          <span className={cn("mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold", BADGES[tone])}>{role}</span>
        </span>
      </span>
      {value !== null && (
        <span className="mt-3 block border-t border-black/5 pt-2.5 text-sm">
          Portfolio: <span className="font-bold tabular-nums">{value}</span>
        </span>
      )}
    </>
  );
  const box = cn("block w-60 rounded-2xl border px-4 py-3.5 text-left shadow-sm", TONES[tone]);
  return to ? (
    <Link to={to} className={cn(box, "transition hover:shadow-md")}>{inside}</Link>
  ) : (
    <div className={box}>{inside}</div>
  );
}
