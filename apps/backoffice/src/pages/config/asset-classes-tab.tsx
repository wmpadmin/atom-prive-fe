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
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { formatDateTime } from "../../lib/labels";

type Notice = { tone: "success" | "danger"; message: string };

/**
 * The firm's own list of asset classes (A3.5 #6, R102). Every model, holding and valuation is counted under
 * one of these; they were compiled into the platform until now, so a class the firm started using meant a
 * release.
 *
 * <p>Nothing is ever deleted here, only retired. A valuation written last year still names its class, and a
 * report that cannot say what a figure was counted under is not a report.
 */
export function AssetClassesTab() {
  const queryClient = useQueryClient();
  const listed = useListAssetClasses<AssetClassRow[], ApiError>();
  const [notice, setNotice] = useState<Notice>();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string>();

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

  const rows = listed.data ?? [];
  const busy = add.isPending || rename.isPending || retire.isPending;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-ink-muted">
          What every model is spread across and every holding is counted under. A class is never deleted, only
          retired: what was written under it keeps naming it, and nothing new is counted under it from then on.
        </p>
        <Button variant="secondary" onClick={() => { setAdding(true); setEditing(undefined); setNotice(undefined); }}>
          <Plus aria-hidden="true" />
          Add a class
        </Button>
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

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Class</th>
              <th scope="col" className="px-4 py-3">Short</th>
              <th scope="col" className="px-4 py-3 text-right">Models</th>
              <th scope="col" className="px-4 py-3 text-right">Clients</th>
              <th scope="col" className="px-4 py-3">Last changed</th>
              <th scope="col" className="py-3 pr-5 pl-4 text-right"><span className="sr-only">Change</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {listed.isPending && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading…</td></tr>
            )}
            {rows.map((row) =>
              editing === row.code ? (
                <tr key={row.code}>
                  <td colSpan={6} className="px-5 py-4">
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
                  <td className="px-4 py-3 text-ink-soft">{row.shortName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{row.models}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{row.clients}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-muted">
                    {formatDateTime(row.updatedAt)}
                    {row.updatedBy ? ` · ${row.updatedBy}` : ""}
                  </td>
                  <td className="py-3 pr-5 pl-4 text-right whitespace-nowrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => { setEditing(row.code); setAdding(false); setNotice(undefined); }}
                    >
                      Rename
                    </Button>{" "}
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
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted">
        A class in use can't be retired — the models built on it would stop adding up to 100%, and the holdings
        counted under it would have nowhere to sit. The Models and Clients columns say what is holding it.
      </p>
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
