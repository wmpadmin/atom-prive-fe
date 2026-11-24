import {
  listProspects,
  useListProspects,
  type ListProspectsStatusItem,
  type ProspectDetail,
} from "@atomprive/api-client/backoffice";
import { Button, IconButton, TextInput, cn } from "@atomprive/ui";
import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { BackToOverview } from "../../components/back-to-overview";
import { ColumnPicker } from "../../components/column-picker";
import { ListPageHeader, RecordList } from "../../components/record-list";
import { useTableView } from "../../lib/table-view";
import { formatDate } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { ListReportButton, saidFilters } from "../layout/list-report";
import { everyPage, toCsv } from "../layout/list-rows";
import { ProspectForm } from "./prospect-form";
import { ONBOARDING_STAGE_LABELS, ONBOARDING_STAGE_PILLS, SOURCE_LABELS, STATUS_LABELS, STATUS_PILLS } from "./prospect-labels";

type StatusFilter = "OPEN" | ListProspectsStatusItem;

/** The list's four tabs: the open prospects, the two ways one closes, and everybody. */
type Tab = "OPEN" | "COMPLIANCE" | "DRAFT" | "CONVERTED" | "LOST" | "ALL";

const OPEN_ONES: ListProspectsStatusItem[] = ["NEW", "IN_DISCUSSION", "FOLLOW_UP", "QUALIFIED"];

const EVERY_STATUS: ListProspectsStatusItem[] = ["DRAFT", ...OPEN_ONES, "CONVERTED", "LOST"];

/**
 * Prospective clients: people the firm hopes will become clients, with a few basic details, followed up until
 * they are converted — which starts their onboarding — or lost. A row opens the prospect in a panel over the
 * list, so the list stays where it was.
 */
/**
 * The columns a reader may take off or put back (23 Nov 2026). P-Number and the name always stay; the rest open on
 * the main ones, with the others a click away under Columns.
 */
const COLUMNS = [
  { id: "type", label: "Client type" },
  { id: "source", label: "Source" },
  { id: "assigned", label: "Assigned to" },
  { id: "meeting", label: "Meeting" },
  { id: "next", label: "Next follow up" },
  { id: "status", label: "Status" },
  { id: "documents", label: "Documents" },
  { id: "compliance", label: "Compliance" },
  { id: "createdBy", label: "Created by" },
  { id: "updated", label: "Last updated" },
  { id: "email", label: "Email" },
] as const;
type ColumnId = (typeof COLUMNS)[number]["id"];
const HIDDEN_AT_FIRST: ColumnId[] = ["type", "source", "documents", "compliance", "createdBy", "updated", "email"];

export function ProspectiveClientsPage() {
  const user = useStaffUser();
  const mayAdd = hasAuthority(user, "PROSPECTIVE_CLIENTS:CHANGE") || hasAuthority(user, "PROSPECTIVE_CLIENTS:OWN_CLIENTS");
  const onlyMine = !hasAuthority(user, "PROSPECTIVE_CLIENTS:CHANGE");

  const [params] = useSearchParams();
  const opened = params.get("open");
  const [query, setQuery] = useState("");
  // Opened at one stage from the overview's pipeline, which says which in the address.
  const [status, setStatus] = useState<StatusFilter>(() => {
    const asked = params.get("status");
    return asked && asked in STATUS_LABELS ? (asked as StatusFilter) : "OPEN";
  });
  // Whoever checks documents starts on what waits for them (23 Nov 2026); Compliance themselves start on every
  // prospect (24 Nov 2026), the With Compliance tab one click away.
  const checks = hasAuthority(user, "APPROVE_ONBOARDING:CHANGE");
  const compliance = checks && onlyMine;
  const [tab, setTab] = useState<Tab>(() => {
    const asked = params.get("status");
    return asked === "CONVERTED" || asked === "LOST" || asked === "DRAFT" ? asked
      : asked === "COMPLIANCE" ? "COMPLIANCE"
      : !asked && compliance ? "ALL"
      : !asked && checks ? "COMPLIANCE" : "OPEN";
  });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [form, setForm] = useState<{ editing: ProspectDetail | null } | null>(null);
  const view = useTableView("prospective-clients", COLUMNS.map((one) => one.id), HIDDEN_AT_FIRST);
  const show = (id: ColumnId) => view.shown.includes(id);

  const asked = {
    query: query.trim() || undefined,
    status: tab === "CONVERTED" ? ["CONVERTED" as const] : tab === "LOST" ? ["LOST" as const] : tab === "DRAFT" ? ["DRAFT" as const]
      : tab === "ALL" ? EVERY_STATUS
      : tab === "COMPLIANCE" ? undefined
      : status === "OPEN" || !OPEN_ONES.includes(status) ? undefined : [status],
    complianceStatus: tab === "COMPLIANCE" ? "TO_CHECK" : undefined,
  };
  const prospects = useListProspects({ ...asked, page, size });

  // A prospect opens on a page of its own (22 Nov 2026); the list's own address goes with it so Back returns here.
  const navigate = useNavigate();
  const open = (id: string | null) => {
    if (!id) return;
    const kept = new URLSearchParams(params);
    kept.delete("open");
    const list = kept.toString();
    void navigate(`/prospective-clients/${id}`, { state: { list: list ? `?${list}` : "" } });
  };
  // A link from before the page (?open=…) still lands on the prospect.
  useEffect(() => {
    if (opened) open(opened);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);
  const emailFrom = (id: string) => open(id);

  const rows = prospects.data?.items ?? [];
  const filtered = query.trim() !== "" || status !== "OPEN";

  return (
    <div className="space-y-6">
      <BackToOverview />
      <ListPageHeader
        title="Prospective Clients"
        lead="Potential clients with their basic details. Track follow-ups and convert them to clients."
      >
        <ListReportButton list="Prospective clients" load={async () => toCsv(
          ["Reference", "Name", "Type", "Email", "Phone", "Source", "Assigned to", "Next follow-up", "Overdue", "Status"],
          (await everyPage(async (at) => { const one = await listProspects({ ...asked, page: at, size: 100 }); return { items: one.items, totalItems: one.total }; })).map((row) => [
            row.reference, row.fullName, row.clientType === "ENTITY" ? "Entity" : "Individual", row.email ?? "", row.phone ?? "", row.source ? SOURCE_LABELS[row.source] : "",
            row.assignedTo?.fullName ?? "", row.nextFollowUp ? formatDate(row.nextFollowUp) : "", row.overdue ? "Yes" : "No", STATUS_LABELS[row.status],
          ]),
        )} filters={saidFilters({
          Status: tab === "OPEN" ? (status === "OPEN" ? "Open" : STATUS_LABELS[status]) : tab === "ALL" ? "All" : tab === "COMPLIANCE" ? "With Compliance" : STATUS_LABELS[tab],
          Search: query.trim(),
        })} />
      </ListPageHeader>

      <RecordList
        caption="Prospective clients"
        subtitle="Due soonest first"
        search={
          <label className="w-full max-w-md">
            <span className="sr-only">Search prospects</span>
            <TextInput
              id="prospect-search"
              value={query}
              placeholder="Search name, email, phone or P-number"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
        }
        // Beside the search box, as Start onboarding is on All clients: it is the work, not a way of reading it.
        action={mayAdd ? <Button onClick={() => setForm({ editing: null })}>Add Prospective Client</Button> : undefined}
        filters={
          <>
            <div role="tablist" aria-label="Which prospects" className="flex rounded-lg border border-line p-0.5 text-sm font-semibold">
              {([["OPEN", "Open"], ["COMPLIANCE", "With Compliance"], ["DRAFT", "Drafts"], ["CONVERTED", "Converted"], ["LOST", "Lost"], ["ALL", "All"]] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id}
                  onClick={() => { setTab(id); setPage(0); }}
                  className={cn("rounded-md px-3 py-1", tab === id ? "bg-primary-50 text-primary-700" : "text-ink-muted hover:text-ink")}>
                  {label}
                </button>
              ))}
            </div>
            <ColumnPicker
              columns={COLUMNS.map((one) => ({ id: one.id, label: one.label }))}
              shown={new Set(view.shown)}
              onChange={(next) => {
                for (const one of COLUMNS) {
                  if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                }
              }}
              onReset={view.reset}
            />
          </>
        }
        filtered={filtered}
        onClear={() => {
          setQuery("");
          setStatus("OPEN");
          setPage(0);
        }}
        head={
          <>
            <th scope="col" className="px-5 py-3 text-left font-semibold">P-Number</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Client name</th>
            {show("type") && <th scope="col" className="px-4 py-3 text-left font-semibold">Client type</th>}
            {show("source") && <th scope="col" className="px-4 py-3 text-left font-semibold">Source</th>}
            {show("assigned") && <th scope="col" className="px-4 py-3 text-left font-semibold">Assigned to</th>}
            {show("meeting") && <th scope="col" className="px-4 py-3 text-left font-semibold">Meeting</th>}
            {show("next") && <th scope="col" className="px-4 py-3 text-left font-semibold">Next follow up</th>}
            {show("status") && <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>}
            {show("documents") && <th scope="col" className="px-4 py-3 text-left font-semibold">Documents</th>}
            {(show("compliance") || tab === "COMPLIANCE") && <th scope="col" className="px-4 py-3 text-left font-semibold">Compliance</th>}
            {show("createdBy") && <th scope="col" className="px-4 py-3 text-left font-semibold">Created by</th>}
            {show("updated") && <th scope="col" className="px-4 py-3 text-left font-semibold">Last updated</th>}
            {show("email") && <th scope="col" className="px-4 py-3 text-right font-semibold">Email</th>}
          </>
        }
        columns={2 + view.shown.length + (tab === "COMPLIANCE" && !show("compliance") ? 1 : 0)}
        loading={prospects.isLoading}
        empty={rows.length > 0 ? undefined : filtered
          ? "No prospect matches what you searched for."
          : "No prospective clients yet. Add one with Add Prospective Client."}
        page={page}
        size={size}
        total={prospects.data?.total ?? 0}
        noun={["prospect", "prospects"]}
        onPage={setPage}
        onSize={(next) => {
          setSize(next);
          setPage(0);
        }}
      >
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => open(row.id)}
            className={cn("cursor-pointer border-t border-line hover:bg-slate-50/60", opened === row.id && "bg-primary-50/60")}
          >
            <td className="px-5 py-3 font-mono text-xs whitespace-nowrap text-ink-soft">{row.reference}</td>
            <td className="px-4 py-3 font-semibold text-ink">{row.fullName}</td>
            {show("type") && (
              <td className="px-4 py-3">{row.clientType === "ENTITY" ? "Entity" : "Individual"}</td>
            )}
            {show("source") && (
              <td className="px-4 py-3">{row.source ? SOURCE_LABELS[row.source] : <span className="text-ink-muted">—</span>}</td>
            )}
            {show("assigned") && (
              <td className="px-4 py-3">{row.assignedTo?.fullName ?? <span className="text-ink-muted">Nobody yet</span>}</td>
            )}
            {show("meeting") && (
              <td className="px-4 py-3 whitespace-nowrap">
                {row.meetingStage === "PLANNED" ? (
                  <span className="text-amber-800">{row.plannedMeetingAt ? `Meeting ${formatDate(row.plannedMeetingAt)}` : "To arrange"}</span>
                ) : row.meetingStage === "MET" ? (
                  <span className="text-emerald-700">Met{row.metOn ? ` ${formatDate(row.metOn)}` : ""}</span>
                ) : <span className="text-ink-muted">—</span>}
              </td>
            )}
            {show("next") && (
              <td className={cn("px-4 py-3 whitespace-nowrap", row.overdue && "font-semibold text-red-700")}>
                {row.nextFollowUp ? `${formatDate(row.nextFollowUp)}${row.overdue ? " · Overdue" : ""}` : <span className="text-ink-muted">Not set</span>}
              </td>
            )}
            {show("status") && (
              <td className="px-4 py-3">
                {/* One short status (23 Nov 2026): the onboarding stage's name once documents are being collected. */}
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                  row.onboardingStage && row.onboardingStage !== "ONBOARDED" ? ONBOARDING_STAGE_PILLS[row.onboardingStage] : STATUS_PILLS[row.status])}>
                  {row.onboardingStage && row.onboardingStage !== "ONBOARDED" ? ONBOARDING_STAGE_LABELS[row.onboardingStage] : STATUS_LABELS[row.status]}
                </span>
              </td>
            )}
            {show("documents") && (
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {row.documentsRequired ? (
                  <span className={cn(row.documentsDone === row.documentsRequired ? "text-emerald-700" : "text-amber-800")}>
                    {row.documentsDone ?? 0} of {row.documentsRequired}
                  </span>
                ) : <span className="text-ink-muted">—</span>}
              </td>
            )}
            {(show("compliance") || tab === "COMPLIANCE") && (
              <td className="px-4 py-3 whitespace-nowrap">
                {row.toCheck > 0 ? <span className="font-semibold text-amber-800">{row.toCheck} to check</span>
                  : row.complianceStatus ? COMPLIANCE_LABELS[row.complianceStatus] ?? row.complianceStatus : <span className="text-ink-muted">Not sent</span>}
              </td>
            )}
            {show("createdBy") && (
              <td className="px-4 py-3 whitespace-nowrap">{row.createdBy ?? <span className="text-ink-muted">—</span>}</td>
            )}
            {show("updated") && (
              <td className="px-4 py-3 whitespace-nowrap">{row.updatedAt ? formatDate(row.updatedAt) : <span className="text-ink-muted">—</span>}</td>
            )}
            {show("email") && (
              <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                {mayAdd && row.email && !row.doNotEmail && row.status !== "CONVERTED" && row.status !== "LOST" && (
                  <IconButton label={`Email ${row.fullName}`} onClick={() => emailFrom(row.id)}>
                    <Mail aria-hidden="true" />
                  </IconButton>
                )}
              </td>
            )}
          </tr>
        ))}
      </RecordList>

      {form && (
        <ProspectForm
          open
          editing={form.editing}
          onlyMine={onlyMine}
          me={user.id}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setForm(null);
            open(saved.prospect.id);
          }}
        />
      )}
    </div>
  );
}

const COMPLIANCE_LABELS: Record<string, string> = {
  WITH_COMPLIANCE: "With Compliance",
  IN_REVIEW: "In review",
  MORE_DOCUMENTS: "Documents asked",
  REJECTED: "Rejected",
  APPROVED: "Approved",
};
