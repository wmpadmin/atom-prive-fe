import { ApiError } from "@atomprive/api-client";
import {
  useGetClientStructure,
  type ClientStructure,
  type StructureFileAccount,
  type StructureNode,
  type StructureOfficer,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { FileText } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { INK } from "../portfolios/asset-classes";
import { CardMenu, CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta, type ViewLayoutState } from "../layout/custom-view";
import { FIGURE_KINDS, FigureRow, FigureStrip, useFigureRow } from "../layout/figure-strip";
import { useCardLabel } from "../layout/card-settings";
import { cardChart, KindChart, type CardChart } from "../layout/chart-kinds";
import { seriesFigure, sharesFigure, type Figures } from "../layout/own-cards";
import { useDrill } from "./drill-panel";

/**
 * A client's Entity & Ownership Structure, laid out the way the firm's own design draws it: the entities their wealth
 * sits in and what each is worth on a look-through basis, the register, who benefits from what, how each is invested,
 * and the dates and papers that govern them.
 *
 * <p>Read only: nothing here adds or changes an entity. Every value is the server's, rolled up from the holdings linked
 * to each entity. A client whose figures come only from their bank's files has no entity on file; their accounts are
 * shown as the only containers, with their holdings as the bank sent them.
 */
export function ClientStructurePage() {
  const { customerId = "" } = useParams();
  const structure = useGetClientStructure<ClientStructure, ApiError>(customerId);
  const data = structure.data;
  const view = useViewLayout("workspace.structure", CARDS, DEFAULT_CARDS);

  if (structure.isError) return <Alert tone="danger">{structure.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the structure…</p>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Entity Structure
          </p>
          <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Entity &amp; Ownership Structure</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Trusts, companies and SPVs with ownership, look-through value and beneficial interest
          </p>
        </div>
        {!data.bankFile && <CustomizeButton view={view} />}
      </header>

      {data.bankFile ? <FileContainers name={data.name} accounts={data.bankFile} data={data} /> : <Structure data={data} view={view} />}

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {data.bankFile ? "Values in the bank's own currencies, unconverted" : `Values in ${data.currency} unless stated`}; market data as of {formatDate(data.asOf)} close.
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

type StructureCard = "kpis" | "ownership" | "register" | "interest" | "mix" | "governance";

/** The screen's cards, in the firm's order: every card on by default. */
const CARDS: Record<StructureCard, LayoutMeta> = {
  kpis: { title: "Key figures", charts: [...FIGURE_KINDS], group: "Summary", wide: true },
  ownership: { title: "Ownership Structure", group: "Structure", wide: true },
  register: { title: "Entity Register", group: "Structure", wide: true },
  interest: { title: "Beneficial Interest Matrix", group: "Beneficiaries", charts: ["heatmap", "stacked-bar", "grouped-bar", "donut"] },
  mix: { title: "Asset Mix by Entity", group: "Structure", charts: ["stacked-bar", "grouped-bar", "heatmap", "table"] },
  governance: { title: "Governance Calendar & Documents", group: "Governance", wide: true },
};

// The four that matter most open the screen; every other card waits in Add cards. A layout someone saved is kept.
const DEFAULT_CARDS: StructureCard[] = ["kpis", "ownership", "register", "mix"];

function Structure({ data, view }: { data: ClientStructure; view: ViewLayoutState<StructureCard> }) {
  return (
    <LayoutGrid view={view} screen="Entity Structure" figures={data.bankFile ? undefined : structureFigures(data)} render={{
      kpis: <Kpis data={data} />,
      ownership: <OwnershipCard data={data} />,
      register: <RegisterCard data={data} />,
      interest: <InterestCard data={data} chart={cardChart(view, "interest")} />,
      mix: <MixCard data={data} chart={cardChart(view, "mix")} />,
      governance: <GovernanceCard data={data} />,
    }} />
  );
}

/** The figures across the top: entities, jurisdictions, beneficiaries, officers and what is due. */
function Kpis({ data }: { data: ClientStructure }) {
  const { kpis } = data;
  return (
    <>
      <FigureStrip className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        <Kpi label="Legal entities" value={String(kpis.legalEntities)}
          note={kpis.byType.map((one) => `${one.count} ${one.name}${one.count === 1 || one.name.endsWith("C") || one.name.endsWith("V") ? "" : "s"}`).join(" · ") || "None on file"} />
        <Kpi label="Jurisdictions" value={kpis.jurisdictions.length === 0 ? "—" : kpis.jurisdictions.join(" · ")}
          note={data.jurisdictionNote ?? `${kpis.jurisdictions.length} ${kpis.jurisdictions.length === 1 ? "jurisdiction" : "jurisdictions"}`} />
        <Kpi label="Beneficiaries" value={`${kpis.beneficiaries - kpis.charities} ${kpis.beneficiaries - kpis.charities === 1 ? "individual" : "individuals"}`}
          note={`${kpis.generations} ${kpis.generations === 1 ? "generation" : "generations"}${kpis.charities > 0 ? ` + ${kpis.charities} ${kpis.charities === 1 ? "charity" : "charities"}` : ""}`} />
        <Kpi label="Trustees & directors" value={String(kpis.trusteesAndDirectors)}
          note={`${kpis.corporateTrustees} corporate ${kpis.corporateTrustees === 1 ? "trustee" : "trustees"} · ${kpis.directors} ${kpis.directors === 1 ? "director" : "directors"}`} />
        <Kpi label="KYC / CRS refresh due" value={String(kpis.refreshDue.length)}
          tone={kpis.refreshDue.length > 0 ? "text-amber-700" : undefined}
          note={
            <>
              {kpis.refreshDue.map((one) => `${one.entity ?? "Client"} ${shortDate(one.dueOn)}`).join(" · ") || "Nothing due"}
            </>
          } />
      </FigureStrip>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Ownership                                                                                                     */

type Show = "value" | "owned" | "tax";

function OwnershipCard({ data }: { data: ClientStructure }) {
  const [view, setView] = useState<"tree" | "table">("tree");
  const [show, setShow] = useState<Show>("value");
  const cur = data.currency;
  return (
    <Card title="Ownership Structure" lead="Settlors → trusts & personal holdings → companies, SPVs and accounts"
      action={
        <div className="flex flex-wrap gap-2">
          <Toggle label="Shown as" value={view} onChange={setView} options={[["tree", "Tree"], ["table", "Table"]]} />
          <Toggle label="Each entity shows" value={show} onChange={setShow}
            options={[["value", "Value"], ["owned", "Ownership %"], ["tax", "Tax status"]]} />
        </div>
      }>
      {data.entities.length === 0 && !data.unassigned ? <Empty>No entity is on file for this client yet.</Empty> : view === "tree" ? (
        // Fits the card where it can; a tree too wide for it scrolls inside the card, with its scrollbar always shown,
        // rather than running off the right edge.
        <div className="overflow-x-scroll pb-2 [scrollbar-width:thin]">
          {/* Three columns across the card's full width — settlors ~22%, top-level owners ~30%, subsidiaries ~40%,
              the rest connectors — with a floor below which the tree scrolls inside the card instead of squeezing. */}
          <div className="flex w-full min-w-[60rem] items-center">
            <div className="w-[22%] shrink-0 rounded-xl border-2 border-ink p-3">
              <p className="text-3xs font-semibold tracking-wider text-red-700 uppercase">Settlors{data.settlors.length > 0 && " · G1"}</p>
              <p className="text-base font-bold break-words">{data.settlors.length > 0 ? settlorNames(data.settlors) : data.name}</p>
              <p className="text-2xs text-ink-muted">Consolidated net worth</p>
              <p className="text-lg font-bold tabular-nums">{data.netWorth == null ? "—" : compact(data.netWorth, cur)}</p>
            </div>
            <Branches gap="lg" items={[
              ...data.entities.map((one) => (
                <div key={one.id} className="flex flex-1 items-center">
                  <TopBox node={one} show={show} currency={cur} />
                  {(one.children.length > 0 || one.direct > 0) && (
                    <Branches gap="sm" items={[
                      ...one.children.map((child) => <ChildBox key={child.id} node={child} show={show} currency={cur} />),
                      ...((one.children.length === 0 || one.direct > 0) ? [(
                        <NodeRow key="direct" className="rounded-lg border border-line"
                          name={<p className="line-clamp-2 text-sm font-semibold break-words">{one.children.length === 0 ? "Accounts and holdings" : "Held directly"}</p>}
                          // Not an entity: what the parent holds in its own name. It has no ownership share or tax
                          // status of its own, so those views say so rather than repeat its value.
                          line={show === "tax" ? `Taxed with ${one.name}` : one.custodians.join(" · ") || "No account linked"}
                          figure={show === "value" ? compact(one.direct, cur) : show === "owned" ? "Direct" : ""}
                          figureTone={show === "value" ? undefined : "font-medium text-ink-muted"} />
                      )] : []),
                    ]} />
                  )}
                </div>
              )),
              ...(data.unassigned ? [(
                <NodeRow key="unassigned" className="w-[42%] shrink-0 rounded-xl border border-dashed border-line"
                  name={<p className="line-clamp-2 text-sm font-semibold break-words">Not assigned to an entity</p>}
                  line="Holdings no entity has been linked to" figure={compact(data.unassigned.value, cur)} />
              )] : []),
            ]} />
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border-2 border-ink" aria-hidden="true" />Settlors</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-primary-50 ring-1 ring-primary-200" aria-hidden="true" />Top-level owner</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-line" aria-hidden="true" />Subsidiary / holding</li>
            <li>Values are look-through market values, {cur}</li>
          </ul>
        </div>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Entity</th>
                <th scope="col" className="px-3 py-2">Type</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right">{show === "value" ? "Value" : show === "owned" ? "Owned %" : "Tax status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.register.map((one) => (
                <tr key={one.id}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-medium" style={{ paddingLeft: `${1.25 + one.depth * 1.25}rem` }}>{one.name}</th>
                  <td className="px-3 py-2 text-ink-soft">{typeName(one.type)}</td>
                  <td className="py-2 pr-5 pl-3 text-right tabular-nums">{figure(one, show, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * A parent's children, joined to it by connectors drawn per row: a stub from the trunk to each box at its
 * mid-height, and the trunk itself running only between the first and last child's mid-heights, so no line runs
 * past a box above or below it.
 */
function Branches({ items, gap }: { items: ReactNode[]; gap: "sm" | "lg" }) {
  const half = gap === "lg" ? "0.625rem" : "0.25rem";
  const many = items.length > 1;
  return (
    <div className={cn("relative flex flex-1 flex-col", gap === "lg" ? "gap-5" : "gap-2")}>
      {/* From the parent to the trunk, level with the parent, which sits at the middle of its children. */}
      {many && <span className="absolute top-1/2 left-0 h-px w-5 bg-line" aria-hidden="true" />}
      {items.map((item, at) => (
        <div key={at} className="relative flex items-center pl-10">
          {many && (
            <span className="absolute left-5 w-px bg-line" aria-hidden="true"
              style={{ top: at === 0 ? "50%" : `-${half}`, bottom: at === items.length - 1 ? "50%" : `-${half}` }} />
          )}
          {/* To the box, at its mid-height; with one child, straight across from the parent. */}
          <span className={cn("absolute top-1/2 h-px bg-line", many ? "left-5 w-5" : "left-0 w-10")} aria-hidden="true" />
          {item}
        </div>
      ))}
    </div>
  );
}

/** What a box says on its right: its value, how much of it its parent owns, or its tax status. */
function figure(node: Pick<StructureNode, "value" | "ownedPercent" | "taxClassification">, show: Show, currency: string): string {
  if (show === "owned") return node.ownedPercent == null ? "—" : `${node.ownedPercent}%`;
  if (show === "tax") return node.taxClassification ?? "—";
  return compact(node.value, currency);
}

/** A tax status longer than this would squeeze the name beside it, so it takes the line under the name instead. */
const SHORT_FIGURE = 14;

/**
 * One box's contents as the client's design lays them out: name and the line under it on the left, the figure
 * right-aligned and vertically centred beside them. A long tax status replaces the line under the name and the right
 * slot stays empty, so the name is never squeezed to a word a line.
 */
function NodeRow({ name, line, figure: value, figureTone, className, children }: {
  name: ReactNode; line: ReactNode; figure: string; figureTone?: string; className?: string; children?: ReactNode;
}) {
  const long = value.length > SHORT_FIGURE;
  return (
    <div className={cn("flex min-h-[5rem] w-full flex-col justify-center px-3.5 py-3", className)}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {name}
          <p className="text-2xs break-words text-ink-muted">{long ? value : line}</p>
        </div>
        {!long && value !== "" && <p className={cn("shrink-0 text-right text-sm tabular-nums", figureTone ?? "font-bold")}>{value}</p>}
      </div>
      {children}
    </div>
  );
}

function TopBox({ node, show, currency }: { node: StructureNode; show: Show; currency: string }) {
  const drill = useDrill();
  return (
    <NodeRow className="w-[42%] shrink-0 rounded-xl bg-primary-50 ring-1 ring-primary-200"
      name={
        <button type="button" className="line-clamp-2 text-left text-sm font-bold break-words text-primary-700 hover:underline" title={node.name}
          onClick={() => drill?.({ by: "legalEntity", key: node.id, name: node.name })}>{node.name}</button>
      }
      line={`${node.jurisdiction} · ${node.description ?? typeName(node.type)}`} figure={figure(node, show, currency)} />
  );
}

function ChildBox({ node, show, currency }: { node: StructureNode; show: Show; currency: string }) {
  const drill = useDrill();
  return (
    <NodeRow className="rounded-lg border border-line"
      name={
        <p className="line-clamp-2 text-sm font-semibold break-words" title={node.name}>
          <button type="button" className="text-left hover:text-primary-700 hover:underline"
            onClick={() => drill?.({ by: "legalEntity", key: node.id, name: node.name })}>{node.name}</button> <span className="ml-1 rounded-sm bg-slate-100 px-1 text-3xs font-semibold text-ink-muted uppercase">{shortType(node.type)}</span>
        </p>
      }
      line={[node.ownedPercent == null ? null : `${node.ownedPercent}%`, node.jurisdiction, node.description, node.custodians.join(" · ")]
        .filter(Boolean).join(" · ")}
      figure={figure(node, show, currency)}>
      {node.children.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5 text-xs">
          {node.children.map((grandchild) => (
            <li key={grandchild.id} className="flex justify-between gap-2 pl-3">
              <button type="button" className="min-w-0 text-left break-words hover:text-primary-700 hover:underline"
                onClick={() => drill?.({ by: "legalEntity", key: grandchild.id, name: grandchild.name })}>{grandchild.name}</button>
              <span className="shrink-0 text-right tabular-nums">{figure(grandchild, show, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </NodeRow>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Register, interest, mix, governance                                                                           */

function RegisterCard({ data }: { data: ClientStructure }) {
  const drill = useDrill();
  return (
    <Card title="Entity Register" lead="Every entity on file for this family, with who runs it and where its accounts are held">
      {data.bankFile ? <FileBlock /> : data.register.length === 0 ? <Empty>No entity is on file for this client yet.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Entity</th>
                <th scope="col" className="px-3 py-2">Jurisdiction</th>
                <th scope="col" className="px-3 py-2">Parent</th>
                <th scope="col" className="px-3 py-2 text-right">Owned</th>
                <th scope="col" className="px-3 py-2">Tax classification</th>
                <th scope="col" className="px-3 py-2">Trustee / directors</th>
                <th scope="col" className="px-3 py-2">Custodians</th>
                <th scope="col" className="px-3 py-2 text-right">Value</th>
                <th scope="col" className="px-3 py-2 text-right">% NW</th>
                <th scope="col" className="py-2 pr-5 pl-3">Docs &amp; KYC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.register.map((one) => (
                <tr key={one.id} className="align-top">
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-normal">
                    <button type="button" className="text-left font-semibold hover:text-primary-700 hover:underline"
                      onClick={() => drill?.({ by: "legalEntity", key: one.id, name: one.name })}>{one.name}</button>
                    <span className="block text-xs text-ink-muted">{typeName(one.type)}</span>
                  </th>
                  <td className="px-3 py-2 whitespace-nowrap">{one.jurisdiction}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{one.parent ?? "Settlors"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{one.ownedPercent == null ? "—" : `${one.ownedPercent}%`}</td>
                  <td className="px-3 py-2">{one.taxClassification ?? <Muted>—</Muted>}</td>
                  <td className="px-3 py-2">{officers(one.officers)}</td>
                  <td className="px-3 py-2">{one.custodians.join(" · ") || <Muted>—</Muted>}</td>
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">{compact(one.value, data.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{one.netWorthPercent == null ? <Muted>—</Muted> : `${one.netWorthPercent.toFixed(1)}%`}</td>
                  <td className="py-2 pr-5 pl-3 whitespace-nowrap">
                    {one.refreshKind == null || one.refreshDue == null
                      ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-2xs font-semibold text-emerald-700">Nothing due</span>
                      : <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">
                          {one.refreshKind === "CRS_RENEWAL" ? "CRS" : "KYC"} due {shortDate(one.refreshDue)}
                        </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function officers(list: StructureOfficer[]): ReactNode {
  if (list.length === 0) return <Muted>—</Muted>;
  const trustees = list.filter((one) => one.role === "TRUSTEE").map((one) => one.name);
  const directors = list.filter((one) => one.role === "DIRECTOR");
  const others = list.filter((one) => one.role !== "TRUSTEE" && one.role !== "DIRECTOR").map((one) => `${one.name} (${one.role.toLowerCase()})`);
  return [...trustees, directors.length > 0 ? `${directors.length} ${directors.length === 1 ? "director" : "directors"}` : null, ...others]
    .filter(Boolean)
    .join(" · ");
}

function InterestCard({ data, chart }: { data: ClientStructure; chart: CardChart }) {
  const drill = useDrill();
  const cur = data.currency;
  const largest = Math.max(1, ...data.interests.flatMap((row) => (row.cells as (number | null)[]).map((cell) => cell ?? 0)));
  return (
    <Card title="Beneficial Interest Matrix" lead="Economic interest by entity and beneficiary · as recorded"
      picker={!data.bankFile && data.beneficiaries.length > 0 && chart.picker}>
      {data.bankFile ? <FileBlock /> : data.beneficiaries.length === 0 ? <Empty>No beneficiary is on file for this client yet.</Empty> : !chart.own ? (
        chart.kind === "donut" ? (
          <KindChart kind="donut" format={(value) => compact(value, cur)} height={260} label="Each beneficiary's economic interest across every entity"
            data={{ shape: "shares", items: data.beneficiaries.map((one) => ({ name: one.name, value: one.value })) }}
            onPick={(at) => { const one = data.beneficiaries[at]; if (one) drill?.({ by: "beneficiary", key: one.id, name: one.name }); }} />
        ) : (
          <KindChart kind={chart.kind!} format={(value) => compact(value, cur)} height={260} label="Each entity's value split by beneficiary"
            data={{ shape: "series", categories: data.interests.map((row) => row.entity), series: data.beneficiaries.map((one, at) => ({
              name: one.name, values: data.interests.map((row) => (row.cells as (number | null)[])[at] ?? null),
            })) }}
            onPick={(at) => { const row = data.interests[at]; if (row) drill?.({ by: "legalEntity", key: row.entityId, name: row.entity }); }} />
        )
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5"><span className="sr-only">Entity</span></th>
                {data.beneficiaries.map((one) => (
                  <th key={one.id} scope="col" className="px-1 py-2 text-center">
                    <button type="button" className="uppercase hover:text-primary-700 hover:underline"
                      onClick={() => drill?.({ by: "beneficiary", key: one.id, name: one.name })}>{one.name}</button>
                    {one.generation && <span className="block font-normal normal-case">{one.generation}</span>}
                  </th>
                ))}
                <th scope="col" className="py-2 pr-5 pl-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.interests.map((row) => (
                <tr key={row.entityId}>
                  <th scope="row" className="py-1 pr-3 pl-5 text-left font-medium">
                    <button type="button" className="text-left hover:text-primary-700 hover:underline"
                      onClick={() => drill?.({ by: "legalEntity", key: row.entityId, name: row.entity })}>{row.entity}</button>
                  </th>
                  {(row.cells as (number | null)[]).map((cell, at) => (
                    <td key={at} className="px-1 py-1">
                      {/* A tint of the theme's blue, from faint for the smallest share to a third for the largest, under
                          the page's own ink: a heat map read as cells, never a solid block that looks like a button. */}
                      <span className="flex h-9 w-full items-center justify-center rounded-md text-xs font-semibold text-ink tabular-nums"
                        style={{ background: cell == null
                          ? "var(--color-slate-50)"
                          : `color-mix(in srgb, var(--color-primary-600) ${Math.round(8 + 27 * (cell / largest))}%, transparent)` }}>
                        {cell == null ? <span className="text-ink-muted">—</span> : compact(cell, cur)}
                      </span>
                    </td>
                  ))}
                  <td className="py-1 pr-5 pl-3 text-right font-semibold tabular-nums">{compact(row.value, cur)}</td>
                </tr>
              ))}
              <tr className="border-t border-line font-semibold">
                <th scope="row" className="py-2 pr-3 pl-5 text-left">Total</th>
                {data.beneficiaries.map((one) => (
                  <td key={one.id} className="px-1 py-2 text-center tabular-nums">{compact(one.value, cur)}</td>
                ))}
                <td className="py-2 pr-5 pl-3 text-right tabular-nums">
                  {compact(data.interests.reduce((sum, row) => sum + row.value, 0), cur)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {!data.bankFile && data.unassigned && (
        <p className="mt-2 text-3xs text-ink-muted italic">
          {compact(data.unassigned.value, cur)} the client holds outside any entity is not in this matrix.
        </p>
      )}
    </Card>
  );
}

function MixCard({ data, chart }: { data: ClientStructure; chart: CardChart }) {
  const drill = useDrill();
  const names = [...new Set(data.assetMix.flatMap((row) => row.slices.map((one) => one.name)))];
  const colour = (name: string) => INK[names.indexOf(name) % INK.length];
  return (
    <Card title="Asset Mix by Entity" lead="% of each entity's value" picker={!data.bankFile && data.assetMix.length > 0 && chart.picker}>
      {data.bankFile ? <FileBlock /> : data.assetMix.length === 0 ? <Empty>No entity is on file for this client yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={chart.kind === "heatmap" ? 80 + data.assetMix.length * 34 : 260}
          label="Each entity's value by asset class"
          data={chart.kind === "heatmap"
            ? { shape: "series", categories: names, series: data.assetMix.map((row) => ({
                name: row.entity, values: names.map((name) => row.slices.find((one) => one.name === name)?.sharePercent ?? null),
              })) }
            : { shape: "series", categories: data.assetMix.map((row) => row.entity), series: names.map((name) => ({
                name, values: data.assetMix.map((row) => row.slices.find((one) => one.name === name)?.sharePercent ?? null),
              })) }}
          onPick={chart.kind === "heatmap" ? undefined : (at) => { const row = data.assetMix[at]; if (row) drill?.({ by: "legalEntity", key: row.entityId, name: row.entity }); }} />
      ) : (
        <>
          <ul className="space-y-2.5">
            {data.assetMix.map((row) => (
              <li key={row.entityId} className="grid grid-cols-[9rem_1fr] items-center gap-3 text-sm">
                {/* Wrapped rather than cut: an entity's name is how it is told apart from the next. */}
                <button type="button" className="text-left leading-snug break-words hover:text-primary-700 hover:underline"
                  onClick={() => drill?.({ by: "legalEntity", key: row.entityId, name: row.entity })}>{row.entity}</button>
                <span className="flex h-3 overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
                  {row.slices.map((one) => (
                    <span key={one.key} title={`${one.name} ${one.sharePercent}%`} style={{ width: `${one.sharePercent}%`, background: colour(one.name) }} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {names.map((name) => (
              <li key={name} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs" style={{ background: colour(name) }} aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function GovernanceCard({ data }: { data: ClientStructure }) {
  return (
    <Card title="Governance Calendar & Documents">
      {data.bankFile ? <FileBlock /> : (<>
      {data.governance.length === 0 ? <Empty>Nothing is on the governance calendar.</Empty> : (
        <ul className="divide-y divide-line">
          {data.governance.map((one, at) => (
            <li key={`${one.dueOn}-${at}`} className="flex items-center gap-4 py-2.5">
              <span className="w-24 shrink-0 text-xs text-ink-muted">{formatDate(one.dueOn)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{one.entity ?? "Client"}</p>
                <p className="text-xs text-ink-muted">{one.title}</p>
              </div>
              <span className={cn("rounded-md px-2 py-0.5 text-2xs font-semibold",
                one.status === "DUE" ? "bg-amber-50 text-amber-700" : one.status === "DONE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-soft")}>
                {one.status === "DUE" ? "Due" : one.status === "DONE" ? "Done" : "Scheduled"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Constitutional documents</p>
      {data.documents.length === 0 ? <Empty>No constitutional document is recorded.</Empty> : (
        <ul className="mt-1 divide-y divide-line">
          {data.documents.map((one, at) => (
            <li key={`${one.title}-${at}`} className="flex items-center gap-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{one.title}</span>
              <span className="text-xs text-ink-muted">
                {[one.executedOn && `Executed ${year(one.executedOn)}`, one.amendedOn && `updated ${formatDate(one.amendedOn)}`, one.note]
                  .filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">Dates and status only; the papers themselves are kept with the client's documents.</p>
      </>)}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The bank-file client                                                                                          */

/** A card drawn as it is, with no switcher: the bank-file layout, where these cards only say the file does not hold them. */
const OWN_LOOK: CardChart = { kind: null, own: true, picker: null };

function FileContainers({ name, accounts, data }: { name: string; accounts: StructureFileAccount[]; data: ClientStructure }) {
  return (
    <>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        {["Legal entities", "Jurisdictions", "Beneficiaries", "Trustees & directors", "KYC / CRS refresh due"].map((label) => (
          <Kpi key={label} label={label} value={<NotInFile />} note="The bank file holds no entity, trust or beneficiary data" />
        ))}
      </div>
      <Card title="Ownership Structure" lead="Settlors → trusts & personal holdings → companies, SPVs and accounts · his accounts as the bank's files state them">
        <div className="overflow-x-auto">
          <div className="flex min-w-[44rem] items-center">
            <div className="w-52 shrink-0 rounded-xl border-2 border-ink p-3">
              <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">Account holder</p>
              <p className="text-base font-bold">{name}</p>
              <p className="text-2xs text-ink-muted">Entities and trusts: <NotInFile /></p>
            </div>
            <div className="w-6 shrink-0 border-t border-line" aria-hidden="true" />
            <div className="flex-1 space-y-2 border-l border-line">
              {accounts.length === 0 && <div className="pl-4"><NotInFile /></div>}
              {accounts.map((one, at) => (
                <div key={`${one.lastFour}-${one.accountCurrency}-${at}`} className="flex items-center">
                  <div className="w-4 shrink-0 border-t border-line" aria-hidden="true" />
                  <div className="flex flex-1 items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">{one.bank} · ••{one.lastFour}</p>
                      <p className="text-2xs text-ink-muted">Account in {one.accountCurrency}{one.asOf && ` · as of ${formatDate(one.asOf)}`}</p>
                    </div>
                    <div className="text-right text-xs font-semibold tabular-nums">
                      {one.holdings.length === 0 ? <NotInFile /> : one.holdings.map((amount) => (
                        <span key={amount.currency} className="block">{exact(amount.amount, amount.currency)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-3xs text-ink-muted italic">
          Each account's holdings summed in the currency the bank wrote them in, as sent; masked numbers as the bank sent them.
        </p>
      </Card>
      <RegisterCard data={data} />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <InterestCard data={data} chart={OWN_LOOK} />
        <MixCard data={data} chart={OWN_LOOK} />
      </div>
      <GovernanceCard data={data} />
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                  */

/** A card his bank's files hold nothing for: it stays in its place and says so. */
function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

/** "Richard & Eleanor Halden" from the first generation's names, as the design writes the settlors. */
function settlorNames(names: string[]) {
  return names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** What Entity Structure offers for a card of the reader's own: who holds the economic interest, and in what. */
function structureFigures(data: ClientStructure): Figures {
  const amount = (value: number) => compact(value, data.currency);
  const names = [...new Set(data.assetMix.flatMap((row) => row.slices.map((one) => one.name)))];
  return {
    "interest.beneficiaries": sharesFigure("Economic interest by beneficiary", "Beneficiaries", data.beneficiaries.map((one) => ({ name: one.name, value: one.value })), amount),
    "interest.entities": sharesFigure("Value held by each entity", "Structure", data.interests.map((row) => ({ name: row.entity, value: row.value })), amount,
      ["horizontal-bar", "donut", "treemap", "table"]),
    "interest.matrix": seriesFigure("Each entity's value by beneficiary", "Beneficiaries", data.interests.map((row) => row.entity),
      data.beneficiaries.map((one, at) => ({ name: one.name, values: data.interests.map((row) => (row.cells as (number | null)[])[at] ?? null) })),
      amount, ["stacked-bar", "grouped-bar", "heatmap", "table"]),
    "mix.entities": seriesFigure("Asset mix by entity", "Structure", data.assetMix.map((row) => row.entity),
      names.map((name) => ({ name, values: data.assetMix.map((row) => row.slices.find((one) => one.name === name)?.sharePercent ?? null) })),
      (value) => `${value.toFixed(1)}%`, ["stacked-bar", "grouped-bar", "heatmap", "table"]),
  };
}

/** @param picker the chart type switcher, beside the card's own action, for a card that draws a chart */
function Card({ title, lead, action, picker, children }: { title: string; lead?: string; action?: ReactNode; picker?: ReactNode; children: ReactNode }) {
  // The reader's own name and line for the card, where they set them through Add card.
  const label = useCardLabel(title, lead);
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{label.title}</h2>
          {label.lead && <p className="mt-0.5 text-xs text-ink-muted">{label.lead}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{action}{picker}<CardMenu /></div>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: ReactNode; note: ReactNode; tone?: string }) {
  if (useFigureRow()) return <FigureRow label={label} value={value} note={note} tone={tone} />;
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1.5 truncate text-2xl font-bold", tone)}>{value}</p>
      <div className="mt-1 text-xs text-ink-muted">{note}</div>
    </div>
  );
}

function Toggle<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line p-0.5">
      {options.map(([id, name]) => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id}
          className={cn("rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
            value === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
          {name}
        </button>
      ))}
    </div>
  );
}

function NotInFile() {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      not in bank file
    </span>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>;
}

const TYPE_NAMES: Record<string, string> = {
  TRUST: "Trust", SUB_TRUST: "Sub-trust", COMPANY: "Company", LLC: "LLC", SPV: "SPV", FOUNDATION: "Foundation",
  PERSONAL: "Personal holding", JOINT: "Joint holding",
};

function typeName(type: string) {
  return TYPE_NAMES[type] ?? type;
}

function shortType(type: string) {
  return ({ TRUST: "Trust", SUB_TRUST: "Trust", COMPANY: "Co", LLC: "LLC", SPV: "SPV", FOUNDATION: "Fdn", PERSONAL: "Personal", JOINT: "Joint" } as Record<string, string>)[type] ?? type;
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
  }
}

function exact(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(day: string) {
  return new Date(day).toLocaleString("en-GB", { day: "numeric", month: "short" });
}

function year(day: string) {
  return String(new Date(day).getFullYear());
}
