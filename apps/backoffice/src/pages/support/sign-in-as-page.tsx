import { ApiError } from "@atomprive/api-client";
import { useListCustomers, useSignInAs, useStaffToView, type CustomerPage, type StaffToView } from "@atomprive/api-client/backoffice";
import { supportViewAddress } from "@atomprive/support/support-view";
import { Alert, Button } from "@atomprive/ui";
import { Eye, Search } from "lucide-react";
import { useState } from "react";
import { useDebouncedValue } from "../../lib/use-debounced-value";

/**
 * The IT Admin seeing the portal as a client, or the back office as a member of staff, to reproduce a problem:
 * read-only, for half an hour, in a tab of its own, and only with a reason that goes in the trail.
 */
export function SignInAsPage() {
  const [kind, setKind] = useState<"CLIENT" | "STAFF">("CLIENT");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const wanted = useDebouncedValue(query.trim(), 300);
  const clients = useListCustomers<CustomerPage, ApiError>({ query: wanted, size: 20 }, { query: { enabled: kind === "CLIENT" } });
  const staff = useStaffToView<StaffToView[], ApiError>({ query: wanted }, { query: { enabled: kind === "STAFF" } });
  const start = useSignInAs<ApiError>({
    mutation: {
      onSuccess: (view) => {
        window.open(supportViewAddress(view.openAt, { token: view.accessToken, until: view.expiresAt, name: view.name }), "_blank", "noopener");
        setChosen(null);
        setReason("");
      },
    },
  });
  const people =
    kind === "CLIENT"
      ? (clients.data?.items ?? []).map((one) => ({ id: one.id, name: one.fullName, detail: one.email ?? one.code }))
      : (staff.data ?? []).map((one) => ({ id: one.id, name: one.fullName, detail: "Staff" }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance">Sign in as</h1>
        <p className="mt-1 text-sm text-ink-muted">
          See the portal as a client, or the back office as a member of staff, to reproduce a problem. Read-only, for 30 minutes, and recorded with your reason.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Who" className="inline-flex rounded-lg bg-sidebar p-0.5">
              {(
                [
                  ["CLIENT", "Clients"],
                  ["STAFF", "Staff"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => {
                    setKind(value);
                    setChosen(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${kind === value ? "bg-white text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Search by name</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="sign-in-as-search"
                type="search"
                value={query}
                placeholder="Search by name…"
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
              />
            </label>
          </div>
          {people.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">{wanted ? "Nobody matches." : "Search for somebody by name."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {people.map((one) => (
                <li key={one.id}>
                  <button
                    type="button"
                    aria-pressed={chosen?.id === one.id}
                    onClick={() => setChosen({ id: one.id, name: one.name })}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${chosen?.id === one.id ? "bg-primary-50" : "hover:bg-sidebar"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{one.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{one.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="h-fit space-y-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-bold">{chosen ? `View as ${chosen.name}` : "Choose somebody"}</h2>
          <div>
            <label htmlFor="sign-in-as-reason" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Reason or ticket number
            </label>
            <textarea
              id="sign-in-as-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. T-1001: holdings page is blank"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
            />
            {kind === "CLIENT" && <p className="mt-1 text-xs text-ink-muted">The client sees this reason on their own Audit Log.</p>}
          </div>
          {start.isError && <Alert tone="danger">{start.error.message}</Alert>}
          <Button
            className="w-full"
            disabled={!chosen || !reason.trim() || start.isPending}
            onClick={() => chosen && start.mutate({ data: { kind, id: chosen.id, reason: reason.trim() } })}
          >
            <Eye aria-hidden="true" />
            {start.isPending ? "Opening…" : "Open read-only view"}
          </Button>
        </section>
      </div>
    </div>
  );
}
