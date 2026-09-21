import type { ApiError } from "@atomprive/api-client";
import {
  exportRegister,
  useForStaff,
  useListRegister,
  useRemindOne,
  useSendReminders,
  type Reminders,
  type Register,
  type RegisterRow,
  type RegisterRowStanding,
  type StaffDeclarations,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, TextInput, cn } from "@atomprive/ui";
import { Download, Mail, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { downloadTextFile } from "../../lib/download";
import { formatDate } from "../../lib/labels";
import { DeclarationsProgress, DeclarationsTable } from "./declarations-table";

const MISSING = "—";

const standingLabels: Record<RegisterRowStanding, string> = {
  SIGNED: "Signed",
  PENDING: "Pending",
  UNSIGNED: "Unsigned",
};

/** What to say when one person has been asked for what is outstanding from them. */
function toldOne(told: Reminders): { tone: "success" | "info" | "danger"; message: string } {
  if (told.noWording) return toldThem(told);
  if (told.owing === 0) return { tone: "success", message: "They have signed all nine, so nothing was asked of them." };
  if (told.failed > 0) return { tone: "danger", message: "That didn't go — the mail server refused it." };
  return { tone: "success", message: "Asked them for what is still outstanding." };
}

/** What to say about a round of reminders, including when the firm hasn't written the email yet. */
function toldThem(result: Reminders): { tone: "success" | "info" | "danger"; message: string } {
  if (result.noWording) {
    return {
      tone: "info",
      message:
        "Nothing was sent: the reminder email is still a draft. Write it under Configuration → Email templates → Declarations outstanding, and it will go out from then on.",
    };
  }
  if (result.owing === 0) return { tone: "success", message: "Nobody has anything outstanding, so nobody was written to." };
  const people = `${result.sent} ${result.sent === 1 ? "person" : "people"}`;
  if (result.failed > 0) {
    return {
      tone: "danger",
      message: `Reminded ${people}. ${result.failed} didn't go — the mail server refused them.`,
    };
  }
  return { tone: "success", message: `Reminded ${people} with declarations outstanding.` };
}

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
  const [notice, setNotice] = useState<{ tone: "success" | "info" | "danger"; message: string }>();
  const [exporting, setExporting] = useState(false);
  const reminders = useSendReminders<ApiError>();

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

  const outstandingAcross = register.data?.outstanding ?? 0;

  /** The register as a sheet: every employee against every one of the nine. */
  async function exportTheRegister() {
    setNotice(undefined);
    setExporting(true);
    try {
      const csv = await exportRegister();
      downloadTextFile(`staff-declarations-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    }
    catch (caught) {
      setNotice({ tone: "danger", message: caught instanceof Error ? caught.message : "The export didn't run." });
    }
    finally {
      setExporting(false);
    }
  }

  /** Writes to everyone who still owes the firm a declaration, in the firm's own words. */
  function remind() {
    setNotice(undefined);
    reminders.mutate(undefined, {
      onSuccess: (result: Reminders) => setNotice(toldThem(result)),
      onError: (caught) => setNotice({ tone: "danger", message: caught.message }),
    });
  }

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
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void exportTheRegister()} disabled={exporting || !register.data}>
            <Download aria-hidden="true" />
            {exporting ? "Exporting…" : "Export register"}
          </Button>
          <Button
            onClick={remind}
            disabled={reminders.isPending || outstandingAcross === 0}
            title={outstandingAcross === 0 ? "Nobody has anything outstanding" : undefined}
          >
            <Mail aria-hidden="true" />
            {reminders.isPending ? "Sending…" : "Send reminders"}
          </Button>
        </div>
      </header>

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}
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
          {detail.data ? <StaffPanel held={detail.data} onTold={(told) => setNotice(toldOne(told))} /> : <p className="text-sm text-ink-muted">Loading…</p>}
        </div>
      </div>
    </div>
  );
}

function StaffPanel({ held, onTold }: { held: StaffDeclarations; onTold: (told: Reminders) => void }) {
  const { employee, declarations, outstanding, oldestOverdueSince } = held;
  const ask = useRemindOne<ApiError>();
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
          <DeclarationsProgress
            signed={employee.signed}
            total={employee.total}
            outstanding={outstanding}
            oldestOverdueSince={oldestOverdueSince}
          />
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
          <Button
            variant="secondary"
            size="sm"
            disabled={outstanding === 0 || ask.isPending}
            onClick={() => ask.mutate({ staffUserId: employee.id }, { onSuccess: onTold })}
          >
            {ask.isPending ? "Asking…" : "Request outstanding"}
          </Button>
        </div>

        <div className="mt-4">
          <DeclarationsTable declarations={declarations} />
        </div>
      </section>
    </>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
