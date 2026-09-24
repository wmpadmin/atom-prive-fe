import type { ApiError } from "@atomprive/api-client";
import {
  getGetClientAccessQueryKey,
  useGetClientAccess,
  useListMyTeam,
  useSetClientAccess,
  type ClientAccessView,
  type TeamMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Who on the staff may see this client (#39). Most clients are open to the whole team, which is how a
 * servicing desk works; a client can be held to named staff instead. Documents follow the client, so this
 * decides who reads their papers too.
 */
export function ClientAccessPanel({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const access = useGetClientAccess<ClientAccessView, ApiError>(clientId);
  const team = useListMyTeam<TeamMember[], ApiError>();
  const save = useSetClientAccess<ApiError>();

  // Nothing is held here until somebody changes something: until then the panel shows what is on record.
  const [edit, setEdit] = useState<{ restricted: boolean; chosen: string[] } | null>(null);
  const [saved, setSaved] = useState<string>();

  if (access.isError) return <Alert tone="danger">{access.error.message}</Alert>;
  if (!access.data) return <p className="text-sm text-ink-muted">Loading…</p>;

  const onRecord = { restricted: access.data.access === "RESTRICTED", chosen: access.data.staff.map((one) => one.id) };
  const { restricted, chosen } = edit ?? onRecord;
  const members = team.data ?? [];
  const unchanged =
    restricted === onRecord.restricted &&
    chosen.length === onRecord.chosen.length &&
    chosen.every((id) => onRecord.chosen.includes(id));

  const setRestricted = (wanted: boolean) => setEdit({ restricted: wanted, chosen });
  const setChosen = (wanted: string[]) => setEdit({ restricted, chosen: wanted });

  function apply(nowRestricted: boolean, staffIds: string[]) {
    save.mutate(
      { id: clientId, data: { access: nowRestricted ? "RESTRICTED" : "EVERYONE", staffIds } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetClientAccessQueryKey(clientId), updated);
          setEdit(null);
          setSaved(
            updated.access === "EVERYONE"
              ? "Open to the whole team."
              : updated.staff.length === 0
                ? "Nobody on the team can see this client now."
                : `Only ${updated.staff.map((one) => one.fullName).join(", ")} can see this client.`,
          );
        },
      },
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white px-6 py-5">
      <div>
        <h2 className="text-base font-bold">Who can see this client</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Their documents follow this: whoever can see the client can read their papers. You and the client's own
          advisor always can.
        </p>
      </div>

      {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      {saved && !save.isError && <Alert tone="success">{saved}</Alert>}

      <div role="group" aria-label="Who can see this client" className="flex flex-wrap gap-2">
        <Choice label="Everyone on the team" active={!restricted} onClick={() => setRestricted(false)} />
        <Choice label="Only chosen staff" active={restricted} onClick={() => setRestricted(true)} />
      </div>

      {restricted && (
        <div className="space-y-2">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Staff who can see them</p>
          {members.length === 0 ? (
            <p className="text-sm text-ink-muted">Nobody is on your team yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((member) => (
                <label
                  key={member.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                    chosen.includes(member.id) ? "border-primary-600 bg-primary-50 font-semibold" : "border-line",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary-600"
                    checked={chosen.includes(member.id)}
                    onChange={(event) =>
                      setChosen(
                        event.target.checked ? [...chosen, member.id] : chosen.filter((id) => id !== member.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{member.fullName}</span>
                    <span className="block truncate text-2xs font-normal text-ink-muted">{member.email}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" disabled={unchanged || save.isPending} onClick={() => apply(restricted, chosen)}>
          {save.isPending ? "Saving…" : "Save access"}
        </Button>
      </div>
    </section>
  );
}

function Choice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg border px-4 text-sm font-semibold transition-colors",
        active ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink hover:border-primary-600",
      )}
    >
      {label}
    </button>
  );
}
