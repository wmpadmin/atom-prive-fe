import { ApiError } from "@atomprive/api-client";
import {
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useAssignPortfolioManager,
  useListPortfolioManagers,
  type PortfolioManagerAssignment,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Dialog, Field, SelectInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import type { ClientToAssign } from "./assign-advisor-dialog";

interface AssignPortfolioManagerDialogProps {
  open: boolean;
  clients: ClientToAssign[];
  onClose: () => void;
  onAssigned: (result: PortfolioManagerAssignment) => void;
}

/**
 * Records one or more clients against a portfolio manager.
 *
 * <p>Its own dialog rather than the advisor one with a word changed. The two share a shape and nothing
 * else: this one asks a different list who they are, sends a different body, and has nothing to say
 * about an email, because nothing is sent. Folding them together would have meant a component whose
 * every line was a prop, and the next reader would still have had to open both.
 */
export function AssignPortfolioManagerDialog({ open, clients, onClose, onAssigned }: AssignPortfolioManagerDialogProps) {
  const title = clients.length === 1
    ? `Assign a portfolio manager to ${clients[0]?.fullName}`
    : `Assign a portfolio manager to ${clients.length} clients`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      // Said here because it is the question Operations will have: this writes down who manages whom and
      // nothing else. Nobody is emailed, and nobody's sight of a client moves either way.
      description="Nobody is emailed, and nothing about who can open this client changes. Whoever manages them already stays; take a manager off from the client's page."
    >
      {/* Mounted only while open, so every opening starts afresh. */}
      {open && <AssignPortfolioManagerForm clients={clients} onCancel={onClose} onAssigned={onAssigned} />}
    </Dialog>
  );
}

function AssignPortfolioManagerForm({ clients, onCancel, onAssigned }: { clients: ClientToAssign[]; onCancel: () => void; onAssigned: (result: PortfolioManagerAssignment) => void }) {
  const queryClient = useQueryClient();
  // The list the advisors' dialog has as GET /customers/advisors, for the other desk. The backend has no
  // /customers/portfolio-managers yet, so this hook appears only once that one method is added and the client
  // is generated again; written here under the name generation will give it rather than stubbed locally.
  const managers = useListPortfolioManagers<StaffMember[], ApiError>({ query: { staleTime: 5 * 60_000 } });
  const [managerId, setManagerId] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const assign = useAssignPortfolioManager<ApiError>({
    mutation: {
      onSuccess: (result) => {
        void queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        clients.forEach((client) => void queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(client.id) }));
        onAssigned(result);
      },
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  const alreadyTheirs = managerId !== ""
    && clients.every((client) => client.portfolioManagers.some((manager) => manager.id === managerId));
  const error = errors.fields.managerId ?? errors.fields.customerIds;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(noErrors);
    assign.mutate({ data: { customerIds: clients.map((client) => client.id), managerId } });
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
                {client.portfolioManagers.length > 0
                  ? `Managed by ${client.portfolioManagers.map((manager) => manager.fullName).join(", ")}`
                  : "No portfolio manager yet"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Field
        id="assign-portfolio-manager"
        label="Portfolio manager"
        required
        error={error}
        hint={alreadyTheirs ? `${clients.length === 1 ? "This client already has" : "These clients already have"} this portfolio manager.` : undefined}
      >
        <SelectInput {...describedBy("assign-portfolio-manager", error)} value={managerId} onChange={(event) => setManagerId(event.target.value)} required>
          <option value="" disabled>
            {managers.data ? "Choose a portfolio manager" : "Loading portfolio managers…"}
          </option>
          {(managers.data ?? []).map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.fullName}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={assign.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={managerId === "" || alreadyTheirs || assign.isPending}>
          {assign.isPending ? "Assigning…" : "Assign portfolio manager"}
        </Button>
      </div>
    </form>
  );
}
