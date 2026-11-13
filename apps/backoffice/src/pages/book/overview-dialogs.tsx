import { ApiError } from "@atomprive/api-client";
import { useListBenchmarks, type BenchmarkRow, type PanelConfig, type ViewSettings } from "@atomprive/api-client/backoffice";
import { Button, Dialog, Field, SelectInput, Switch, TextInput, cn } from "@atomprive/ui";
import { GripVertical, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { positionsOf } from "./overview-data";
import { ChartPanel, type PanelContext } from "./overview-panels";
import {
  ATTRIBUTES,
  CHART_TYPES,
  COLUMNS,
  DEFAULT_COLUMNS,
  DEFAULT_GROUPINGS,
  DEFAULT_PORTFOLIO_ATTRIBUTES,
  FIGURES,
  PORTFOLIO_ATTRIBUTES,
  PORTFOLIO_GROUPINGS,
  type PortfolioAttribute,
  type PortfolioGrouping,
  GROUPINGS,
  NO_HISTORY_BELOW_CLASS,
  TIME_RANGES,
  chartTitle,
  config,
  type Attribute,
  type ChartType,
  type Column,
  type Figure,
  type Grouping,
  type TimeRange,
} from "./overview-model";

/**
 * A list the PM puts in order by dragging, takes things out of, and adds to from what is left.
 *
 * <p>The figures panel and a table's columns are both this: a choice of things, in an order. Moving by the
 * keyboard is the up and down arrows on the grip, so the order is never mouse-only.
 */
function ReorderList<T extends string>({ items, labels, onChange, addLabel }: {
  items: T[];
  labels: Record<T, string>;
  onChange: (items: T[]) => void;
  addLabel: string;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const left = (Object.keys(labels) as T[]).filter((one) => !items.includes(one));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [taken] = next.splice(from, 1);
    next.splice(to, 0, taken!);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging !== null) move(dragging, index);
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
            className={cn("flex items-center gap-2 rounded-lg bg-canvas px-2 py-2 text-sm", dragging === index && "opacity-50")}
          >
            <button type="button" aria-label={`Move ${labels[item]}: use the up and down arrows`}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") { event.preventDefault(); move(index, index - 1); }
                if (event.key === "ArrowDown") { event.preventDefault(); move(index, index + 1); }
              }}
              className="cursor-grab rounded p-0.5 text-ink-muted focus-visible:outline-2 focus-visible:outline-primary-600">
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
            <span className="flex-1 font-medium">{labels[item]}</span>
            <button type="button" aria-label={`Take out ${labels[item]}`} disabled={items.length === 1}
              onClick={() => onChange(items.filter((one) => one !== item))}
              className="rounded p-1 text-ink-muted hover:bg-white hover:text-danger disabled:opacity-30">
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ol>
      {left.length > 0 && (
        <SelectInput aria-label={addLabel} value="" onChange={(event) => event.target.value && onChange([...items, event.target.value as T])}>
          <option value="">{addLabel}</option>
          {left.map((one) => (
            <option key={one} value={one}>{labels[one]}</option>
          ))}
        </SelectInput>
      )}
    </div>
  );
}

function Footer({ onCancel, onApply }: { onCancel: () => void; onApply: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={onApply}>Apply</Button>
    </div>
  );
}

/** The figures panel's own settings: which figures, in what order. */
export function EditFiguresDialog({ cfg, currency, onApply, onClose }: {
  cfg: PanelConfig | null | undefined;
  currency: string;
  onApply: (cfg: PanelConfig) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Figure[]>((cfg?.figures?.length ? cfg.figures : ["MARKET_VALUE", "ASSETS", "LIABILITIES", "TWR_YTD"]) as Figure[]);
  const labels = Object.fromEntries((Object.keys(FIGURES) as Figure[]).map((key) => [key, FIGURES[key](currency)])) as Record<Figure, string>;
  return (
    <Dialog open title="Edit component" description="Drag the figures into the order you want them, take any out, or add another." onClose={onClose}>
      <p className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Attributes</p>
      <ReorderList items={items} labels={labels} onChange={setItems} addLabel="Add a figure…" />
      <Footer onCancel={onClose} onApply={() => onApply({ ...(cfg ?? config()), figures: items })} />
    </Dialog>
  );
}

/** A holdings table's own settings: its title and its columns. */
export function EditTableDialog({ cfg, onApply, onClose }: {
  cfg: PanelConfig | null | undefined;
  onApply: (cfg: PanelConfig) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(cfg?.title ?? "Holdings");
  const [columns, setColumns] = useState<Column[]>((cfg?.columns?.length ? cfg.columns : DEFAULT_COLUMNS) as Column[]);
  // Apply with the title cleared marks the box in red rather than being greyed out.
  const [tried, setTried] = useState(false);
  const untitled = tried && !title.trim();
  const apply = () => {
    if (!title.trim()) {
      setTried(true);
      document.getElementById("table-title")?.focus();
      return;
    }
    onApply({ ...(cfg ?? config()), title: title.trim(), columns });
  };
  return (
    <Dialog open title="Edit table" description="Name the table, and choose its columns and their order." onClose={onClose}>
      <div className="space-y-4">
        <Field id="table-title" label="Title" error={untitled ? "Enter a title." : undefined}>
          <TextInput id="table-title" aria-invalid={untitled || undefined} value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Columns</p>
          <ReorderList items={columns} labels={COLUMNS} onChange={setColumns} addLabel="Add a column…" />
        </div>
      </div>
      <Footer onCancel={onClose} onApply={apply} />
    </Dialog>
  );
}

/**
 * A chart's own settings, with the chart drawn beside them as it will look.
 *
 * <p>Whatever cannot be drawn from what we hold is still listed, greyed, with the reason — so the PM can see
 * it is coming rather than wonder whether it exists.
 */
export function EditChartDialog({ cfg, context, onApply, onClose }: {
  cfg: PanelConfig;
  context: PanelContext;
  onApply: (cfg: PanelConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PanelConfig>(cfg);
  const [naming, setNaming] = useState(false);
  // A title that is only what the choices say follows them; one the PM typed stays as they typed it.
  const choose = (next: (was: PanelConfig) => PanelConfig) =>
    setDraft((was) => {
      const changed = next(was);
      const automatic = !was.title || was.title === chartTitle({ ...was, title: null });
      return automatic ? { ...changed, title: null } : changed;
    });
  const attribute = (draft.attribute ?? "MARKET_VALUE") as Attribute;
  const about = ATTRIBUTES[attribute];
  const pickAttribute = (next: Attribute) => {
    const to = ATTRIBUTES[next];
    choose((was) => ({
      ...was,
      attribute: next,
      grouping: to.groupings.length ? (to.groupings.includes(was.grouping as Grouping) ? was.grouping : to.groupings[0]!) : null,
      chartType: to.types.includes(was.chartType as ChartType) ? was.chartType : to.types[0]!,
      timeRange: to.ranged ? (was.timeRange ?? "DEFAULT") : null,
    }));
  };
  const title = chartTitle(draft);

  return (
    <Dialog open size="xl" title="Edit chart" onClose={onClose}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            {naming ? (
              <TextInput aria-label="Chart title" autoFocus value={draft.title ?? title} maxLength={80}
                onChange={(event) => setDraft((was) => ({ ...was, title: event.target.value }))}
                onBlur={() => setNaming(false)}
                onKeyDown={(event) => event.key === "Enter" && setNaming(false)} />
            ) : (
              <>
                <h3 className="text-base font-bold">{title}</h3>
                <button type="button" aria-label="Rename the chart" onClick={() => setNaming(true)}
                  className="rounded p-1 text-ink-muted hover:bg-canvas hover:text-ink">
                  <Pencil aria-hidden="true" className="size-4" />
                </button>
              </>
            )}
          </div>
          <div className="h-80 rounded-2xl border border-line p-4">
            <ChartPanel cfg={draft} context={context} />
          </div>
        </div>
        <div className="space-y-4">
          <Field id="chart-attribute" label="Attribute" required>
            <SelectInput id="chart-attribute" value={attribute} onChange={(event) => pickAttribute(event.target.value as Attribute)}>
              {(Object.keys(ATTRIBUTES) as Attribute[]).map((one) => (
                <option key={one} value={one}>{ATTRIBUTES[one].label}</option>
              ))}
            </SelectInput>
          </Field>
          <Field id="chart-grouping" label="Grouping" hint={about.groupings.length === 0 ? "This chart is not broken down." : undefined}>
            <SelectInput id="chart-grouping" value={draft.grouping ?? ""} disabled={about.groupings.length === 0}
              onChange={(event) => choose((was) => ({ ...was, grouping: event.target.value }))}>
              {about.groupings.length === 0 && <option value="">—</option>}
              {(Object.keys(GROUPINGS) as Grouping[])
                .filter((one) => about.groupings.length > 0 && (about.groupings.includes(one) || attribute === "NET_GAIN_LOSS"))
                .map((one) => (
                  <option key={one} value={one} disabled={!about.groupings.includes(one)}>
                    {about.groupings.includes(one) ? GROUPINGS[one] : `${GROUPINGS[one]} — ${NO_HISTORY_BELOW_CLASS}`}
                  </option>
                ))}
            </SelectInput>
          </Field>
          <Field id="chart-range" label="Chart time range" hint={about.ranged ? undefined : "Holdings are as they stand today."}>
            <SelectInput id="chart-range" value={draft.timeRange ?? "DEFAULT"} disabled={!about.ranged}
              onChange={(event) => choose((was) => ({ ...was, timeRange: event.target.value }))}>
              {(Object.keys(TIME_RANGES) as TimeRange[]).map((one) => (
                <option key={one} value={one}>{TIME_RANGES[one]}</option>
              ))}
            </SelectInput>
          </Field>
          <Field id="chart-type" label="Chart type" required>
            <SelectInput id="chart-type" value={draft.chartType ?? about.types[0]}
              onChange={(event) => choose((was) => ({ ...was, chartType: event.target.value }))}>
              {about.types.map((one) => (
                <option key={one} value={one}>{CHART_TYPES[one]}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>
      <Footer onCancel={onClose} onApply={() => onApply({ ...draft, title: draft.title?.trim() || null })} />
    </Dialog>
  );
}

/** Naming a new view. */
export function SaveAsDialog({ busy, error, onSave, onClose }: {
  busy: boolean;
  error: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  // Save with no name marks the box in red rather than being greyed out.
  const [tried, setTried] = useState(false);
  const unnamed = tried && !name.trim();
  return (
    <Dialog open title="Save as a new view" description="It gets its own tab, and opens the same way on every client you look after." onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) return onSave(name.trim());
          setTried(true);
          document.getElementById("view-name")?.focus();
        }}
        className="space-y-4"
      >
        <Field id="view-name" label="Name" required error={unnamed ? "Enter a name." : (error ?? undefined)}>
          <TextInput id="view-name" autoFocus aria-invalid={unnamed || undefined} value={name} maxLength={60} placeholder="Equities and cash"
            onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** A floating panel that closes when anything outside it is pressed. */
export function Popover({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      // A dropdown's own list floats outside the panel; a press inside it is not a press away.
      if (box.current?.contains(target) || target.closest("[role=listbox], [role=dialog]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={box} className={cn("absolute z-30 rounded-2xl border border-line bg-white p-4 shadow-lg", className)}>
      {children}
    </div>
  );
}

/** Chosen values shown as removable chips, with a dropdown to add more. */
function Chips({ id, label, options, chosen, onChange }: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  const left = options.filter((one) => !chosen.includes(one.value));
  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
              {options.find((one) => one.value === value)?.label ?? value}
              <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(chosen.filter((one) => one !== value))}>
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {left.length > 0 && (
        <SelectInput id={id} aria-label={`Add to ${label}`} value="" onChange={(event) => event.target.value && onChange([...chosen, event.target.value])}>
          <option value="">{chosen.length ? "Add another…" : "Every one"}</option>
          {left.map((one) => (
            <option key={one.value} value={one.value}>{one.label}</option>
          ))}
        </SelectInput>
      )}
    </div>
  );
}

/** Which asset classes, sectors and countries every panel reads. Shared by the header's Filter and View setting. */
export function FilterFields({ settings, onChange, context }: {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
  context: PanelContext;
}) {
  const lines = positionsOf(context.sources.holdings);
  const classes = (context.sources.holdings?.classes ?? []).map((one) => ({ value: one.assetClass, label: one.assetClassName }));
  const distinct = (values: (string | null)[]) =>
    [...new Set(values.filter((one): one is string => Boolean(one)))].sort().map((one) => ({ value: one, label: one }));
  return (
    <div className="space-y-3">
      <Chips id="filter-classes" label="Asset classes" options={classes} chosen={settings.assetClasses ?? []}
        onChange={(next) => onChange({ ...settings, assetClasses: next })} />
      <Chips id="filter-sectors" label="Sectors" options={distinct(lines.map((one) => one.sector))} chosen={settings.sectors ?? []}
        onChange={(next) => onChange({ ...settings, sectors: next })} />
      <Chips id="filter-countries" label="Countries" options={distinct(lines.map((one) => one.countryCode))} chosen={settings.countries ?? []}
        onChange={(next) => onChange({ ...settings, countries: next })} />
    </div>
  );
}

/** The view's own settings: what it reads, what it hides, and what it is compared with. */
export function ViewSettingPanel({ settings, context, onApply, onClose }: {
  settings: ViewSettings;
  context: PanelContext;
  onApply: (next: ViewSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ViewSettings>(settings);
  const benchmarks = useListBenchmarks<BenchmarkRow[], ApiError>({ query: { staleTime: 300_000 } });
  const chosen = (draft.benchmarks ?? []).map(String);
  const left = (benchmarks.data ?? []).filter((one) => !chosen.includes(one.id));
  return (
    <div className="w-80 space-y-4">
      <h3 className="text-base font-bold">Edit view</h3>
      <FilterFields settings={draft} onChange={setDraft} context={context} />
      <Field id="closed-positions" label="Closed positions display" hint="Needs trades from the custodian feed: closed positions are not recorded yet.">
        <SelectInput id="closed-positions" value="ALL" disabled>
          <option value="ALL">Show all closed positions</option>
        </SelectInput>
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium" id="hide-empty">Hide empty rows</span>
        <Switch on={draft.hideEmptyRows} label="Hide empty rows" onLabel="Yes" offLabel="No"
          onChange={(on) => setDraft((was) => ({ ...was, hideEmptyRows: on }))} />
      </div>
      <div className="space-y-1.5">
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Benchmarks</p>
        {chosen.map((id) => (
          <div key={id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-1.5 text-sm">
            <span>{benchmarks.data?.find((one) => one.id === id)?.name ?? "Benchmark"}</span>
            <button type="button" aria-label="Remove benchmark" onClick={() => setDraft((was) => ({ ...was, benchmarks: chosen.filter((one) => one !== id) }))}
              className="text-ink-muted hover:text-danger"><X aria-hidden="true" className="size-4" /></button>
          </div>
        ))}
        {benchmarks.data && benchmarks.data.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
            No benchmarks have been entered yet. Once a benchmark and its levels are on the Benchmarks screen, it can be added here.
          </p>
        ) : left.length > 0 ? (
          <SelectInput aria-label="Add benchmarks" value=""
            onChange={(event) => event.target.value && setDraft((was) => ({ ...was, benchmarks: [...chosen, event.target.value] }))}>
            <option value="">+ Add benchmarks</option>
            {left.map((one) => (
              <option key={one.id} value={one.id}>{one.name}{one.levels === 0 ? " (no levels yet)" : ""}</option>
            ))}
          </SelectInput>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => onApply(draft)}>Apply</Button>
      </div>
    </div>
  );
}

/**
 * A portfolio table's own settings: what it nests by, and which figures it shows.
 *
 * <p>Security is always the innermost level when it is chosen, because a holding has nothing under it.
 */
export function EditPortfolioTableDialog({ cfg, currency, onApply, onClose }: {
  cfg: PanelConfig | null | undefined;
  currency: string;
  onApply: (cfg: PanelConfig) => void;
  onClose: () => void;
}) {
  const [groupings, setGroupings] = useState<PortfolioGrouping[]>((cfg?.groupings?.length ? cfg.groupings : DEFAULT_GROUPINGS) as PortfolioGrouping[]);
  const [columns, setColumns] = useState<PortfolioAttribute[]>((cfg?.columns?.length ? cfg.columns : DEFAULT_PORTFOLIO_ATTRIBUTES) as PortfolioAttribute[]);
  const attributeLabels = Object.fromEntries((Object.keys(PORTFOLIO_ATTRIBUTES) as PortfolioAttribute[]).map((key) => [key, PORTFOLIO_ATTRIBUTES[key](currency)])) as Record<PortfolioAttribute, string>;
  const ordered = (next: PortfolioGrouping[]) => [...next.filter((one) => one !== "SECURITY"), ...next.filter((one) => one === "SECURITY")];
  return (
    <Dialog open title="Edit table" onClose={onClose}>
      <div className="space-y-4">
        <Field id="table-type" label="Table type" hint="Time series needs values per period for each holding, which the custodian feed will send.">
          <SelectInput id="table-type" value="STANDARD" onChange={() => undefined}>
            <option value="STANDARD">Standard</option>
            <option value="TIME_SERIES" disabled>Time series — needs the custodian feed</option>
          </SelectInput>
        </Field>
        <Field id="table-breakdown" label="Breakdown method">
          <SelectInput id="table-breakdown" value="ASSETS" onChange={() => undefined}>
            <option value="ASSETS">Assets &amp; accounts</option>
            <option value="METRICS" disabled>Sub-metrics — needs the custodian feed</option>
          </SelectInput>
        </Field>
        <div>
          <p className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Grouping</p>
          <ReorderList items={groupings} labels={PORTFOLIO_GROUPINGS} onChange={(next) => setGroupings(ordered(next))} addLabel="Add a grouping…" />
        </div>
        <div>
          <p className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Attributes</p>
          <ReorderList items={columns} labels={attributeLabels} onChange={setColumns} addLabel="Add an attribute…" />
        </div>
      </div>
      <Footer onCancel={onClose} onApply={() => onApply({ ...(cfg ?? config()), groupings, columns, tableType: "STANDARD" })} />
    </Dialog>
  );
}
