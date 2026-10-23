import { ApiError } from "@atomprive/api-client";
import {
  getListAssetClassesQueryKey,
  useAddAssetClass,
  useListAssetClasses,
  useRenameAssetClass,
  useRetireAssetClass,
  type AssetClassRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { hasAuthority } from "../../lib/permissions";
import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatDateTime } from "../../lib/labels";

type Notice = { tone: "success" | "danger"; message: string };

/**
 * The columns of the full list a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The class is not among them: it carries the code every figure is stored under, and a row that does
 * not say which class it is cannot be renamed or retired from. Neither is the pair of buttons at the end,
 * which has no heading to take hold of.
 *
 * <p>Only the full list has columns at all. The lean one is a vocabulary read in three columns of names,
 * so there is nothing in it to arrange.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  /** The ink the cell is written in, where it is quieter than the name of the class. */
  tone?: string;
  nowrap?: boolean;
  cell: (row: AssetClassRow) => ReactNode;
}[] = [
  {
    id: "short",
    label: "Short",
    align: "left",
    tone: "text-ink-soft",
    cell: (row) => row.shortName,
  },
  {
    id: "models",
    label: "Models",
    align: "right",
    tone: "text-ink-soft",
    cell: (row) => row.models,
  },
  {
    id: "clients",
    label: "Clients",
    align: "right",
    tone: "text-ink-soft",
    cell: (row) => row.clients,
  },
  {
    id: "lastChanged",
    label: "Last changed",
    align: "left",
    tone: "text-xs text-ink-muted",
    nowrap: true,
    cell: (row) => `${formatDateTime(row.updatedAt)}${row.updatedBy ? ` · ${row.updatedBy}` : ""}`,
  },
];

/**
 * The firm's own list of asset classes (A3.5 #6, R102). Every model, holding and valuation is counted under
 * one of these; they were compiled into the platform until now, so a class the firm started using meant a
 * release.
 *
 * <p>Nothing is ever deleted here, only retired. A valuation written last year still names its class, and a
 * report that cannot say what a figure was counted under is not a report.
 */
export function AssetClassesTab({ lean = false }: {
  /**
   * Stripped to what somebody setting a plan up needs: the names, a way to add one and a way to correct
   * one. How many models and clients hold a class, when it last changed and whether it may be retired are
   * the Admin's questions, asked on the Admin's own screen.
   */
  lean?: boolean;
}) {
  const user = useStaffUser();
  // Read by anybody who may see a portfolio; changed by the desks the firm gave the classes to. The tab
  // used to sit only on the Admin's Config screen, where everybody who could open it could also change
  // it; on Portfolio settings that is no longer true.
  const mayChange = hasAuthority(user, "MANAGE_ASSET_CLASSES:CHANGE");
  const queryClient = useQueryClient();
  const listed = useListAssetClasses<AssetClassRow[], ApiError>();
  const [notice, setNotice] = useState<Notice>();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string>();
  /** The name being typed over, where a name is corrected in its own place on the list. */
  const [typedName, setTypedName] = useState("");

  function afterChange(message: string) {
    setNotice({ tone: "success", message });
    setAdding(false);
    setEditing(undefined);
    void queryClient.invalidateQueries({ queryKey: getListAssetClassesQueryKey() });
  }

  function refused(error: ApiError) {
    setNotice({ tone: "danger", message: error.message });
  }

  const add = useAddAssetClass<ApiError>({
    mutation: { onSuccess: (one) => afterChange(`Added ${one.name}.`), onError: refused },
  });
  const rename = useRenameAssetClass<ApiError>({
    mutation: { onSuccess: (one) => afterChange(`Saved ${one.name}.`), onError: refused },
  });
  const retire = useRetireAssetClass<ApiError>({
    mutation: {
      onSuccess: (one) =>
        afterChange(one.retired ? `${one.name} is retired.` : `${one.name} is back in use.`),
      onError: refused,
    },
  });

  const view = useTableView("config-asset-classes", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  const rows = listed.data ?? [];
  const busy = add.isPending || rename.isPending || retire.isPending;
  // The one being renamed. The table puts the form in the row it belongs to; the lean list has no rows,
  // so it shows the form above the names instead.
  const beingRenamed = lean ? rows.find((row) => row.code === editing) : undefined;

  /** Saves the name typed over the one on the list. The short name is left as it was: it is not shown here. */
  function saveTheName() {
    if (!beingRenamed || typedName.trim() === "") {
      return;
    }
    rename.mutate({
      code: beingRenamed.code,
      data: { name: typedName.trim(), shortName: beingRenamed.shortName },
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {lean ? <span /> : (
          <p className="max-w-2xl text-sm text-ink-muted">
            What every model is spread across and every holding is counted under. A class is never deleted,
            only retired: what was written under it keeps naming it, and nothing new is counted under it
            from then on.
          </p>
        )}
        {mayChange && (
        <Button variant="secondary" onClick={() => { setAdding(true); setEditing(undefined); setNotice(undefined); }}>
          <Plus aria-hidden="true" />
          Add a class
        </Button>
        )}
      </div>

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}
      {listed.isError && <Alert tone="danger">{listed.error.message}</Alert>}

      {adding && (
        <ClassForm
          title="A new asset class"
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={(name, shortName) => add.mutate({ data: { name, shortName } })}
        />
      )}

      {/* Lean: the names in three columns, which is how a vocabulary is read. A table gave each word a
          row of its own with a code under it and a button beside it — eight words down two feet of a
          screen that is about the plans, not about the words they are written in. */}
      {lean ? (
        <div className="space-y-3">
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {listed.isPending && <li className="text-sm text-ink-muted">Loading…</li>}
          {rows.map((row) => (
            <li
              key={row.code}
              className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm"
            >
              {editing === row.code ? (
                <TextInput
                  autoFocus
                  aria-label={`Name of ${row.name}`}
                  className="h-8 min-w-0 flex-1 text-sm"
                  value={typedName}
                  disabled={busy}
                  onChange={(event) => setTypedName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveTheName();
                    }
                    if (event.key === "Escape") {
                      setEditing(undefined);
                    }
                  }}
                />
              ) : (
                <>
                  <span className={cn("truncate", row.retiredAt && "text-ink-muted")}>
                    {row.name}
                    {row.retiredAt && <span className="ml-1.5 text-2xs uppercase text-ink-muted">retired</span>}
                  </span>
                  {mayChange && (
                    <button
                      type="button"
                      aria-label={`Rename ${row.name}`}
                      title={`Rename ${row.name}`}
                      disabled={busy}
                      onClick={() => {
                        setEditing(row.code);
                        setTypedName(row.name);
                        setAdding(false);
                        setNotice(undefined);
                      }}
                      className="shrink-0 rounded p-1 text-ink-muted hover:bg-slate-100 hover:text-ink"
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        {beingRenamed && (
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={busy || typedName.trim() === ""} onClick={saveTheName}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
          </div>
        )}
        </div>
      ) : (
        <div className="space-y-3">
        {/* Above the table, the two together: which of their arrangements a reader is in, and the way to
            change it. */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <ViewTabs
            views={view.views}
            current={view.current}
            edited={view.current === null ? view.arranged : view.changed}
            onPick={(name) => (name === null ? view.reset() : view.apply(name))}
            onSave={view.saveAs}
            onDelete={view.remove}
            firstLabel="Every class"
          />
          <ColumnPicker
            columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
            shown={new Set(view.shown)}
            order={view.order}
            arranged={view.arranged}
            onChange={(next) => {
              for (const one of MOVABLE) {
                if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
              }
            }}
            onMove={view.move}
            onReset={view.reset}
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Class</th>
              {shownColumns.map((column, at) => (
                <th
                  key={column.id}
                  scope="col"
                  {...drag.headingProps(column.id)}
                  className={cn(
                    "cursor-grab touch-none px-4 py-3 select-none",
                    column.align === "right" ? "text-right" : "text-left",
                    drag.dragging === column.id && "cursor-grabbing opacity-40",
                    drag.over === column.id && "bg-primary-50",
                  )}
                  title={`Drag to move ${column.label}`}
                >
                  {column.label}
                  <span className="sr-only">
                    , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                  </span>
                </th>
              ))}
              <th scope="col" className="py-3 pr-5 pl-4 text-right"><span className="sr-only">Change</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {listed.isPending && (
              <tr><td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">Loading…</td></tr>
            )}
            {rows.map((row) =>
              editing === row.code ? (
                <tr key={row.code}>
                  <td colSpan={shownColumns.length + 2} className="px-5 py-4">
                    <ClassForm
                      title={`Rename ${row.name}`}
                      name={row.name}
                      shortName={row.shortName}
                      busy={busy}
                      onCancel={() => setEditing(undefined)}
                      onSave={(name, shortName) => rename.mutate({ code: row.code, data: { name, shortName } })}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={row.code} className={cn(row.retiredAt && "bg-slate-50/60")}>
                  <td className="py-3 pr-4 pl-5">
                    <span className={cn("font-semibold", row.retiredAt && "text-ink-soft")}>{row.name}</span>
                    {row.retiredAt && <span className="ml-2 text-xs text-ink-muted">Retired</span>}
                    {/* The code is what every figure is stored under, so it is shown rather than hidden. */}
                    <span className="block font-mono text-xs text-ink-muted">{row.code}</span>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3",
                        column.align === "right" && "text-right tabular-nums",
                        column.nowrap && "whitespace-nowrap",
                        column.tone,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  <td className="py-3 pr-5 pl-4 text-right whitespace-nowrap">
                    {mayChange && (<>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => { setEditing(row.code); setAdding(false); setNotice(undefined); }}
                    >
                      Rename
                    </Button>{" "}
                    {!lean && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy || !row.mayRetire}
                        title={
                          row.mayRetire
                            ? undefined
                            : "Still in use. Move what is counted under it to another class first."
                        }
                        onClick={() => retire.mutate({ code: row.code, data: { retired: !row.retiredAt } })}
                      >
                        {row.retiredAt ? "Put it back" : "Retire"}
                      </Button>
                    )}
                    </>)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
        </div>
      )}

      {!lean && (
        <p className="text-xs text-ink-muted">
          A class in use can't be retired — the models built on it would stop adding up to 100%, and the
          holdings counted under it would have nowhere to sit. The Models and Clients columns say what is
          holding it.
        </p>
      )}
    </section>
  );
}

function ClassForm({
  title,
  name: held = "",
  shortName: heldShort = "",
  busy,
  onSave,
  onCancel,
}: {
  title: string;
  name?: string;
  shortName?: string;
  busy: boolean;
  onSave: (name: string, shortName: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(held);
  const [shortName, setShortName] = useState(heldShort);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(name.trim(), shortName.trim());
  }

  return (
    <form onSubmit={save} className="max-w-3xl rounded-xl border border-line bg-canvas/60 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
        <Field id="asset-class-name" label="Name">
          <TextInput
            id="asset-class-name"
            value={name}
            maxLength={80}
            placeholder="Private credit"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field id="asset-class-short" label="Short name" hint="For crowded columns">
          <TextInput
            id="asset-class-short"
            value={shortName}
            maxLength={16}
            placeholder="PC"
            onChange={(event) => setShortName(event.target.value)}
          />
        </Field>
        <div className="flex items-end gap-2 pb-0.5">
          <Button type="submit" disabled={busy || name.trim() === "" || shortName.trim() === ""}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
      {held !== "" && (
        <p className="mt-2 text-xs text-ink-muted">
          Renaming changes what the class is called everywhere. What is already counted under it stays where it
          is — figures are stored against the code, not the name.
        </p>
      )}
    </form>
  );
}
