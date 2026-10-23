import { ApiError } from "@atomprive/api-client";
import {
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useAssignAdvisor,
  useListCustomerAdvisors,
  type AdvisorAssignment,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Dialog, Field, SelectInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";

/**
 * A client either assignment dialog can be handed: who they are, and who is on them already.
 *
 * <p>Both desks are named on it because both dialogs read it, and each reads only its own field. The
 * two lists are never folded into one — the API keeps relationship managers and portfolio managers apart,
 * and a name in one is not a name in the other.
 */
export interface ClientToAssign {
  id: string;
  fullName: string;
  advisors: StaffMember[];
  portfolioManagers: StaffMember[];
}

interface AssignAdvisorDialogProps {
  open: boolean;
  clients: ClientToAssign[];
  onClose: () => void;
  onAssigned: (result: AdvisorAssignment) => void;
}

/** Gives one or more clients to a relationship manager. */
export function AssignAdvisorDialog({ open, clients, onClose, onAssigned }: AssignAdvisorDialogProps) {
  const title = clients.length === 1 ? `Assign a relationship manager to ${clients[0]?.fullName}` : `Assign a relationship manager to ${clients.length} clients`;
  return (
    <Dialog open={open} onClose={onClose} title={title} description="The relationship manager is emailed about their new clients. Anyone already looking after them stays; take a relationship manager off from the client's page.">
      {/* Mounted only while open, so every opening starts afresh. */}
      {open && <AssignAdvisorForm clients={clients} onCancel={onClose} onAssigned={onAssigned} />}
    </Dialog>
  );
}

function AssignAdvisorForm({ clients, onCancel, onAssigned }: { clients: ClientToAssign[]; onCancel: () => void; onAssigned: (result: AdvisorAssignment) => void }) {
  const queryClient = useQueryClient();
  const advisors = useListCustomerAdvisors<StaffMember[], ApiError>({ query: { staleTime: 5 * 60_000 } });
  const [advisorId, setAdvisorId] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const assign = useAssignAdvisor<ApiError>({
    mutation: {
      onSuccess: (result) => {
        void queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        clients.forEach((client) => void queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(client.id) }));
        onAssigned(result);
      },
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  const alreadyTheirs = advisorId !== "" && clients.every((client) => client.advisors.some((advisor) => advisor.id === advisorId));
  const error = errors.fields.advisorId ?? errors.fields.customerIds;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(noErrors);
    assign.mutate({ data: { customerIds: clients.map((client) => client.id), advisorId } });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <div className="rounded-xl border border-line">
        <p className="border-b border-line bg-slate-50/60 px-4 py-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          {clients.length === 1 ? "Client" : `${clients.length} clients`}
        </p>
        <ul className="max-h-48 divide-y divide-line overflow-y-auto">
          {clients.map((client) => (
            <li key={client.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="truncate font-medium">{client.fullName}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {client.advisors.length > 0 ? `Now with ${client.advisors.map((advisor) => advisor.fullName).join(", ")}` : "No relationship manager yet"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Field id="assign-advisor" label="Relationship manager" required error={error} hint={alreadyTheirs ? `${clients.length === 1 ? "This client already has" : "These clients already have"} this relationship manager.` : undefined}>
        <SelectInput {...describedBy("assign-advisor", error)} value={advisorId} onChange={(event) => setAdvisorId(event.target.value)} required>
          <option value="" disabled>
            {advisors.data ? "Choose a relationship manager" : "Loading relationship managers…"}
          </option>
          {(advisors.data ?? []).map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.fullName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={assign.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={advisorId === "" || alreadyTheirs || assign.isPending}>
          {assign.isPending ? "Assigning…" : "Assign relationship manager"}
        </Button>
      </div>
    </form>
  );
}
