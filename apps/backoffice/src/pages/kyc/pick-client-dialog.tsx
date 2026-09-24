import { ApiError } from "@atomprive/api-client";
import { useSearchClientsForKyc, type ClientBrief } from "@atomprive/api-client/backoffice";
import { Avatar, Dialog, TextInput } from "@atomprive/ui";
import { useState } from "react";
import { useDebouncedValue } from "../../lib/use-debounced-value";

/**
 * Finds the client whose paper is being put on file. Its own search rather than All clients, since Compliance
 * are given no sight of every client.
 */
export function PickClientDialog({
  open,
  onClose,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (client: ClientBrief) => void;
}) {
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim());
  const found = useSearchClientsForKyc<ClientBrief[], ApiError>(
    { query: query || undefined },
    { query: { enabled: open } },
  );

  return (
    <Dialog open={open} onClose={onClose} title="Which client?">
      <div className="space-y-4">
        <TextInput
          aria-label="Search clients"
          placeholder="Search by name, email or code"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ul className="divide-y divide-line rounded-xl border border-line">
          {(found.data ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              {found.isPending ? "Looking…" : "No client matches that."}
            </li>
          )}
          {(found.data ?? []).map((client) => (
            <li key={client.id}>
              <button
                type="button"
                onClick={() => {
                  onChoose(client);
                  setSearch("");
                  onClose();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <Avatar name={client.fullName} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{client.fullName}</span>
                  <span className="block truncate font-mono text-2xs text-ink-muted">{client.code}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
