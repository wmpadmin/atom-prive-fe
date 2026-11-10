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

  if (structure.isError) return <Alert tone="danger">{structure.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the structure…</p>;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Entity structure
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Entity &amp; Ownership Structure</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Trusts, companies and SPVs with ownership, look-through value and beneficial interest · as at {formatDate(data.asOf)}
        </p>
      </header>

      {data.bankFile ? <FileContainers name={data.name} accounts={data.bankFile} /> : <Structure data={data} />}
    </div>
  );
}

function Structure({ data }: { data: ClientStructure }) {
  const { kpis } = data;
  const cur = data.currency;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Kpi label="Legal entities" value={String(kpis.legalEntities)}
          note={kpis.byType.map((one) => `${one.count} ${one.name}${one.count === 1 || one.name.endsWith("C") || one.name.endsWith("V") ? "" : "s"}`).join(" · ") || "None on file"} />
        <Kpi label="Jurisdictions" value={kpis.jurisdictions.length === 0 ? "—" : kpis.jurisdictions.join(" · ")}
          note={`${kpis.jurisdictions.length} ${kpis.jurisdictions.length === 1 ? "jurisdiction" : "jurisdictions"}`} />
        <Kpi label="Beneficiaries" value={String(kpis.beneficiaries)}
          note={`${kpis.generations} ${kpis.generations === 1 ? "generation" : "generations"}${kpis.charities > 0 ? ` · ${kpis.charities} charitable` : ""}`} />
        <Kpi label="Trustees & directors" value={String(kpis.trusteesAndDirectors)}
          note={`${kpis.corporateTrustees} corporate ${kpis.corporateTrustees === 1 ? "trustee" : "trustees"} · ${kpis.directors} ${kpis.directors === 1 ? "director" : "directors"}`} />
        <Kpi label="KYC / CRS refresh due" value={String(kpis.refreshDue.length)}
          tone={kpis.refreshDue.length > 0 ? "text-amber-700" : undefined}
          note={
            <>
              {kpis.refreshDue.map((one) => `${one.entity ?? "Client"} ${shortDate(one.dueOn)}`).join(" · ") || "Nothing due"}
              {kpis.kycPapersExpiring > 0 && <span className="block">{kpis.kycPapersExpiring} client KYC {kpis.kycPapersExpiring === 1 ? "paper" : "papers"} expiring</span>}
            </>
          } />
      </div>

      <OwnershipCard data={data} />
      <RegisterCard data={data} />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <InterestCard data={data} />
        <MixCard data={data} />
      </div>

      <GovernanceCard data={data} />

      <p className="text-xs text-ink-muted">
        Values are look-through market values in {cur}, rolled up from the holdings linked to each entity; none is typed in.
      </p>
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
    <Card title="Ownership Structure" lead="Settlors → trusts & personal holdings → companies, SPVs and holdings"
      action={
        <div className="flex flex-wrap gap-2">
          <Toggle label="Shown as" value={view} onChange={setView} options={[["tree", "Tree"], ["table", "Table"]]} />
          <Toggle label="Each entity shows" value={show} onChange={setShow}
            options={[["value", "Value"], ["owned", "Ownership %"], ["tax", "Tax status"]]} />
        </div>
      }>
      {data.entities.length === 0 && !data.unassigned ? <Empty>No entity is on file for this client yet.</Empty> : view === "tree" ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[52rem] items-center gap-0">
            <div className="w-52 shrink-0 rounded-xl border-2 border-ink p-3">
              <p className="text-3xs font-semibold tracking-wider text-red-700 uppercase">Settlors</p>
              <p className="text-base font-bold">{data.name}</p>
              <p className="text-2xs text-ink-muted">Held across the structure</p>
              <p className="text-lg font-bold tabular-nums">{compact(data.total, cur)}</p>
            </div>
            <div className="w-6 shrink-0 border-t border-line" aria-hidden="true" />
            <div className="flex-1 space-y-3 border-l border-line pl-0">
              {data.entities.map((one) => (
                <div key={one.id} className="flex items-center">
                  <div className="w-6 shrink-0 border-t border-line" aria-hidden="true" />
                  <TopBox node={one} show={show} currency={cur} />
                  {(one.children.length > 0 || one.direct > 0) && (
                    <>
                      <div className="w-6 shrink-0 border-t border-line" aria-hidden="true" />
                      <div className="flex-1 space-y-2 border-l border-line">
                        {one.children.map((child) => (
                          <div key={child.id} className="flex items-center">
                            <div className="w-4 shrink-0 border-t border-line" aria-hidden="true" />
                            <ChildBox node={child} show={show} currency={cur} />
                          </div>
                        ))}
                        {one.children.length > 0 && one.direct > 0 && (
                          <div className="flex items-center">
                            <div className="w-4 shrink-0 border-t border-line" aria-hidden="true" />
                            <div className="flex flex-1 items-center justify-between rounded-lg border border-line px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold">Held directly</p>
                                <p className="text-2xs text-ink-muted">{one.custodians.join(" · ") || "No account linked"}</p>
                              </div>
                              <span className="text-sm font-bold tabular-nums">{compact(one.direct, cur)}</span>
                            </div>
                          </div>
                        )}
                        {one.children.length === 0 && (
                          <div className="flex items-center">
                            <div className="w-4 shrink-0 border-t border-line" aria-hidden="true" />
                            <div className="flex flex-1 items-center justify-between rounded-lg border border-line px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold">Accounts and holdings</p>
                                <p className="text-2xs text-ink-muted">{one.custodians.join(" · ") || "No account linked"}</p>
                              </div>
                              <span className="text-sm font-bold tabular-nums">{compact(one.direct, cur)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {data.unassigned && (
                <div className="flex items-center">
                  <div className="w-6 shrink-0 border-t border-dashed border-line" aria-hidden="true" />
                  <div className="flex w-64 shrink-0 items-center justify-between rounded-xl border border-dashed border-line px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">Not assigned to an entity</p>
                      <p className="text-2xs text-ink-muted">Holdings no entity has been linked to</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{compact(data.unassigned.value, cur)}</span>
                  </div>
                </div>
              )}
            </div>
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

/** What a box says on its right: its value, how much of it its parent owns, or its tax status. */
function figure(node: Pick<StructureNode, "value" | "ownedPercent" | "taxClassification">, show: Show, currency: string): ReactNode {
  if (show === "owned") return node.ownedPercent == null ? "—" : `${node.ownedPercent}%`;
  if (show === "tax") return node.taxClassification ?? "—";
  return compact(node.value, currency);
}

function TopBox({ node, show, currency }: { node: StructureNode; show: Show; currency: string }) {
  return (
    <div className="flex w-64 shrink-0 items-center justify-between gap-3 rounded-xl bg-primary-50 px-3 py-2.5 ring-1 ring-primary-200">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-primary-700">{node.name}</p>
        <p className="truncate text-2xs text-ink-soft">{node.jurisdiction} · {node.description ?? typeName(node.type)}</p>
      </div>
      <span className="shrink-0 text-right text-sm font-bold tabular-nums">{figure(node, show, currency)}</span>
    </div>
  );
}

function ChildBox({ node, show, currency }: { node: StructureNode; show: Show; currency: string }) {
  return (
    <div className="flex-1 rounded-lg border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {node.name} <span className="ml-1 rounded-sm bg-slate-100 px-1 text-3xs font-semibold text-ink-muted uppercase">{shortType(node.type)}</span>
          </p>
          <p className="truncate text-2xs text-ink-muted">
            {[node.ownedPercent == null ? null : `${node.ownedPercent}%`, node.jurisdiction, node.description, node.custodians.join(" · ")]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="shrink-0 text-right text-sm font-bold tabular-nums">{figure(node, show, currency)}</span>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5 text-xs">
          {node.children.map((grandchild) => (
            <li key={grandchild.id} className="flex justify-between gap-2 pl-3">
              <span className="truncate">{grandchild.name}</span>
              <span className="tabular-nums">{figure(grandchild, show, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Register, interest, mix, governance                                                                           */

function RegisterCard({ data }: { data: ClientStructure }) {
  return (
    <Card title="Entity Register" lead="Every entity on file, with who runs it and where its accounts are held">
      {data.register.length === 0 ? <Empty>No entity is on file for this client yet.</Empty> : (
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
                <th scope="col" className="py-2 pr-5 pl-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.register.map((one) => (
                <tr key={one.id} className="align-top">
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-normal">
                    <span className="font-semibold">{one.name}</span>
                    <span className="block text-xs text-ink-muted">{typeName(one.type)}</span>
                  </th>
                  <td className="px-3 py-2 whitespace-nowrap">{one.jurisdiction}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{one.parent ?? "Settlors"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{one.ownedPercent == null ? "—" : `${one.ownedPercent}%`}</td>
                  <td className="px-3 py-2">{one.taxClassification ?? <Muted>—</Muted>}</td>
                  <td className="px-3 py-2">{officers(one.officers)}</td>
                  <td className="px-3 py-2">{one.custodians.join(" · ") || <Muted>—</Muted>}</td>
                  <td className="py-2 pr-5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{compact(one.value, data.currency)}</td>
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

function InterestCard({ data }: { data: ClientStructure }) {
  const cur = data.currency;
  const largest = Math.max(1, ...data.interests.flatMap((row) => (row.cells as (number | null)[]).map((cell) => cell ?? 0)));
  return (
    <Card title="Beneficial Interest Matrix" lead="Economic interest by top-level entity and beneficiary">
      {data.beneficiaries.length === 0 ? <Empty>No beneficiary is on file for this client yet.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Entity</th>
                {data.beneficiaries.map((one) => (
                  <th key={one.id} scope="col" className="px-1 py-2 text-center">
                    {one.name}
                    {one.generation && <span className="block font-normal normal-case">{one.generation}</span>}
                  </th>
                ))}
                <th scope="col" className="py-2 pr-5 pl-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.interests.map((row) => (
                <tr key={row.entityId}>
                  <th scope="row" className="py-1 pr-3 pl-5 text-left font-medium">{row.entity}</th>
                  {(row.cells as (number | null)[]).map((cell, at) => (
                    <td key={at} className="p-0.5">
                      <span className={cn("block rounded-md px-2 py-2 text-center text-xs font-semibold tabular-nums",
                        cell == null ? "bg-slate-50 text-ink-muted" : cell / largest > 0.5 ? "bg-primary-600 text-on-accent" : "bg-primary-100 text-primary-700")}>
                        {cell == null ? "—" : compact(cell, cur)}
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
      {data.unassigned && (
        <p className="mt-2 text-3xs text-ink-muted italic">
          {compact(data.unassigned.value, cur)} the client holds outside any entity is not in this matrix.
        </p>
      )}
    </Card>
  );
}

function MixCard({ data }: { data: ClientStructure }) {
  const names = [...new Set(data.assetMix.flatMap((row) => row.slices.map((one) => one.name)))];
  const colour = (name: string) => INK[names.indexOf(name) % INK.length];
  return (
    <Card title="Asset Mix by Entity" lead="% of each top-level entity's look-through value">
      {data.assetMix.length === 0 ? <Empty>No entity is on file for this client yet.</Empty> : (
        <>
          <ul className="space-y-2.5">
            {data.assetMix.map((row) => (
              <li key={row.entityId} className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm">
                <span className="truncate">{row.entity}</span>
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
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The bank-file client                                                                                          */

function FileContainers({ name, accounts }: { name: string; accounts: StructureFileAccount[] }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {["Legal entities", "Jurisdictions", "Beneficiaries", "Trustees & directors", "KYC / CRS refresh due"].map((label) => (
          <Kpi key={label} label={label} value={<NotInFile />} note="The bank file holds no entity, trust or beneficiary data" />
        ))}
      </div>
      <Card title="Ownership Structure" lead="The only holding containers on file are the accounts the bank's files state">
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
      <p className="text-xs text-ink-muted">
        Entity register, beneficial interest matrix, asset mix by entity, governance calendar and documents: <NotInFile />
      </p>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                  */

function Card({ title, lead, action, children }: { title: string; lead?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {lead && <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: ReactNode; note: ReactNode; tone?: string }) {
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
