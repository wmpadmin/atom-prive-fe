import { getRaiseStaffTicketUrl } from "@atomprive/api-client/backoffice";
import { RaiseTicketDialog } from "@atomprive/support/raise-ticket-dialog";
import { Alert, Button } from "@atomprive/ui";
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { lastPage } from "../../lib/last-page";

/**
 * Connected apps & files, laid out as the firm's design (AI_Assistant_Screens_v3, screen 3): the outside apps the
 * AI Assistant may read when a question needs them.
 *
 * <p>None is connected yet. Outlook, OneDrive, SharePoint and Teams go through the firm's Microsoft 365, which the
 * firm has to approve; the CRM is not named yet; desktop folders need a connector IT approves. So every card says
 * what it would read and what it is waiting on, rather than offering a switch that would connect nothing.
 */

/** tone: a fixed colour, the same in both themes, so the white mark on it always reads. */
type App = { mark: string; tone: string; name: string; reads: string; needs: string };

const APPS: App[] = [
  { mark: "MAIL", tone: "#1f2937", name: "Outlook", reads: "Emails and attachments in your mailbox, plus drafting replies.",
    needs: "The firm's Microsoft 365 approval" },
  { mark: "DRIVE", tone: "#8a6a2e", name: "OneDrive", reads: "Your Excel, Word and PDF files.",
    needs: "The firm's Microsoft 365 approval" },
  { mark: "SITE", tone: "#334155", name: "SharePoint", reads: "Client folders, research library and policies.",
    needs: "The firm's Microsoft 365 approval" },
  { mark: "CRM", tone: "#9f1d27", name: "CRM", reads: "Client notes, meetings and tasks.",
    needs: "The firm to name its CRM and give access" },
  { mark: "TEAMS", tone: "#5b6472", name: "Teams", reads: "Chats and shared channel files.",
    needs: "The firm's Microsoft 365 approval" },
  { mark: "PC", tone: "#a8874a", name: "Desktop folders", reads: "Only folders you choose, e.g. Documents › Client reviews. Excel, Word and PDF only.",
    needs: "IT approval for each folder" },
];

const EXAMPLES: { tags: ("firm" | "market" | "files")[]; question: string }[] = [
  { tags: ["firm", "files"], question: "Summarise this client's portfolio and check it against their latest review notes and emails." },
  { tags: ["market", "files"], question: "Compare these companies and include our own analyst notes from the research folder." },
  { tags: ["firm", "market", "files"], question: "Compare this client with the benchmark and our house view spreadsheet on OneDrive." },
];

const TAG: Record<"firm" | "market" | "files", { label: string; tone: string }> = {
  firm: { label: "Client & portfolio data", tone: "border-amber-200 bg-amber-50 text-amber-900" },
  market: { label: "Market data", tone: "border-slate-300 bg-slate-100 text-ink-soft" },
  files: { label: "Files & apps", tone: "border-rose-400/40 bg-rose-400/10 text-rose-700" },
};

export function ConnectedAppsPage() {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState<string>();

  return (
    <div className="space-y-5">
      <Link to="/assistant" className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
        <ArrowLeft className="size-4" aria-hidden="true" />
        AI Assistant
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">Workspace</p>
          <span aria-hidden="true" className="mt-1.5 block h-0.5 w-8 rounded bg-primary-600" />
          <h1 className="mt-2 text-[1.75rem] font-bold text-balance">Connected apps &amp; files</h1>
          <p className="mt-1 text-sm text-ink-muted">Choose what the assistant can read. It uses these whenever a question needs them.</p>
        </div>
        <Button variant="secondary" onClick={() => setRequesting(true)}>
          <Plus aria-hidden="true" />
          Request another app
        </Button>
      </header>

      {requested && <Alert tone="success">Request sent to the IT team as ticket {requested}. You&apos;ll get their reply on Support and by email.</Alert>}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {APPS.map((app) => (
          <li key={app.name} className="flex flex-col gap-3 rounded-2xl border border-line bg-white px-5 py-5">
            <div className="flex items-start gap-3">
              <span className={"grid size-12 shrink-0 place-items-center rounded-lg text-[10px] font-bold tracking-wide text-on-fill ring-1 ring-line"}
                style={{ backgroundColor: app.tone }}>
                {app.mark}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">{app.name}</h2>
                <p className="text-xs font-semibold text-ink-muted">Not connected</p>
              </div>
            </div>
            <p className="text-sm text-ink-soft">{app.reads}</p>
            <p className="mt-auto rounded-lg border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
              <span className="font-semibold text-ink-soft">Waiting on:</span> {app.needs}
            </p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="examples" className="space-y-4 rounded-2xl border border-line bg-white px-5 py-6 sm:px-7">
        <h2 id="examples" className="text-xl font-bold">Example questions that use files</h2>
        <ul className="grid gap-3 lg:grid-cols-3">
          {EXAMPLES.map((one) => (
            <li key={one.question} className="space-y-3 rounded-xl border border-line px-4 py-4">
              <span className="flex flex-wrap gap-1.5">
                {one.tags.map((tag) => (
                  <span key={tag} className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TAG[tag].tone}`}>
                    {TAG[tag].label}
                  </span>
                ))}
              </span>
              <p className="text-sm">&ldquo;{one.question}&rdquo;</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">These work once the apps they need are connected.</p>
      </section>

      <section aria-labelledby="recently-used" className="space-y-3 rounded-2xl border border-line bg-white px-5 py-6 sm:px-7">
        <h2 id="recently-used" className="text-xl font-bold">Recently used in answers</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="px-3 py-2.5">File or email</th>
                <th scope="col" className="px-3 py-2.5">App</th>
                <th scope="col" className="px-3 py-2.5">Used for</th>
                <th scope="col" className="px-3 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-ink-muted">
                  Nothing yet. Files and emails the assistant reads will be listed here once an app is connected.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-muted">
          The assistant will only open files and emails you can already open yourself. Files are read inside our platform and
          never sent to outside market data providers.
        </p>
      </section>

      {requesting && (
        <RaiseTicketDialog
          url={getRaiseStaffTicketUrl()}
          pageUrl={lastPage()}
          askCategory
          initialSubject="Connect another app to the AI Assistant"
          initialDescription="Which app, and what the assistant should read from it: "
          onClose={() => setRequesting(false)}
          onRaised={(raised) => {
            setRequesting(false);
            setRequested(raised.ticket.reference);
          }}
        />
      )}
    </div>
  );
}
