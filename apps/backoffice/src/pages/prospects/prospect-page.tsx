import { ApiError } from "@atomprive/api-client";
import { useGetProspect, type ProspectDetail } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import {
  ArrowLeft, Bookmark, CalendarDays, ChartNoAxesColumn, Clock, FileText, Info, Mail, NotebookPen, Pencil,
  FolderOpen, Landmark, Signature, Users, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { countryName } from "../../lib/countries";
import { formatDateTime } from "../../lib/labels";
import { ProspectPipeline } from "./next-step";
import { CallNotes } from "./call-notes";
import { EntityParties } from "./entity-parties";
import { ProspectAgreement } from "./prospect-agreement";
import { ProspectDocumentsTab } from "./prospect-documents-tab";
import { ProspectHolders } from "./prospect-holders";
import { ProspectMeetings } from "./prospect-meetings";
import { ProspectTimeline } from "./prospect-timeline";
import { ProspectWealth } from "./prospect-wealth";
import { ProspectForm } from "./prospect-form";
import { LOST_REASONS, OPEN_STATUSES, SOURCE_LABELS, STATUS_LABELS, STATUS_PILLS } from "./prospect-labels";
import { EmailBox, LogFollowUp, LostDialog, Muted, Reopen } from "./prospect-panel";

type Tab = "details" | "holders" | "people" | "documents" | "wealth" | "agreement" | "meetings" | "call-notes" | "timeline" | "email";

/**
 * One prospect on a page of its own (22 Nov 2026): the firm found the side panel too tight, the ownership graph above
 * all. Its details, its people and owners (entities), its follow-ups and the email box each a tab; the actions across
 * the top, all alike, with the one that is open marked. Back returns to the list where it was left.
 */
export function ProspectPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const user = useStaffUser();
  const prospect = useGetProspect<ProspectDetail, ApiError>(id);
  // A link from the bell names the tab to open on (?tab=call-notes).
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get("tab") as Tab | null) ?? "details");
  // A link may name the tab (?tab=call-notes); follow the address when it changes, not only on the first visit.
  useEffect(() => {
    const asked = new URLSearchParams(location.search).get("tab") as Tab | null;
    if (asked) setTab(asked);
  }, [location.search]);
  const [logging, setLogging] = useState(false);
  const followUpBox = useRef<HTMLDivElement>(null);
  // Opened from lower down too (the side card), so it is brought into view once, when it opens.
  useEffect(() => {
    if (logging) followUpBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [logging]);
  const [losing, setLosing] = useState(false);
  const [editing, setEditing] = useState(false);
  // The list's own address, search and tab, carried here so Back puts the reader where they were.
  const back = `/prospective-clients${(location.state as { list?: string } | null)?.list ?? ""}`;

  const detail = prospect.data;
  const row = detail?.prospect;
  if (prospect.isError) {
    return (
      <div className="space-y-4">
        <BackLink to={back} />
        <p className="text-sm text-red-700">{prospect.error.status === 404 ? "That prospect isn't there." : prospect.error.message}</p>
      </div>
    );
  }
  if (!detail || !row) return <p className="text-sm text-ink-muted">Opening…</p>;

  const open = OPEN_STATUSES.includes(row.status);
  const draft = row.status === "DRAFT";
  const entity = row.clientType === "ENTITY";
  // Documents, Wealth and Agreement are never shown on the Compliance desk (24 Nov 2026).
  const compliance = user.activeRole === "COMPLIANCE";
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "details", label: "Details", icon: FileText },
    ...(entity ? [{ id: "people" as const, label: "Stakeholders", icon: Users }] : []),
    // A joint account's other holders (23 Nov 2026), named before converting so each hands in their documents.
    ...(!entity ? [{ id: "holders" as const, label: "Account holders", icon: Users }] : []),
    // Filled in bit by bit from the day they are added (23 Nov 2026), on screen or from the Excel template.
    // Uploaded and sent to Compliance from the day they are added (23 Nov 2026).
    ...(!compliance ? [
      { id: "documents" as const, label: "Documents", icon: FolderOpen },
      { id: "wealth" as const, label: "Wealth", icon: Landmark },
      // Signed by the client on the portal, then by the Admin here, once Compliance approve everything (23 Nov 2026).
      { id: "agreement" as const, label: "Agreement", icon: Signature },
    ] : []),
    { id: "meetings", label: "Meetings", icon: CalendarDays },
    { id: "call-notes", label: "Call notes", icon: NotebookPen },
    { id: "timeline", label: "Activity log", icon: Clock },
    ...(detail.mayChange && open && row.email && !row.doNotEmail ? [{ id: "email" as const, label: "Send email", icon: Mail }] : []),
  ];
  const current = tabs.some((one) => one.id === tab) ? tab : "details";

  return (
    <div className="space-y-6">
      <BackLink to={back} />

      <header className="space-y-4 rounded-2xl border border-line bg-white px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
              {initials(row.fullName)}
            </span>
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold">
                {row.fullName}
                <span className={cn("rounded-full px-3 py-0.5 text-sm font-semibold", STATUS_PILLS[row.status])}>{STATUS_LABELS[row.status]}</span>
              </h1>
              <p className="mt-1.5 text-ink-soft">
                {[entity ? "Entity" : "Individual", row.source ? SOURCE_LABELS[row.source] : null, row.assignedTo ? row.assignedTo.fullName : "No RM yet"]
                  .filter(Boolean).join(" • ")}
              </p>
            </div>
          </div>
          {/* All alike: none of them is the obvious next step for every prospect. The one that is open is marked. */}
          <div className="flex flex-wrap gap-2">
            {draft && detail.mayChange && <Action onClick={() => setEditing(true)} active={editing}>Complete details</Action>}
            {detail.mayChange && open && <Action icon={ChartNoAxesColumn} onClick={() => setLogging((was) => !was)} active={logging}>Log follow-up</Action>}
            {detail.mayChange && !draft && row.status !== "CONVERTED" && <Action icon={Pencil} onClick={() => setEditing(true)} active={editing}>Edit</Action>}
            {detail.mayChange && open && <Action icon={Bookmark} onClick={() => setLosing(true)} active={losing}>Mark as lost</Action>}
            {detail.mayChange && row.status === "LOST" && <Reopen id={row.id} />}
            {row.status === "CONVERTED" && detail.onboardingCaseId && !row.onboardingStage && (
              <Link to={`/onboarding/${detail.onboardingCaseId}`}
                className="inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-sm font-semibold text-ink hover:bg-canvas">
                Open their onboarding
              </Link>
            )}
          </div>
        </div>
        {draft && (
          <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-soft">
            A draft: nobody is following it up yet. Add an email or phone to start.
          </p>
        )}
        {logging && (
          <div ref={followUpBox}>
            <LogFollowUp detail={detail} onDone={() => setLogging(false)} />
          </div>
        )}
      </header>

      <ProspectPipeline detail={detail} />

      <div role="tablist" aria-label="About this prospect" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((one) => (
          <button key={one.id} type="button" role="tab" aria-selected={current === one.id} onClick={() => setTab(one.id)}
            className={cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold whitespace-nowrap",
              current === one.id ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink hover:bg-canvas")}>
            <one.icon aria-hidden="true" className="size-4" />
            {one.label}
          </button>
        ))}
      </div>

      {current === "details" && (
        <div className="grid items-start gap-5">
          <div className="space-y-4">
            <section aria-labelledby="client-details" className="rounded-2xl border border-line bg-white px-6 py-5">
              <h2 id="client-details" className="flex items-center gap-2.5 text-lg font-bold">
                <Info aria-hidden="true" className="size-6 rounded-full bg-primary-600 p-1 text-white" />
                Client details
              </h2>
              <dl className="mt-3 text-sm">
                <Row label="Reference">{row.reference}</Row>
                <Row label="Client type">{entity ? "Entity" : "Individual"}</Row>
                {row.source && <Row label="Source">{SOURCE_LABELS[row.source]}</Row>}
                {detail.referredBy && <Row label="Referred by">{detail.referredBy}</Row>}
                <Row label="Relationship manager">{row.assignedTo?.fullName ?? <Muted>Nobody yet</Muted>}</Row>
                <Row label="Email">{row.email ?? <Muted>None given</Muted>}{row.doNotEmail && <span className="ml-2 text-xs text-ink-muted">· asked not to be emailed</span>}</Row>
                <Row label="Phone">{row.phone ?? <Muted>None given</Muted>}</Row>
                <Row label="Country">{row.country ? countryName(row.country) : <Muted>Not said</Muted>}</Row>
                {detail.lostReason && <Row label="Lost because">{LOST_REASONS[detail.lostReason]}</Row>}
              </dl>
            </section>
            <p className="flex items-center gap-2.5 rounded-xl border border-line bg-slate-50 px-5 py-3 text-sm text-ink-soft">
              <CalendarDays aria-hidden="true" className="size-4 text-primary-700" />
              Added on {formatDateTime(detail.createdAt)} by {detail.createdBy}
            </p>
          </div>
        </div>
      )}

      {/* Its own cards on the page, as a client's Family group tab is laid out (24 Nov 2026). */}
      {current === "holders" && (
        <ProspectHolders prospectId={row.id} mainName={row.fullName} mainEmail={row.email ?? null} mainPhone={row.phone ?? null}
          mayChange={detail.mayChange && (open || draft)} />
      )}

      {current !== "details" && current !== "holders" && (
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        {current === "people" && <EntityParties prospectId={row.id} entityName={row.fullName} mayChange={detail.mayChange && (open || draft)} startOn="flow" />}
        {current === "documents" && <ProspectDocumentsTab detail={detail} />}
        {current === "agreement" && <ProspectAgreement prospectId={row.id} entity={entity} />}
        {current === "wealth" && <ProspectWealth prospectId={row.id} prospectName={row.fullName} mayChange={detail.mayChange} />}
        {current === "meetings" && <ProspectMeetings prospectId={row.id} mayChange={detail.mayChange && open} />}
        {current === "timeline" && <ProspectTimeline prospectId={row.id} />}
        {current === "call-notes" && <CallNotes prospectId={row.id} mayWrite={detail.mayChange && !draft} />}
        {current === "email" && <EmailBox detail={detail} />}
      </section>
      )}

      <LostDialog open={losing} detail={detail} onClose={() => setLosing(false)} />
      {editing && (
        <ProspectForm open editing={detail} onlyMine={false} me={user.id} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void prospect.refetch(); }} />
      )}
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Prospective Clients
    </Link>
  );
}

function Action({ onClick, active, icon: Icon, children }: { onClick: () => void; active: boolean; icon?: LucideIcon; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold",
        active ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line bg-white text-ink hover:bg-canvas")}>
      {Icon && <Icon aria-hidden="true" className="size-4" />}
      {children}
    </button>
  );
}

/** One line of the details card: the label on the left, ruled off from the next. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,14rem)_1fr] gap-x-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** The letters in the round badge: the first of each of two words, or the first three of a one-word name. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "?").slice(0, 3).toUpperCase();
}
