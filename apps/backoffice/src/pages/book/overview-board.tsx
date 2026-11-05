import type { PanelConfig, ViewCell, ViewDefinition, ViewSettings } from "@atomprive/api-client/backoffice";
import { Button, cn } from "@atomprive/ui";
import { ArrowLeftToLine, ArrowRightToLine, BarChart3, ChevronDown, ChartLine, Download, EllipsisVertical, GripHorizontal, Hash, Pencil, PieChart, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import { EditChartDialog, EditFiguresDialog, EditPortfolioTableDialog, EditTableDialog, Popover, ViewSettingPanel } from "./overview-dialogs";
import { ExportActionContext, ExportSlot } from "./overview-export";
import { ChartPanel, FiguresPanel, HoldingsTablePanel, PerformancePanel, PortfolioTablePanel, type PanelContext } from "./overview-panels";
import {
  DEFAULT_GROUPINGS,
  DEFAULT_PORTFOLIO_ATTRIBUTES,
  LEAST,
  LIBRARY,
  NO_SETTINGS,
  chartTitle,
  config,
  placeBelow,
  type Kind,
  type LibraryEntry,
} from "./overview-model";

const ROW = 36;
const GAP = 16;

/**
 * A client's overview as a board of panels the PM can rearrange and set up.
 *
 * <p>Nothing moves until the PM asks to edit, and nothing is kept until they save — cancelling puts the
 * board back exactly as it was. Every change while editing is made to a draft of the whole view, so the
 * panels, their settings and the view's own settings are saved together or not at all.
 */
export function OverviewBoard({ definition, editing, context, saving, canSave, onCancel, onSave, onSaveAs }: {
  definition: ViewDefinition;
  editing: boolean;
  context: PanelContext;
  saving: boolean;
  /** Whether Save is offered: it is while editing a view, and not while making a new one, which only has a name once it is saved as. */
  canSave: boolean;
  onCancel: () => void;
  onSave: (definition: ViewDefinition) => void;
  onSaveAs: (definition: ViewDefinition) => void;
}) {
  // Nothing until the PM changes something, which is also what keeps Save shut until there is something to
  // save. The page drops the board's state when editing ends, either way.
  const [draft, setDraft] = useState<ViewDefinition | null>(null);
  const [editingPanel, setEditingPanel] = useState<ViewCell | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  // A portfolio table opened out across the board, as the reference table's arrow opens it, with the panels
  // beside it put away until it is closed again. Only while reading: it is not part of the view.
  const [wide, setWide] = useState<string | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  const current = (editing && draft) || definition;
  const opened = editing ? undefined : current.cells.find((cell) => cell.id === wide);
  const shown = opened
    ? current.cells
        .filter((cell) => cell.id === opened.id || cell.y >= opened.y + opened.h || cell.y + cell.h <= opened.y)
        .map((cell) => (cell.id === opened.id ? { ...cell, x: 0, w: 12 } : cell))
    : current.cells;
  const settings: ViewSettings = current.settings ?? NO_SETTINGS;
  const change = (next: (was: ViewDefinition) => ViewDefinition) => setDraft((was) => next(was ?? definition));
  const setCells = (next: (cells: ViewCell[]) => ViewCell[]) => change((was) => ({ ...was, cells: next(was.cells) }));
  // A view's own filter replaces the page's only while it is being edited, so what is drawn is what will be
  // saved; at rest the page has already read the saved one.
  const panelContext: PanelContext = editing ? { ...context, sources: { ...context.sources, settings } } : context;

  const add = (entry: LibraryEntry) => {
    setLibraryOpen(false);
    if (entry.unavailable) return;
    const cfg = entry.kind === "figures"
      ? config({ figures: ["MARKET_VALUE", "ASSETS", "LIABILITIES", "TWR_YTD"] })
      : config({ title: entry.label, ...entry.config });
    setCells((cells) => [...cells, placeBelow(cells, entry.kind, cfg)]);
  };
  const newChart = () => {
    setLibraryOpen(false);
    const cell = placeBelow(current.cells, "chart", config({ attribute: "MARKET_VALUE", grouping: "ASSET_CLASS", chartType: "PIE" }));
    setCells((cells) => [...cells, cell]);
    setEditingPanel(cell);
  };
  const applyPanel = (cfg: PanelConfig) => {
    const id = editingPanel?.id;
    setEditingPanel(null);
    setCells((cells) => cells.map((cell) => (cell.id === id ? { ...cell, config: cfg } : cell)));
  };

  return (
    <div className="space-y-4">
      {editing && (
        <div className="relative flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-canvas px-3 py-2">
          <div className="relative">
            <Button variant="secondary" size="sm" aria-expanded={libraryOpen} onClick={() => setLibraryOpen((was) => !was)}>
              <Plus aria-hidden="true" /> Chart
            </Button>
            <Popover open={libraryOpen} onClose={() => setLibraryOpen(false)} className="top-10 left-0 w-80 p-2">
              <ChartLibrary onPick={add} onNew={newChart} />
            </Popover>
          </div>
          <div className="relative">
            <Button variant="secondary" size="sm" aria-expanded={tablesOpen} onClick={() => setTablesOpen((was) => !was)}>
              <Plus aria-hidden="true" /> Table
            </Button>
            <Popover open={tablesOpen} onClose={() => setTablesOpen(false)} className="top-10 left-0 w-72 p-1">
              <button type="button" role="menuitem"
                onClick={() => {
                  setTablesOpen(false);
                  setCells((cells) => [...cells, placeBelow(cells, "portfolioTable",
                    config({ groupings: DEFAULT_GROUPINGS, columns: DEFAULT_PORTFOLIO_ATTRIBUTES, tableType: "STANDARD" }))]);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas">
                <span className="font-semibold">Portfolio table</span>
                <span className="block text-xs text-ink-muted">By asset class, then security, with a total</span>
              </button>
              <button type="button" role="menuitem"
                onClick={() => {
                  setTablesOpen(false);
                  setCells((cells) => [...cells, placeBelow(cells, "table", config({ title: "Holdings" }))]);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas">
                <span className="font-semibold">Holdings list</span>
                <span className="block text-xs text-ink-muted">Every line, with the columns you choose</span>
              </button>
            </Popover>
          </div>
          <div className="relative">
            <Button variant="secondary" size="sm" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((was) => !was)}>
              <Settings2 aria-hidden="true" /> View setting
            </Button>
            <Popover open={settingsOpen} onClose={() => setSettingsOpen(false)} className="top-10 left-0">
              <ViewSettingPanel settings={settings} context={panelContext}
                onClose={() => setSettingsOpen(false)}
                onApply={(next) => {
                  setSettingsOpen(false);
                  change((was) => ({ ...was, settings: next }));
                }} />
            </Popover>
          </div>
          <span className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" disabled={saving} onClick={onCancel}>Cancel</Button>
            <Button variant={canSave ? "secondary" : "primary"} size="sm" disabled={saving} onClick={() => onSaveAs(current)}>Save as</Button>
            {canSave && (
              <Button size="sm" disabled={saving || !draft} onClick={() => draft && onSave(draft)}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </span>
        </div>
      )}

      <div ref={containerRef} className={cn(editing && "board-editing")}>
        {mounted && (
          <ReactGridLayout
            width={width}
            layout={toGrid(shown)}
            gridConfig={{ cols: 12, rowHeight: ROW, margin: [GAP, GAP], containerPadding: [0, 0] }}
            dragConfig={{ enabled: editing, handle: ".panel-grip", cancel: ".panel-menu" }}
            resizeConfig={{ enabled: editing, handles: ["se"] }}
            onLayoutChange={(next) => {
              if (!editing) return;
              // Only what moved: the grid reports its layout on every draw, and a draft started by a draw
              // that changed nothing would open Save on a view nobody touched.
              const moved = next.some((item) => {
                const cell = current.cells.find((one) => one.id === item.i);
                return !cell || cell.x !== item.x || cell.y !== item.y || cell.w !== item.w || cell.h !== item.h;
              });
              if (moved) setCells((cells) => cells.map((cell) => {
                const at = next.find((item) => item.i === cell.id);
                return at ? { ...cell, x: at.x, y: at.y, w: at.w, h: at.h } : cell;
              }));
            }}
          >
            {shown.map((cell) => (
              <div key={cell.id}>
                <PanelFrame cell={cell} editing={editing} context={panelContext}
                  onEdit={() => setEditingPanel(cell)}
                  onRemove={() => setCells((cells) => cells.filter((one) => one.id !== cell.id))} />
                {!editing && cell.kind === "portfolioTable" && (cell.id === wide || besideIt(cell, current.cells)) && (
                  <button type="button" onClick={() => setWide(cell.id === wide ? null : cell.id)}
                    aria-label={cell.id === wide ? "Bring back the panels beside the table" : "Open the table across the page"}
                    title={cell.id === wide ? "Bring back the panels beside the table" : "Open the table across the page"}
                    className="absolute top-24 -right-4 z-10 grid h-12 w-6 place-items-center rounded-lg border border-line bg-white text-ink-muted shadow-sm hover:text-ink">
                    {cell.id === wide ? <ArrowLeftToLine aria-hidden="true" className="size-4" /> : <ArrowRightToLine aria-hidden="true" className="size-4" />}
                  </button>
                )}
              </div>
            ))}
          </ReactGridLayout>
        )}
      </div>

      {editingPanel?.kind === "figures" && (
        <EditFiguresDialog cfg={editingPanel.config} currency={context.sources.overview.currency}
          onClose={() => setEditingPanel(null)} onApply={applyPanel} />
      )}
      {editingPanel?.kind === "portfolioTable" && (
        <EditPortfolioTableDialog cfg={editingPanel.config} currency={context.sources.overview.currency}
          onClose={() => setEditingPanel(null)} onApply={applyPanel} />
      )}
      {editingPanel?.kind === "table" && (
        <EditTableDialog cfg={editingPanel.config} onClose={() => setEditingPanel(null)} onApply={applyPanel} />
      )}
      {editingPanel?.kind === "chart" && editingPanel.config && (
        <EditChartDialog cfg={editingPanel.config} context={panelContext} onClose={() => setEditingPanel(null)} onApply={applyPanel} />
      )}
    </div>
  );
}

/** Whether any panel stands beside this one, on the rows it covers. */
function besideIt(cell: ViewCell, cells: ViewCell[]) {
  return cells.some((one) => one.id !== cell.id && one.y < cell.y + cell.h && one.y + one.h > cell.y);
}

function toGrid(cells: ViewCell[]): Layout {
  return cells.map((cell) => ({ i: cell.id, x: cell.x, y: cell.y, w: cell.w, h: cell.h, ...LEAST[cell.kind as Kind] }));
}

/** One panel: its title, what it draws, and — while editing — its grip, its ✏️ and its menu. */
function PanelFrame({ cell, editing, context, onEdit, onRemove }: {
  cell: ViewCell;
  editing: boolean;
  context: PanelContext;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const kind = cell.kind as Kind;
  const title = kind === "chart" ? chartTitle(cell.config) : kind === "table" ? (cell.config?.title || "Holdings") : null;
  // Top 3 securities has nothing to set: it is always the three largest holdings, as on the reference
  // screen, which gives it a menu and no pencil.
  const editable = kind === "figures" || kind === "table" || kind === "portfolioTable" || (kind === "chart" && cell.config?.attribute !== "TOP_SECURITIES");
  const said = title ?? (kind === "figures" ? "Figures" : kind === "portfolioTable" ? "Portfolio table" : "Performance and net worth");
  const slot = useMemo(() => ({ id: cell.id, name: said }), [cell.id, said]);
  const exportPanels = useContext(ExportActionContext);
  // Outside editing, a panel's menu exports it. The figures across the top have no room for one; they go with
  // the whole tab.
  const exportable = !editing && exportPanels && kind !== "figures";
  const exportMenu = exportable && (
    <ExportMenu label={said} onExport={() => exportPanels([cell.id])} />
  );
  return (
    <section
      aria-label={title ?? (kind === "figures" ? "Figures" : kind === "portfolioTable" ? "Portfolio table" : "Performance and net worth since inception")}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl bg-white",
        editing ? "border-2 border-dashed border-primary-600/50" : "border border-line",
        kind === "figures" ? "p-0" : kind === "portfolioTable" ? "px-3 pt-3 pb-3" : "px-5 py-4",
      )}
    >
      {editing && (
        <>
          <span className="panel-grip absolute top-0 left-1/2 z-10 -translate-x-1/2 cursor-grab px-3 py-0.5 text-ink-muted active:cursor-grabbing" title="Drag to move">
            <GripHorizontal aria-hidden="true" className="size-4" />
            <span className="sr-only">Move {title ?? "this panel"}</span>
          </span>
          <div className="panel-menu absolute top-2 right-2 z-10 flex gap-1">
            {editable && (
              <button type="button" aria-label={`Edit ${title ?? "the figures"}`} onClick={onEdit}
                className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink-muted hover:text-ink">
                <Pencil aria-hidden="true" className="size-4" />
              </button>
            )}
            <PanelMenu onRemove={onRemove} label={title ?? "this panel"} />
          </div>
        </>
      )}
      {exportMenu && kind !== "portfolioTable" && <div className="absolute top-2 right-2 z-10">{exportMenu}</div>}
      {exportMenu && kind === "portfolioTable" && <div className="mb-2 flex shrink-0 justify-end">{exportMenu}</div>}
      {title && <h2 className="mb-2 shrink-0 truncate pr-20 text-base font-bold">{title}</h2>}
      <ExportSlot.Provider value={slot}>
      <div className="min-h-0 flex-1">
        {kind === "figures" && <FiguresPanel cfg={cell.config} context={context} />}
        {kind === "performance" && <PerformancePanel context={context} />}
        {kind === "chart" && cell.config && <ChartPanel cfg={cell.config} context={context} />}
        {kind === "table" && <HoldingsTablePanel cfg={cell.config} context={context} />}
        {kind === "portfolioTable" && <PortfolioTablePanel cfg={cell.config} context={context} />}
      </div>
      </ExportSlot.Provider>
    </section>
  );
}

/** A panel's menu while the board is being read: for now, exporting the panel. */
function ExportMenu({ onExport, label }: { onExport: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-label={`Options for ${label}`} aria-expanded={open} onClick={() => setOpen((was) => !was)}
        className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink">
        <EllipsisVertical aria-hidden="true" className="size-4" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="top-9 right-0 w-44 p-1">
        <button type="button" role="menuitem" onClick={() => { setOpen(false); onExport(); }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-canvas">
          <Download aria-hidden="true" className="size-4" /> Export to Excel
        </button>
      </Popover>
    </div>
  );
}

function PanelMenu({ onRemove, label }: { onRemove: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-label={`Options for ${label}`} aria-expanded={open} onClick={() => setOpen((was) => !was)}
        className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink-muted hover:text-ink">
        <EllipsisVertical aria-hidden="true" className="size-4" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="top-9 right-0 w-36 p-1">
        <button type="button" role="menuitem" onClick={onRemove}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-canvas">
          <Trash2 aria-hidden="true" className="size-4" /> Delete
        </button>
      </Popover>
    </div>
  );
}

const ICONS = { bar: BarChart3, line: ChartLine, pie: PieChart, number: Hash } as const;

/**
 * Everything a PM can put on the board, grouped as the firm's reference screen groups it, with a search.
 * What cannot be drawn yet is listed, greyed, with the reason.
 */
function ChartLibrary({ onPick, onNew }: { onPick: (entry: LibraryEntry) => void; onNew: () => void }) {
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<string[]>([]);
  const wanted = query.trim().toLowerCase();
  return (
    <div className="max-h-[28rem] overflow-y-auto">
      <label className="relative mb-1 block">
        <span className="sr-only">Search charts</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search"
          className="h-9 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm outline-none focus:border-primary-600" />
      </label>
      {LIBRARY.map((group) => {
        const entries = group.entries.filter((one) => !wanted || one.label.toLowerCase().includes(wanted));
        if (entries.length === 0) return null;
        const shut = closed.includes(group.group) && !wanted;
        return (
          <div key={group.group}>
            <button type="button" aria-expanded={!shut}
              onClick={() => setClosed((was) => (was.includes(group.group) ? was.filter((one) => one !== group.group) : [...was, group.group]))}
              className="flex w-full items-center gap-1.5 px-2 py-2 text-left text-sm font-bold">
              <ChevronDown aria-hidden="true" className={cn("size-4 text-ink-muted transition-transform", shut && "-rotate-90")} />
              {group.group}
            </button>
            {!shut && entries.map((entry) => {
              const Icon = ICONS[entry.icon];
              return (
                <button key={entry.label} type="button" role="menuitem" aria-disabled={Boolean(entry.unavailable) || undefined}
                  title={entry.unavailable} onClick={() => onPick(entry)}
                  className={cn("flex w-full items-start gap-2.5 rounded-lg py-2 pr-2 pl-7 text-left text-sm",
                    entry.unavailable ? "cursor-not-allowed text-ink-muted/60" : "hover:bg-canvas")}>
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-600" />
                  <span>
                    {entry.label}
                    {entry.unavailable && <span className="block text-xs">{entry.unavailable}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
      {(!wanted || "new chart custom component".includes(wanted)) && (
        <div className="mt-1 border-t border-line pt-1">
          <p className="px-2 py-2 text-sm font-bold">Custom component</p>
          <button type="button" role="menuitem" onClick={onNew}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-primary-700 hover:bg-canvas">
            <Plus aria-hidden="true" className="size-4" /> New chart
          </button>
        </div>
      )}
    </div>
  );
}
