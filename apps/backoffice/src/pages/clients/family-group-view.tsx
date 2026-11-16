import { ApiError } from "@atomprive/api-client";
import { useRenameFamily, type FamilyGroupSummary, type FamilyMember } from "@atomprive/api-client/backoffice";
import { Avatar, Badge, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Layers, Link2, Maximize2, Minimize2, PencilLine, UsersRound, Network, Rows3, X } from "lucide-react";
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
      <div className="min-w-0 flex-1">{children}</div>
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
    const save = () => rename.mutate({ id: clientId, data: { name: typed.trim() || null } });
    const cancel = () => { setTyped(name); setEditing(false); };
    const icon = "grid size-8 shrink-0 place-items-center rounded-lg border [&_svg]:size-4 disabled:opacity-50";
    return (
      <span className="block">
        <span className="flex items-center gap-1.5">
          <TextInput id="family-name" aria-label="What the firm calls this family" className="h-8 min-w-0 flex-1" value={typed} maxLength={120}
            autoFocus onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") cancel(); }} />
          <button type="button" aria-label="Save the name" title="Save (Enter)" disabled={rename.isPending} onClick={save}
            className={cn(icon, "border-primary-600 bg-primary-600 text-on-accent hover:bg-primary-700")}>
            <Check aria-hidden="true" />
          </button>
          <button type="button" aria-label="Cancel renaming" title="Cancel (Esc)" disabled={rename.isPending} onClick={cancel}
            className={cn(icon, "border-line text-ink-muted hover:text-ink")}>
            <X aria-hidden="true" />
          </button>
        </span>
        {rename.error && <span className="mt-1 block text-xs text-red-600">{rename.error.message}</span>}
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

/** Where a relative sits against the person they hang off: beside them, a row up, or a row down. */
type Tie = "SPOUSE" | "SIBLING" | "PARENT" | "BELOW";

function tieOf(member: FamilyMember, labelFor: (code: string | null | undefined) => string): Tie {
  const said = `${member.relationship ?? ""} ${labelFor(member.relationship)}`.toLowerCase();
  if (/spouse|wife|husband|partner/.test(said)) return "SPOUSE";
  if (/sibling|brother|sister/.test(said)) return "SIBLING";
  if (/parent|father|mother/.test(said)) return "PARENT";
  return "BELOW";
}

const CARD_WIDTH = 240;
const CARD_GAP = 80;
const ROW_GAP = 96;
const BRACKET = 22;

type Placed = { member: FamilyMember; x: number; generation: number };
type Edge = { from: string; to: string; tie: Tie | "JOINT"; label: string };
type Line = { key: string; path: string; tie: Edge["tie"]; label: string; lx: number; ly: number };

/**
 * Lays the family out a generation to a row: the holders on the first, a spouse or sibling beside the person they
 * belong to, a parent a row up and a child a row down under them, every line between two people named for what
 * joins them. A sibling stands on the side away from the holder and takes their own spouse further out still, so
 * nobody's line runs through somebody else.
 */
function layout(roots: Branch[], labelFor: (code: string | null | undefined) => string) {
  const beside = (branch: Branch) => !branch.member.accountHolder && ["SPOUSE", "SIBLING"].includes(tieOf(branch.member, labelFor));
  // Left to right, a person with everybody who stands in their row with them; side says which way the row grows.
  const row = (branch: Branch, side: -1 | 0 | 1): Branch[] => {
    const spouses = branch.children.filter((one) => beside(one) && tieOf(one.member, labelFor) === "SPOUSE");
    const siblings = branch.children.filter((one) => beside(one) && tieOf(one.member, labelFor) === "SIBLING");
    if (side === 0) {
      return [...[...siblings].reverse().flatMap((one) => row(one, -1)), branch, ...spouses.flatMap((one) => row(one, 1))];
    }
    const out = [...spouses, ...siblings];
    return side < 0 ? [...[...out].reverse().flatMap((one) => row(one, -1)), branch] : [branch, ...out.flatMap((one) => row(one, 1))];
  };
  const placed = new Map<string, Placed>();
  const ends = new Map<number, number>();
  const edges: Edge[] = [];
  type Waiting = { generation: number; under: Placed; branch: Branch };
  let waiting: Waiting[] = [];
  const put = (units: Branch[], generation: number, start: number) => {
    units.forEach((unit, at) => {
      const spot = { member: unit.member, x: start + at * (CARD_WIDTH + CARD_GAP), generation };
      placed.set(unit.member.id, spot);
      ends.set(generation, Math.max(ends.get(generation) ?? -Infinity, spot.x + CARD_WIDTH));
      unit.children.forEach((child) => {
        const tie = tieOf(child.member, labelFor);
        const label = tie === "SPOUSE" ? "married" : labelFor(child.member.relationship).toLowerCase() || "relative";
        edges.push({ from: unit.member.id, to: child.member.id, tie, label });
        if (!beside(child)) waiting.push({ generation: generation + (tie === "PARENT" ? -1 : 1), under: spot, branch: child });
      });
    });
  };
  let x = 0;
  roots.forEach((root, at) => {
    const units = row(root, 0);
    put(units, 0, x);
    x += units.length * (CARD_WIDTH + CARD_GAP);
    if (at > 0) edges.push({ from: roots[at - 1]!.member.id, to: root.member.id, tie: "JOINT", label: "joint holder" });
  });
  while (waiting.length > 0) {
    const wave = waiting;
    waiting = [];
    const byRow = new Map<number, Waiting[]>();
    wave.forEach((one) => byRow.set(one.generation, [...(byRow.get(one.generation) ?? []), one]));
    [...byRow.entries()].sort(([a], [b]) => Math.abs(a) - Math.abs(b)).forEach(([generation, groups]) => {
      // Each family group centred under (or over) its person, then nudged right only as far as the one before needs.
      const wanted = groups.map((one) => {
        const units = row(one.branch, 0);
        const width = units.length * (CARD_WIDTH + CARD_GAP) - CARD_GAP;
        return { units, start: one.under.x + CARD_WIDTH / 2 - width / 2, width };
      }).sort((a, b) => a.start - b.start);
      let free = (ends.get(generation) ?? -Infinity) + CARD_GAP;
      wanted.forEach((one) => {
        const start = Math.max(one.start, free);
        put(one.units, generation, start);
        free = start + one.width + CARD_GAP;
      });
    });
  }
  return { placed: [...placed.values()], edges };
}

/**
 * The family as a tree, a generation to a row. Every line says what joins the two people at its ends — married,
 * sibling, child — and every badge whose relative they are, so nobody has to guess who belongs to whom.
 */
export function FamilyTree({ roots, currency, valueOf, openTheir, clientId }: {
  roots: Branch[];
  currency: string | null;
  valueOf: (id: string) => number | null;
  openTheir: (id: string) => string;
  clientId: string;
}) {
  const { labelFor } = useRelationshipTypes();
  const { placed, edges } = layout(roots, labelFor);
  if (placed.length === 0) return null;
  const height = currency ? 124 : 80;
  const left = Math.min(...placed.map((one) => one.x));
  const top = Math.min(...placed.map((one) => one.generation));
  const at = new Map(placed.map((one) => [one.member.id, {
    ...one, x: one.x - left, y: BRACKET + (one.generation - top) * (height + ROW_GAP),
  }]));
  const width = Math.max(...[...at.values()].map((one) => one.x + CARD_WIDTH));
  const depth = Math.max(...[...at.values()].map((one) => one.y + height));
  const lines = edges.flatMap((edge): Line[] => {
    const a = at.get(edge.from);
    const b = at.get(edge.to);
    if (!a || !b) return [];
    const mid = (one: { x: number }) => one.x + CARD_WIDTH / 2;
    if (edge.tie === "SPOUSE" || edge.tie === "JOINT") {
      const [l, r] = a.x < b.x ? [a, b] : [b, a];
      const y = l.y + height / 2;
      return [{ key: edge.to, path: `M ${l.x + CARD_WIDTH} ${y} H ${r.x}`, tie: edge.tie, label: edge.label, lx: (l.x + CARD_WIDTH + r.x) / 2, ly: y }];
    }
    if (edge.tie === "SIBLING") {
      const y = a.y - BRACKET + 4;
      return [{ key: edge.to, path: `M ${mid(a)} ${a.y} V ${y} H ${mid(b)} V ${b.y}`, tie: edge.tie, label: edge.label, lx: (mid(a) + mid(b)) / 2, ly: y }];
    }
    const [up, down] = edge.tie === "PARENT" ? [b, a] : [a, b];
    const bend = up.y + height + ROW_GAP / 2;
    return [{ key: edge.to, path: `M ${mid(up)} ${up.y + height} V ${bend} H ${mid(down)} V ${down.y}`, tie: edge.tie, label: edge.label,
      lx: mid(down), ly: (bend + down.y) / 2 }];
  });
  const STROKES: Record<string, string> = {
    SPOUSE: "stroke-violet-400", JOINT: "stroke-primary-400", SIBLING: "stroke-teal-400", PARENT: "stroke-slate-400", BELOW: "stroke-amber-400",
  };
  return (
    <div className="overflow-x-auto py-4">
      <div className="relative mx-auto" style={{ width, height: depth }}>
        <svg aria-hidden="true" className="absolute inset-0 overflow-visible" width={width} height={depth}>
          {lines.map((line) => (
            <path key={line.key} d={line.path} fill="none" strokeWidth={2} className={STROKES[line.tie]}
              strokeDasharray={line.tie === "SPOUSE" ? "6 4" : undefined} />
          ))}
        </svg>
        {lines.map((line) => (
          <span key={line.key} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-white px-2 py-0.5 text-2xs font-semibold whitespace-nowrap text-ink-muted"
            style={{ left: line.lx, top: line.ly }}>
            {line.label}
          </span>
        ))}
        {[...at.values()].map((one) => (
          <div key={one.member.id} className="absolute" style={{ left: one.x, top: one.y, width: CARD_WIDTH, height }}>
            <Node member={one.member} role={roleOf(one.member, labelFor)} value={currency ? amount(currency, valueOf(one.member.id)) : null}
              to={one.member.id === clientId ? null : openTheir(one.member.id)} />
          </div>
        ))}
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
  const box = cn("block h-full w-60 rounded-2xl border px-4 py-3.5 text-left shadow-sm", TONES[tone]);
  return to ? (
    <Link to={to} className={cn(box, "transition hover:shadow-md")}>{inside}</Link>
  ) : (
    <div className={box}>{inside}</div>
  );
}
