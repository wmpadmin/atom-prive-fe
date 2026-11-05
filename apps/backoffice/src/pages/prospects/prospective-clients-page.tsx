import {
  useListProspectAssignees,
  useListProspects,
  type ListProspectsStatusItem,
  type ProspectDetail,
} from "@atomprive/api-client/backoffice";
import { Button, FilterMenu, IconButton, TextInput, cn } from "@atomprive/ui";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { BackToOverview } from "../../components/back-to-overview";
import { ListPageHeader, RecordList } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { ProspectForm } from "./prospect-form";
import { ProspectPanel } from "./prospect-panel";
import { SOURCE_LABELS, STATUS_LABELS, STATUS_PILLS } from "./prospect-labels";

type StatusFilter = "OPEN" | ListProspectsStatusItem;

/**
 * Prospective clients: people the firm hopes will become clients, with a few basic details, followed up until
 * they are converted — which starts their onboarding — or lost. A row opens the prospect in a panel over the
 * list, so the list stays where it was.
 */
export function ProspectiveClientsPage() {
  const user = useStaffUser();
  // Operations and Admin see every prospect; a relationship manager the ones assigned to them.
  const everyone = hasAuthority(user, "PROSPECTIVE_CLIENTS:VIEW");
  const mayAdd = hasAuthority(user, "PROSPECTIVE_CLIENTS:CHANGE") || hasAuthority(user, "PROSPECTIVE_CLIENTS:OWN_CLIENTS");
  const onlyMine = !hasAuthority(user, "PROSPECTIVE_CLIENTS:CHANGE");

  const [params, setParams] = useSearchParams();
  const opened = params.get("open");
  const [query, setQuery] = useState("");
  // Opened at one stage from the overview's pipeline, which says which in the address.
  const [status, setStatus] = useState<StatusFilter>(() => {
    const asked = params.get("status");
    return asked && asked in STATUS_LABELS ? (asked as StatusFilter) : "OPEN";
  });
  const [assignedTo, setAssignedTo] = useState("ALL");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [form, setForm] = useState<{ editing: ProspectDetail | null } | null>(null);

  const prospects = useListProspects({
    query: query.trim() || undefined,
    status: status === "OPEN" ? undefined : [status],
    assignedTo: assignedTo === "ALL" ? undefined : assignedTo,
    page,
    size,
  });
  const assignees = useListProspectAssignees({ query: { enabled: everyone } });

  const open = (id: string | null) => {
    setParams((was) => {
      const next = new URLSearchParams(was);
      if (id) next.set("open", id);
      else next.delete("open");
      return next;
    });
  };
  const emailFrom = (id: string) => {
    open(id);
    // Taken to the email box in the panel once it has opened.
    window.setTimeout(() => document.getElementById("email-subject")?.focus(), 400);
  };

  const rows = prospects.data?.items ?? [];
  const filtered = query.trim() !== "" || status !== "OPEN" || assignedTo !== "ALL";

  return (
    <div className="space-y-6">
      <BackToOverview />
      <ListPageHeader
        title="Prospective Clients"
        lead="Potential clients with their basic details. Track follow-ups and convert them to clients."
      />

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
            <FilterMenu
              label="Status"
              value={status}
              options={[
                { id: "OPEN", label: "Open" },
                ...(Object.keys(STATUS_LABELS) as ListProspectsStatusItem[]).map((one) => ({ id: one, label: STATUS_LABELS[one] })),
              ]}
              onChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            />
            {everyone && (
              <FilterMenu
                label="Assigned to"
                value={assignedTo}
                options={[
                  { id: "ALL", label: "All" },
                  ...(assignees.data ?? []).map((one) => ({ id: one.id, label: one.fullName })),
                ]}
                onChange={(value) => {
                  setAssignedTo(value);
                  setPage(0);
                }}
              />
            )}
          </>
        }
        filtered={filtered}
        onClear={() => {
          setQuery("");
          setStatus("OPEN");
          setAssignedTo("ALL");
          setPage(0);
        }}
        head={
          <>
            <th scope="col" className="px-5 py-3 text-left font-semibold">Client name</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Client type</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Source</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Assigned to</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Next follow up</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
          </>
        }
        columns={7}
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
            <td className="px-5 py-3">
              <p className="font-semibold text-ink">{row.fullName}</p>
              <p className="text-xs text-ink-muted">{row.reference}</p>
            </td>
            <td className="px-4 py-3">{row.clientType === "ENTITY" ? "Entity" : "Individual"}</td>
            <td className="px-4 py-3">{SOURCE_LABELS[row.source]}</td>
            <td className="px-4 py-3">{row.assignedTo?.fullName ?? <span className="text-ink-muted">Nobody yet</span>}</td>
            <td className={cn("px-4 py-3 whitespace-nowrap", row.overdue && "font-semibold text-red-700")}>
              {row.nextFollowUp ? `${formatDate(row.nextFollowUp)}${row.overdue ? " · overdue" : ""}` : <span className="text-ink-muted">Not set</span>}
            </td>
            <td className="px-4 py-3">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", STATUS_PILLS[row.status])}>
                {STATUS_LABELS[row.status]}
              </span>
            </td>
            <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
              {mayAdd && row.email && !row.doNotEmail && row.status !== "CONVERTED" && row.status !== "LOST" && (
                <IconButton label={`Email ${row.fullName}`} onClick={() => emailFrom(row.id)}>
                  <Mail aria-hidden="true" />
                </IconButton>
              )}
            </td>
          </tr>
        ))}
      </RecordList>

      {opened && (
        <ProspectPanel key={opened} id={opened} onClose={() => open(null)} onEdit={(detail) => setForm({ editing: detail })} />
      )}
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
