import { ApiError } from "@atomprive/api-client";
import {
  getListEntriesQueryKey,
  useAddEntry,
  useListEntries,
  useRenameEntry,
  useSetStillUsed,
  type EntryRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatRelative } from "../../lib/labels";

/** The lists kept here, and what each one is for. */
const LISTS = [
  {
    kind: "PRODUCT_TYPE" as const,
    title: "Product types",
    about: "What kind of instrument a holding is: a single line bond, a mutual fund, a structured product.",
    one: "product type",
  },
  {
    kind: "RELATIONSHIP_TYPE" as const,
    title: "Relationship types",
    about: "How somebody on a joint account is related to the first holder.",
    one: "relationship type",
  },
];

/**
 * The firm's own short lists, kept rather than written into the code.
 *
 * <p>Nothing here is deleted. An entry the firm has stopped using is retired: it leaves the dropdowns and stays
 * on everything already written against it, because a record that cannot say what it was counted under is not a
 * record. For the same reason a code never changes — only the wording does.
 */
export function ReferenceListsTab() {
  return (
    <div className="space-y-6">
      {LISTS.map((list) => (
        <OneList key={list.kind} {...list} />
      ))}
    </div>
  );
}

function OneList({ kind, title, about, one }: (typeof LISTS)[number]) {
  const queryClient = useQueryClient();
  // The whole list, retired entries included: this is the screen that keeps it, not a dropdown.
  const listed = useListEntries<EntryRow[], ApiError>(kind, { inUse: false });
  const [adding, setAdding] = useState("");
  const [renaming, setRenaming] = useState<string>();
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  function kept() {
    setAdding("");
    setRenaming(undefined);
    setTyped("");
    setErrors(noErrors);
    void queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(kind) });
  }
  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));

  const add = useAddEntry<ApiError>({ mutation: { onSuccess: kept, onError } });
  const rename = useRenameEntry<ApiError>({ mutation: { onSuccess: kept, onError } });
  const stillUsed = useSetStillUsed<ApiError>({ mutation: { onSuccess: kept, onError } });
  const busy = add.isPending || rename.isPending || stillUsed.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors(noErrors);
    if (renaming) {
      rename.mutate({ kind, code: renaming, data: { name: typed.trim() } });
    } else {
      add.mutate({ kind, data: { name: adding.trim() } });
    }
  }

  const entries = listed.data ?? [];

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="px-6 pt-5">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-muted">{about}</p>
      </div>

      {listed.isError && (
        <div className="px-6 pt-4">
          <Alert tone="danger">{listed.error.message}</Alert>
        </div>
      )}
      {errors.form && (
        <div className="px-6 pt-4">
          <Alert tone="danger">{errors.form}</Alert>
        </div>
      )}

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {entries.length === 0 && !listed.isPending && (
          <li className="px-6 py-6 text-center text-sm text-ink-muted">Nothing on this list yet.</li>
        )}
        {entries.map((entry) => (
          <li key={entry.code} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
            {renaming === entry.code ? (
              <form onSubmit={submit} className="flex flex-1 flex-wrap items-end gap-3">
                <Field id={`rename-${entry.code}`} label="Name" error={errors.fields.name} className="min-w-60 flex-1">
                  <TextInput
                    id={`rename-${entry.code}`}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    autoFocus
                  />
                </Field>
                <div className="flex gap-2 pb-0.5">
                  <Button type="submit" size="sm" disabled={busy || typed.trim().length === 0}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={kept}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", entry.retiredAt ? "text-ink-muted" : "text-ink")}>
                    {entry.name}
                    {entry.retiredAt && <span className="ml-2 text-2xs font-normal">· no longer used</span>}
                  </p>
                  {/* The code is what every record stores, so it is worth seeing beside the wording. */}
                  <p className="font-mono text-2xs text-ink-muted">
                    {entry.code}
                    {entry.updatedBy ? ` · ${entry.updatedBy}, ${formatRelative(entry.updatedAt)}` : ""}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRenaming(entry.code);
                      setTyped(entry.name);
                      setErrors(noErrors);
                    }}
                    className="text-sm font-medium text-primary-700 hover:underline"
                  >
                    Reword
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => stillUsed.mutate({ kind, code: entry.code, data: { stillUsed: Boolean(entry.retiredAt) } })}
                    className="text-sm font-medium text-ink-soft hover:underline"
                  >
                    {entry.retiredAt ? "Use it again" : "Stop using"}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {!renaming && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-line px-6 py-4">
          <Field id={`add-${kind}`} label={`Add a ${one}`} error={errors.fields.name} className="min-w-60 flex-1">
            <TextInput
              id={`add-${kind}`}
              value={adding}
              onChange={(event) => setAdding(event.target.value)}
              placeholder="What the firm calls it"
            />
          </Field>
          <Button type="submit" disabled={busy || adding.trim().length === 0} className="mb-0.5">
            {add.isPending ? "Adding…" : "Add"}
          </Button>
        </form>
      )}
    </section>
  );
}
