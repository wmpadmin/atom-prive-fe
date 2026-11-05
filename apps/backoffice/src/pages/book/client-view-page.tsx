import { ApiError } from "@atomprive/api-client";
import {
  getListOverviewViewsQueryKey,
  useChangeOverviewView,
  useCreateOverviewView,
  useDeleteOverviewView,
  useGetClientOverview,
  useGetCustomer,
  useListClientCashflows,
  useListClientHoldings,
  useListClientLoans,
  useListNonFinancialAssets,
  useListOverviewViews,
  type CashflowList,
  type ClientHoldings,
  type ClientLoans,
  type ClientNonFinancialAssets,
  type ClientOverview,
  type CustomerDetail,
  type OverviewViewList,
  type OverviewViewRow,
  type ViewDefinition,
  type ViewSettings,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, cn } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronLeft, Download, Filter, Pencil, Plus, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { useAssetClasses } from "../portfolios/asset-classes";
import { isoDay } from "./book-figures";
import { CurrencyPicker } from "./currency-picker";
import { OverviewBoard } from "./overview-board";
import { FilterFields, Popover, SaveAsDialog } from "./overview-dialogs";
import { restate } from "./overview-data";
import { downloadWorkbook, ExportActionContext, ExportRegistry, ExportRegistryContext, ExportSlot } from "./overview-export";
import { ExplainerTab } from "./overview-explainer";
import { FamilyTab } from "./family-tab";
import { OwnedAssetsTab } from "./owned-assets-tab";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";
import { DEFAULT_VIEW, NO_SETTINGS, OVERALL_VIEW, PERFORMANCE_VIEW } from "./overview-model";
import type { PanelContext } from "./overview-panels";

/**
 * The Explainer stands among the views as the reference has it, after Overall portfolio, but it is not one:
 * it is the same for every PM and has nothing to arrange.
 */
const EXPLAINER = "explainer";

/** The Explainer's place in the export: one entry, its two tables as two sheets. */
const EXPLAINER_SLOT = { id: EXPLAINER, name: "Explainer" };

/**
 * What the client owns outside the managed portfolio has a tab of its own after Performance. Like the
 * Explainer it is not a view: it is a list to look after, the same for every PM.
 */
const OWNED_ASSETS = "owned-assets";
const OWNED_SLOT = { id: OWNED_ASSETS, name: "Owned assets" };

/** A family's money added up, after Owned assets, for a client with a family and a reader allowed to see it. */
const FAMILY = "family";
const FAMILY_SLOT = { id: FAMILY, name: "Family" };

type Range = "3M" | "YTD" | "1Y" | "MAX";

/** The first day of each quick range, counted back from the last day shown. */
function rangeFrom(range: Range, to: Date, firstValuedOn: string | null) {
  const from = new Date(to);
  if (range === "3M") from.setMonth(from.getMonth() - 3);
  if (range === "1Y") from.setFullYear(from.getFullYear() - 1);
  if (range === "YTD") return isoDay(new Date(to.getFullYear(), 0, 1));
  if (range === "MAX") return firstValuedOn ?? isoDay(from);
  return isoDay(from);
}

/**
 * The platform's own views, standing in as tabs until the PM saves a version of their own under the same
 * name: Overview, Overall portfolio and Performance.
 */
const PLATFORM_VIEWS: OverviewViewRow[] = [
  { id: "platform-overview", name: "Overview", position: 0, definition: DEFAULT_VIEW },
  { id: "platform-overall", name: "Overall portfolio", position: 1, definition: OVERALL_VIEW },
  { id: "platform-performance", name: "Performance", position: 2, definition: PERFORMANCE_VIEW },
];
const PLATFORM_NAMES = PLATFORM_VIEWS.map((one) => one.name);

/**
 * One client, as their portfolio manager reads them.
 *
 * <p>Laid out the way the firm asked for — the dates, preset and filter beside the name, the PM's own views
 * as tabs, and a board of panels each view arranges — and drawn in the platform's own style.
 *
 * <p>A view belongs to the PM, not to the client: arranged once, it opens the same way on every client they
 * look after.
 */
export function ClientViewPage() {
  const { customerId = "" } = useParams();
  const queryClient = useQueryClient();
  const today = new Date();
  const [to, setTo] = useState(isoDay(today));
  const [from, setFrom] = useState(() => {
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    return isoDay(yearAgo);
  });
  const [range, setRange] = useState<Range | null>("1Y");
  const [activeId, setActiveId] = useState<string | null>(null);
  // Editing the view on its tab, or making a new one from the platform's; each time a fresh board.
  const [editing, setEditing] = useState<{ mode: "edit" | "new"; session: number } | null>(null);
  const [savingAs, setSavingAs] = useState<ViewDefinition | null>(null);
  const [deleting, setDeleting] = useState<OverviewViewRow | null>(null);
  const [quick, setQuick] = useState<ViewSettings | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // The currency picked for this client, if any; every client opens in its own. Held with the client it was
  // picked for, so moving to another client starts in theirs.
  const [picked, setPicked] = useState<{ customerId: string; code: string } | null>(null);
  const shownIn = picked?.customerId === customerId ? picked.code : undefined;
  // What each panel on the tab draws, for exporting; the panels keep it up to date themselves.
  const [registry] = useState(() => new ExportRegistry());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportable, setExportable] = useState<{ id: string; name: string }[]>([]);
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const detail = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const overview = useGetClientOverview<ClientOverview, ApiError>(customerId, { from, to, currency: shownIn }, {
    query: { placeholderData: keepPreviousData },
  });
  const holdings = useListClientHoldings<ClientHoldings, ApiError>(customerId, undefined, { query: { retry: false } });
  const owned = useListNonFinancialAssets<ClientNonFinancialAssets, ApiError>(customerId, { query: { retry: false } });
  const loans = useListClientLoans<ClientLoans, ApiError>(customerId, { query: { retry: false } });
  const cashflows = useListClientCashflows<CashflowList, ApiError>(customerId, { query: { retry: false } });
  const listed = useListOverviewViews<OverviewViewList, ApiError>({ query: { staleTime: 60_000 } });
  const classes = useAssetClasses();

  // The platform's views come first, in their own order; a PM's version of one takes its place, and the
  // PM's other views follow.
  const saved = listed.data?.views ?? [];
  const views = [
    ...PLATFORM_VIEWS.map((platform) => saved.find((one) => one.name === platform.name) ?? platform),
    ...saved.filter((one) => !PLATFORM_NAMES.includes(one.name)),
  ];
  const explaining = activeId === EXPLAINER;
  const owning = activeId === OWNED_ASSETS;
  const familying = activeId === FAMILY;
  // On a tab of its own rather than a view's board.
  const offBoard = explaining || owning || familying;
  const active = views.find((one) => one.id === activeId) ?? views[0]!;
  const own = !active.id.startsWith("platform-");

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListOverviewViewsQueryKey() });
  const create = useCreateOverviewView<ApiError>({
    mutation: {
      onSuccess: async (made) => {
        await refresh();
        setActiveId(made.id);
        setSavingAs(null);
        setEditing(null);
      },
    },
  });
  const change = useChangeOverviewView<ApiError>({ mutation: { onSuccess: async () => { await refresh(); setEditing(null); } } });
  const remove = useDeleteOverviewView<ApiError>({
    mutation: {
      onSuccess: async () => {
        await refresh();
        setDeleting(null);
        setActiveId(null);
      },
    },
  });

  const pick = (next: Range) => {
    setRange(next);
    setFrom(rangeFrom(next, new Date(to), overview.data?.firstValuedOn ?? null));
  };
  const startEditing = (mode: "edit" | "new") => {
    // A new view is made on a board, which the Explainer does not have; it opens from the first view's.
    if (offBoard) setActiveId(null);
    setEditing({ mode, session: Date.now() });
  };

  const client = detail.data?.client;
  const data = overview.data;
  const definition = editing?.mode === "new" ? DEFAULT_VIEW : active.definition;
  const kept = definition.settings ?? NO_SETTINGS;
  // The header's Filter narrows what is shown for now without changing the view; View setting changes the
  // view itself.
  const settings: ViewSettings = quick ? { ...kept, assetClasses: quick.assetClasses, sectors: quick.sectors, countries: quick.countries } : kept;
  const filtering = (settings.assetClasses?.length ?? 0) + (settings.sectors?.length ?? 0) + (settings.countries?.length ?? 0);

  // The lists beside the overview, in the currency the overview is shown in, at the same day's rates.
  const lists = useMemo(
    () => data && restate(data, { holdings: holdings.data, owned: owned.data, loans: loans.data, cashflows: cashflows.data }),
    [data, holdings.data, owned.data, loans.data, cashflows.data],
  );
  const context: PanelContext | null = data && lists
    ? {
        customerId,
        classes: classes.all,
        range,
        onRange: pick,
        sources: { overview: data, ...lists, settings, from, to, shownIn },
      }
    : null;
  const converted = data && data.currency !== data.baseCurrency;

  // What every exported sheet says it is, above its figures.
  const tabName = explaining ? "Explainer" : owning ? "Owned assets" : familying ? "Family" : editing?.mode === "new" ? "New view" : active.name;
  // The Family tab is offered for a client with somebody else in their family group, to a reader whose role
  // may see a family's combined wealth.
  const reader = useStaffUser();
  const family = detail.data?.family ?? [];
  const seesFamily = family.some((one) => one.id !== customerId) && hasAuthority(reader, "VIEW_FAMILY_WEALTH:VIEW");
  // Who may own part of something the client owns: the client, then their family.
  const people = [
    { id: customerId, name: client?.fullName ?? "The client" },
    ...(detail.data?.family ?? []).filter((one) => one.id !== customerId).map((one) => ({ id: one.id, name: one.fullName })),
  ];
  const about = data
    ? [
        `Currency: ${data.currency}${converted ? ` (converted from ${data.baseCurrency} at each day's ECB rate)` : ""}`,
        `Dates: ${formatDate(from)} – ${formatDate(to)}${data.to ? ` · Data as of ${formatDate(data.to)}` : ""}`,
        `Filters: ${[
          ...(settings.assetClasses ?? []).map((code) => classes.names[code] ?? code),
          ...(settings.sectors ?? []),
          ...(settings.countries ?? []),
        ].join(", ") || "none"}${settings.hideEmptyRows ? " · empty rows hidden" : ""}`,
      ]
    : [];
  const exportPanels = async (ids: string[]) => {
    const sheets = registry.sheets(ids);
    if (sheets.length === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadWorkbook(customerId, client?.fullName ?? "Client", tabName, about, sheets);
      setExportOpen(false);
    } catch (caught) {
      setExportError(caught instanceof ApiError ? caught.message : "The file could not be made. Try again.");
    } finally {
      setExporting(false);
    }
  };
  const failed = change.error ?? remove.error;

  return (
    <div className="space-y-5">
      <Link to="/book" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Client list
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{client?.fullName ?? "…"}</h1>
        <DateRange from={from} to={to} max={today}
          onChange={(nextFrom, nextTo) => {
            setFrom(nextFrom);
            setTo(nextTo);
            setRange(null);
          }} />
        <div className="relative">
          <button type="button" aria-expanded={filterOpen} disabled={!context} onClick={() => setFilterOpen((was) => !was)}
            className={cn("inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm",
              filtering ? "border-primary-600 text-primary-700" : "border-line text-ink")}>
            <Filter aria-hidden="true" className="size-4" />
            Filter{filtering ? ` · ${filtering}` : ""}
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
          {context && (
            <Popover open={filterOpen} onClose={() => setFilterOpen(false)} className="top-12 left-0 w-80">
              <div className="space-y-3">
                <FilterFields settings={settings} context={context}
                  onChange={(next) => setQuick({ ...NO_SETTINGS, assetClasses: next.assetClasses, sectors: next.sectors, countries: next.countries })} />
                <p className="text-xs text-ink-muted">Applies to every panel now; it is not saved. To keep a filter, set it in View setting while editing the view.</p>
                {quick && (
                  <Button variant="secondary" size="sm" onClick={() => setQuick(null)}>Clear</Button>
                )}
              </div>
            </Popover>
          )}
        </div>
        {data && (
          <CurrencyPicker base={data.baseCurrency} shown={shownIn ?? data.baseCurrency}
            onPick={(code) => setPicked(code === data.baseCurrency ? null : { customerId, code })} />
        )}
        {converted && (
          <span className="inline-flex items-center gap-2 rounded-full border border-access-view/30 bg-access-view-soft px-3 py-1 text-xs text-ink-soft">
            Shown in {data.currency} · client&apos;s currency is {data.baseCurrency}
            <button type="button" onClick={() => setPicked(null)} className="font-semibold text-primary-700 hover:underline">
              Back to {data.baseCurrency}
            </button>
          </span>
        )}
        {context && !editing && (
          <div className="relative">
            <button type="button" aria-expanded={exportOpen}
              onClick={() => {
                setExportable(registry.list());
                setLeftOut([]);
                setExportError(null);
                setExportOpen((was) => !was);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink hover:border-ink-muted/50">
              <Download aria-hidden="true" className="size-4" />
              Export to Excel
            </button>
            <Popover open={exportOpen} onClose={() => setExportOpen(false)} className="top-12 right-0 w-80">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Export “{tabName}”</p>
                <fieldset className="space-y-1.5">
                  <legend className="sr-only">Panels to export</legend>
                  {exportable.map((one) => (
                    <label key={one.id} className="flex items-center gap-2 text-sm text-ink-soft">
                      <input type="checkbox" checked={!leftOut.includes(one.id)}
                        onChange={(event) => setLeftOut((was) => (event.target.checked ? was.filter((id) => id !== one.id) : [...was, one.id]))} />
                      {one.name}
                    </label>
                  ))}
                </fieldset>
                <p className="text-xs text-ink-muted">
                  In {data?.currency} · {formatDate(from)} – {formatDate(to)} · as on screen, with the filter applied. One sheet per panel.
                </p>
                {exportError && <Alert tone="danger">{exportError}</Alert>}
                <Button size="sm" disabled={exporting || exportable.every((one) => leftOut.includes(one.id))}
                  onClick={() => void exportPanels(exportable.map((one) => one.id).filter((id) => !leftOut.includes(id)))}>
                  {exporting ? "Making the file…" : "Download .xlsx"}
                </Button>
              </div>
            </Popover>
          </div>
        )}
      </div>

      <div className="flex items-end gap-1 overflow-x-auto border-b border-line">
        <div role="tablist" aria-label="Views" className="flex gap-1">
          {views.map((view) => {
            const on = !offBoard && view.id === active.id && editing?.mode !== "new";
            return (
              <Fragment key={view.id}>
                <div className={cn("-mb-px flex items-center border-b-2", on ? "border-primary-600" : "border-transparent")}>
                  <button type="button" role="tab" aria-selected={on} disabled={Boolean(editing)}
                    onClick={() => { setActiveId(view.id); setQuick(null); }}
                    className={cn("px-3 py-2 text-sm font-semibold whitespace-nowrap", on ? "text-primary-700" : "text-ink-muted hover:text-ink")}>
                    {view.name}
                  </button>
                  {on && !editing && (
                    <>
                      <button type="button" aria-label={`Edit ${view.name}`} title="Edit this view" disabled={!data}
                        onClick={() => startEditing("edit")}
                        className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink">
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </button>
                      {!view.id.startsWith("platform-") && (
                        <button type="button" aria-label={`Delete ${view.name}`} title="Delete this view" onClick={() => setDeleting(view)}
                          className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-canvas hover:text-danger">
                          <X aria-hidden="true" className="size-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                {view.id === "platform-performance" && (
                  <div className={cn("-mb-px border-b-2", owning ? "border-primary-600" : "border-transparent")}>
                    <button type="button" role="tab" aria-selected={owning} disabled={Boolean(editing)}
                      onClick={() => { setActiveId(OWNED_ASSETS); setQuick(null); }}
                      className={cn("px-3 py-2 text-sm font-semibold whitespace-nowrap", owning ? "text-primary-700" : "text-ink-muted hover:text-ink")}>
                      Owned assets
                    </button>
                  </div>
                )}
                {view.id === "platform-performance" && seesFamily && (
                  <div className={cn("-mb-px border-b-2", familying ? "border-primary-600" : "border-transparent")}>
                    <button type="button" role="tab" aria-selected={familying} disabled={Boolean(editing)}
                      onClick={() => { setActiveId(FAMILY); setQuick(null); }}
                      className={cn("px-3 py-2 text-sm font-semibold whitespace-nowrap", familying ? "text-primary-700" : "text-ink-muted hover:text-ink")}>
                      Family
                    </button>
                  </div>
                )}
                {view.id === "platform-overall" && (
                  <div className={cn("-mb-px border-b-2", explaining ? "border-primary-600" : "border-transparent")}>
                    <button type="button" role="tab" aria-selected={explaining} disabled={Boolean(editing)}
                      onClick={() => { setActiveId(EXPLAINER); setQuick(null); }}
                      className={cn("px-3 py-2 text-sm font-semibold whitespace-nowrap", explaining ? "text-primary-700" : "text-ink-muted hover:text-ink")}>
                      Explainer
                    </button>
                  </div>
                )}
              </Fragment>
            );
          })}
          {editing?.mode === "new" && (
            <div className="-mb-px border-b-2 border-primary-600">
              <span role="tab" aria-selected className="block px-3 py-2 text-sm font-semibold whitespace-nowrap text-primary-700">New view</span>
            </div>
          )}
        </div>
        <button type="button" aria-label="New view" title="New view" disabled={Boolean(editing) || !data} onClick={() => startEditing("new")}
          className="mb-1 ml-1 grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40">
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>

      {overview.isError && <Alert tone="danger">{overview.error.message}</Alert>}
      {failed && <Alert tone="danger">{failed.message}</Alert>}
      {!context && !overview.isError && <p className="py-10 text-center text-sm text-ink-muted">Reading the portfolio…</p>}

      <ExportRegistryContext.Provider value={registry}>
      <ExportActionContext.Provider value={(ids) => void exportPanels(ids)}>
      {context && explaining && !editing && (
        <div role="tabpanel" aria-label="Explainer">
          <ExportSlot.Provider value={EXPLAINER_SLOT}>
            <ExplainerTab context={context} />
          </ExportSlot.Provider>
        </div>
      )}
      {context && owning && !editing && (
        <div role="tabpanel" aria-label="Owned assets">
          <ExportSlot.Provider value={OWNED_SLOT}>
            <OwnedAssetsTab context={context} people={people} />
          </ExportSlot.Provider>
        </div>
      )}
      {context && familying && seesFamily && !editing && (
        <div role="tabpanel" aria-label="Family">
          <ExportSlot.Provider value={FAMILY_SLOT}>
            <FamilyTab context={context} family={family} />
          </ExportSlot.Provider>
        </div>
      )}
      {context && (!offBoard || editing) && (
        <div role="tabpanel" aria-label={active.name}>
          <OverviewBoard
            key={editing ? `${active.id}-${editing.session}` : active.id}
            definition={definition}
            editing={Boolean(editing)}
            context={context}
            saving={change.isPending || create.isPending}
            canSave={editing?.mode === "edit"}
            onCancel={() => setEditing(null)}
            onSave={(next) =>
              own
                ? change.mutate({ id: active.id, data: { name: active.name, definition: next } })
                // Saving one of the platform's views keeps the PM's own version of it, under the same name.
                : create.mutate({ data: { name: active.name, definition: next } })}
            onSaveAs={(next) => { create.reset(); setSavingAs(next); }}
          />
        </div>
      )}
      </ExportActionContext.Provider>
      </ExportRegistryContext.Provider>

      {savingAs && (
        <SaveAsDialog busy={create.isPending} error={create.error?.message ?? null}
          onClose={() => setSavingAs(null)}
          onSave={(name) => create.mutate({ data: { name, definition: savingAs } })} />
      )}
      <Dialog open={deleting !== null}
        title={deleting && PLATFORM_NAMES.includes(deleting.name) ? `Put ${deleting.name} back as it was?` : `Delete “${deleting?.name ?? ""}”?`}
        description={deleting && PLATFORM_NAMES.includes(deleting.name)
          ? "Your changes to it go, on every client, and it is laid out as the platform has it. The clients and their figures are not touched."
          : "The view goes from your tabs on every client. The clients and their figures are not touched."}
        onClose={() => setDeleting(null)}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => deleting && remove.mutate({ id: deleting.id })}>
            {remove.isPending ? "Deleting…" : deleting && PLATFORM_NAMES.includes(deleting.name) ? "Put it back" : "Delete view"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/** Both dates in one box, opening onto a calendar for each. */
function DateRange({ from, to, max, onChange }: {
  from: string;
  to: string;
  max: Date;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      // The calendars float outside the box, so a press inside one is not a press away.
      const target = event.target as HTMLElement;
      if (box.current?.contains(target) || target.closest("[role=dialog]")) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-label={`Dates: ${formatDate(from)} to ${formatDate(to)}`}
        onClick={() => setOpen((was) => !was)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink tabular-nums hover:border-ink-muted/50">
        <CalendarDays aria-hidden="true" className="size-4 text-ink-muted" />
        <span>{formatDate(from)}</span>
        <span className="text-ink-muted">–</span>
        <span>{formatDate(to)}</span>
      </button>
      {open && (
        <div className="absolute top-12 left-0 z-20 grid w-[22rem] grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-4 shadow-lg">
          <div>
            <span className="text-xs font-semibold text-ink-muted">From</span>
            <div className="mt-1">
              <DateInput id="view-from" name="from" value={from} min={new Date(2000, 0, 1)} max={new Date(to)}
                onChange={(value) => value && onChange(value, to)} />
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-ink-muted">To</span>
            <div className="mt-1">
              <DateInput id="view-to" name="to" value={to} min={new Date(from)} max={max}
                onChange={(value) => value && onChange(from, value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
