import type { ApiError } from "@atomprive/api-client";
import {
  useForStaff,
  useListRegister,
  type Register,
  type RegisterRow,
  type RegisterRowStanding,
  type StaffDeclarations,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, TextInput, cn } from "@atomprive/ui";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "../../lib/labels";

const MISSING = "—";

const standingLabels: Record<RegisterRowStanding, string> = {
  SIGNED: "Signed",
  PENDING: "Pending",
  UNSIGNED: "Unsigned",
};

function standingTone(standing: RegisterRowStanding) {
  return standing === "SIGNED" ? "success" : standing === "PENDING" ? "warning" : "danger";
}

/** Who each person is, under their name: their designation and the part of the firm they work in. */
function roleLine(row: RegisterRow) {
  return [row.designation, row.department].filter(Boolean).join(" · ") || MISSING;
}

/**
 * The staff declarations register. Nine mandatory declarations per employee: this is who has signed what, what
 * is outstanding, and how overdue it is. The signed copies are kept for the regulator.
 */
export function StaffDeclarationsPage() {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<RegisterRowStanding | "ALL">("ALL");
  const [chosen, setChosen] = useState<string>();

  const register = useListRegister<Register, ApiError>();
  // Held steady between renders so the counting and filtering below only redo themselves when it changes.
  const employees = useMemo(() => register.data?.employees ?? [], [register.data]);
  const selectedId = chosen ?? employees[0]?.id;
  const detail = useForStaff<StaffDeclarations, ApiError>(selectedId ?? "", {
    query: { enabled: Boolean(selectedId) },
  });

  const counts = useMemo(() => {
    const of = (standing: RegisterRowStanding) => employees.filter((one) => one.standing === standing).length;
    return { ALL: employees.length, SIGNED: of("SIGNED"), PENDING: of("PENDING"), UNSIGNED: of("UNSIGNED") };
  }, [employees]);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return employees.filter((one) => {
      if (only !== "ALL" && one.standing !== only) return false;
      if (!words) return true;
      return [one.fullName, one.designation, one.department, one.employeeId]
        .filter(Boolean)
        .some((said) => said!.toLowerCase().includes(words));
    });
  }, [employees, only, query]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-bold">Staff declarations</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Nine mandatory declarations per employee. Signed copies are retained for the regulator and refreshed
            on their renewal cycle.
          </p>
        </div>
      </header>

      {register.isError && <Alert tone="danger">{register.error.message}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
        <section aria-labelledby="staff-list" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="staff-list" className="text-sm font-bold text-ink">
            Staff list
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {register.data
              ? `${counts.ALL} employee${counts.ALL === 1 ? "" : "s"} · ${counts.SIGNED} fully signed · ${register.data.outstanding} of ${register.data.expected} declarations outstanding`
              : "Loading the register…"}
          </p>

          <div className="relative mt-4">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <TextInput
              aria-label="Search employee, role or department"
              placeholder="Search employee, role or department"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["ALL", "SIGNED", "PENDING", "UNSIGNED"] as const).map((one) => (
              <button
                key={one}
                type="button"
                onClick={() => setOnly(one)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  only === one
                    ? "border-primary-600 bg-primary-50 text-primary-800"
                    : "border-line bg-white text-ink-soft hover:border-primary-100",
                )}
              >
                {one === "ALL" ? "All" : standingLabels[one]} <span className="text-ink-muted">{counts[one]}</span>
              </button>
            ))}
          </div>

          <ul className="mt-4 divide-y divide-line">
            {shown.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setChosen(row.id)}
                  aria-current={row.id === selectedId ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                    row.id === selectedId ? "bg-primary-50" : "hover:bg-canvas",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-600 text-2xs font-semibold text-white">
                    {initialsOf(row.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{row.fullName}</span>
                    <span className="block truncate text-xs text-ink-muted">{roleLine(row)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge tone={standingTone(row.standing)}>{standingLabels[row.standing]}</Badge>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {row.signed} / {row.total}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {register.data && shown.length === 0 && (
              <li className="px-3 py-6 text-sm text-ink-muted">Nobody matches that.</li>
            )}
          </ul>
        </section>

        <div className="space-y-6">
          {detail.data ? <StaffPanel held={detail.data} /> : <p className="text-sm text-ink-muted">Loading…</p>}
        </div>
      </div>
    </div>
  );
}

function StaffPanel({ held }: { held: StaffDeclarations }) {
  const { employee, declarations, outstanding, oldestOverdueSince } = held;
  const share = employee.total === 0 ? 0 : Math.round((employee.signed / employee.total) * 100);
  return (
    <>
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-600 text-sm font-semibold text-white">
              {initialsOf(employee.fullName)}
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{employee.fullName}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {roleLine(employee)}
                {employee.employmentStart ? ` · joined ${formatDate(employee.employmentStart)}` : ""}
                {employee.employeeId ? ` · employee ID ${employee.employeeId}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge tone={standingTone(employee.standing)}>{standingLabels[employee.standing]}</Badge>
            <p className="mt-1 text-sm font-semibold text-ink">
              {employee.signed} of {employee.total} signed
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className={cn("h-full rounded-full", share === 100 ? "bg-emerald-500" : "bg-amber-400")}
              style={{ width: `${share}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <span>
              {outstanding === 0
                ? "Nothing outstanding."
                : `${outstanding} outstanding${oldestOverdueSince ? ` · oldest overdue since ${formatDate(oldestOverdueSince)}` : ""}`}
            </span>
            <span>{share}%</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="declarations" className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="declarations" className="text-sm font-bold text-ink">
              Declarations
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">All nine mandatory declarations · signed copies held on file</p>
          </div>
          <Button variant="secondary" size="sm" disabled={outstanding === 0}>
            Request outstanding
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-2xs tracking-wider text-ink-muted uppercase">
                <th scope="col" className="w-10 py-2 text-left font-semibold" />
                <th scope="col" className="py-2 text-left font-semibold">Declaration</th>
                <th scope="col" className="py-2 text-left font-semibold">Status</th>
                <th scope="col" className="py-2 text-left font-semibold">Signed date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {declarations.map((one, at) => (
                <tr key={one.kind}>
                  <td className="py-3 align-top">
                    <span className="grid size-6 place-items-center rounded-full bg-canvas text-2xs font-semibold text-ink-muted">
                      {at + 1}
                    </span>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <span className="block font-semibold text-ink">{one.title}</span>
                    {/* The cycle, as the firm sets it. The day it fell due is said once, where it is overdue. */}
                    <span className={cn("block text-xs", one.overdue && !one.signed ? "text-red-600" : "text-ink-muted")}>
                      {one.schedule}
                      {one.overdue && !one.signed && one.dueOn ? ` · overdue since ${formatDate(one.dueOn)}` : ""}
                    </span>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <Badge tone={one.signed ? "success" : "danger"}>{one.signed ? "Signed" : "Unsigned"}</Badge>
                  </td>
                  <td className="py-3 align-top text-ink">{one.signedOn ? formatDate(one.signedOn) : MISSING}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
