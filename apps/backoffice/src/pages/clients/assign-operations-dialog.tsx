import { ApiError } from "@atomprive/api-client";
import type { StaffMember } from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, Dialog, StaffAvatar } from "@atomprive/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  assignOperations,
  OPERATIONS_KEY,
  useOperationsPeople,
  type OperationsAssignOutcome,
} from "./operations-assignments";

/** A client or prospect being given Operations people, with whoever looks after it already. */
export interface ToAssignOps {
  id: string;
  fullName: string;
  people: StaffMember[];
}

interface AssignOperationsDialogProps {
  open: boolean;
  /** Clients or prospects; which, the next prop says. */
  records: ToAssignOps[];
  kind: "client" | "prospect";
  onClose: () => void;
  onAssigned: (result: OperationsAssignOutcome) => void;
}

/**
 * Assign Ops (26 Nov 2026): the Head of Operations, or an Admin, ticks one or more Operations people for one or more
 * clients or prospects. Assigning adds; whoever is on them already stays, and is taken off on the client's or prospect's
 * own page. Each person is emailed about what they now look after.
 */
export function AssignOperationsDialog({ open, records, kind, onClose, onAssigned }: AssignOperationsDialogProps) {
  const noun = kind === "client" ? ["client", "clients"] : ["prospect", "prospects"];
  const title = records.length === 1
    ? `Assign Operations · ${records[0]?.fullName}`
    : `Assign Operations · ${records.length} ${noun[1]}`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={`Tick one or more; those already on a ${noun[0]} stay. Each person is emailed about their new ${noun[1]}.`}
    >
      {/* Mounted only while open, so every opening starts afresh. */}
      {open && <AssignOperationsForm records={records} kind={kind} onCancel={onClose} onAssigned={onAssigned} />}
    </Dialog>
  );
}

function AssignOperationsForm({ records, kind, onCancel, onAssigned }: {
  records: ToAssignOps[];
  kind: "client" | "prospect";
  onCancel: () => void;
  onAssigned: (result: OperationsAssignOutcome) => void;
}) {
  const queryClient = useQueryClient();
  const people = useOperationsPeople();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());
  const [tried, setTried] = useState(false);
  const ids = records.map((record) => record.id);
  const assign = useMutation<OperationsAssignOutcome, ApiError>({
    mutationFn: () => assignOperations(kind === "client"
      ? { customerIds: ids, staffIds: [...chosen] }
      : { prospectIds: ids, staffIds: [...chosen] }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: OPERATIONS_KEY });
      onAssigned(result);
    },
  });
  // Somebody on every one of them already has nothing to add; said rather than sent.
  const onEvery = (staffId: string) => records.every((record) => record.people.some((person) => person.id === staffId));

  function toggle(staffId: string, wanted: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (wanted) next.add(staffId);
      else next.delete(staffId);
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (chosen.size === 0) {
      setTried(true);
      return;
    }
    assign.mutate();
  }

  const list = people.data ?? [];
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {assign.isError && <Alert tone="danger">{assign.error.message}</Alert>}

      <div className="rounded-xl border border-line">
        <p className="border-b border-line bg-slate-50/60 px-4 py-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          {records.length === 1 ? (kind === "client" ? "Client" : "Prospect") : `${records.length} ${kind}s`}
        </p>
        <ul className="max-h-40 divide-y divide-line overflow-y-auto">
          {records.map((record) => (
            <li key={record.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="truncate font-medium">{record.fullName}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {record.people.length > 0 ? record.people.map((person) => person.fullName).join(", ") : "Not assigned"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <fieldset>
        <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Operations people</legend>
        {people.isPending && <p className="mt-2 text-sm text-ink-muted">Loading Operations people…</p>}
        {people.isError && <Alert tone="danger">{people.error.message}</Alert>}
        {people.data && list.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted">Nobody holds the Operations role yet.</p>
        )}
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {list.map((person) => {
            const already = onEvery(person.id);
            const ticked = chosen.has(person.id);
            return (
              <label
                key={person.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  ticked ? "border-primary-600 bg-primary-50" : "border-line bg-white",
                  already ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary-600",
                )}
              >
                <input
                  type="checkbox"
                  checked={ticked || already}
                  disabled={already}
                  onChange={(event) => toggle(person.id, event.target.checked)}
                  className="size-4 rounded border-line text-primary-600"
                />
                <StaffAvatar name={person.fullName} photo={person.photo} className="size-7 text-2xs" />
                <span className="min-w-0 flex-1 truncate font-semibold">{person.fullName}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {already
                    ? "Already on it"
                    : `${person.looksAfter} ${person.looksAfter === 1 ? "client" : "clients"}`}
                </span>
              </label>
            );
          })}
        </div>
        {tried && chosen.size === 0 && <p className="mt-2 text-xs text-red-600">Tick at least one person.</p>}
      </fieldset>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={assign.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={assign.isPending}>
          {assign.isPending
            ? "Assigning…"
            : chosen.size > 1 ? `Assign ${chosen.size} people` : "Assign"}
        </Button>
      </div>
    </form>
  );
}
