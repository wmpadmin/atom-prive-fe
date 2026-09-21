import { ApiError } from "@atomprive/api-client";
import { useListCustomers, type CustomerPage, type CustomerRow } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Dialog, TextInput } from "@atomprive/ui";
import { useState } from "react";
import { asPreviewClient, type PreviewClient } from "./preview-client";

interface SelectClientDialogProps {
  open: boolean;
  onClose: () => void;
  onChoose: (client: PreviewClient) => void;
}

/** Picks a real client to preview an email against, so the placeholders show their details rather than samples. */
export function SelectClientDialog({ open, onClose, onChoose }: SelectClientDialogProps) {
  const [query, setQuery] = useState("");
  const clients = useListCustomers<CustomerPage, ApiError>(
    { query: query.trim() || undefined, size: 8 },
    { query: { enabled: open } },
  );

  function choose(row: CustomerRow) {
    onChoose(asPreviewClient(row));
    setQuery("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Preview against a client"
      description="Their name and advisor fill the placeholders in the preview and test email. Nothing is sent to them."
    >
      {open && (
        <div className="space-y-4">
          <TextInput
            id="client-search"
            name="client-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            autoFocus
            aria-label="Search clients"
          />
          {clients.isError ? (
            <Alert tone="danger">
              {clients.error.status === 403
                ? "You need permission to see clients before you can preview against one."
                : clients.error.message}
            </Alert>
          ) : clients.data && clients.data.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              {query.trim() ? `No client matches "${query.trim()}".` : "No clients have been onboarded yet."}
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {(clients.data?.items ?? []).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => choose(row)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600"
                  >
                    <Avatar name={row.fullName} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{row.fullName}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {row.email ?? "No email"}
                        {row.advisors.length > 0 && ` · ${row.advisors.map((advisor) => advisor.fullName).join(", ")}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {clients.isPending && <p className="text-xs text-ink-muted">Looking for clients…</p>}
        </div>
      )}
    </Dialog>
  );
}
