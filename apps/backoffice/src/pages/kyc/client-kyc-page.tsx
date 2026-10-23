import { ApiError } from "@atomprive/api-client";
import {
  getReadKycDocumentUrl,
  useGetClientKycFile,
  type ClientKycFile,
  type KycDocumentRow,
  type KycRequirement,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn } from "@atomprive/ui";
import { Check, ChevronLeft, ExternalLink, Plus } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { openApiFile } from "../../lib/download";
import { formatDate } from "../../lib/labels";
import { kycStatusLabels, kycStatusTones } from "../clients/client-labels";
import { useStaffUser } from "../../auth/session";
import { clientLine, fileMark, pageCount, reviewStateLabels, reviewStateTones } from "./kyc-labels";
import { paperLabels, paperWaitsOn } from "./kyc-labels-review";
import { DecidedBy, PutOnFileBy } from "./kyc-who";
import { UploadKycDialog } from "./upload-kyc-dialog";
import { hasAnyAuthority, hasAuthority, UPLOADS_CLIENT_DOCUMENTS } from "../../lib/permissions";

/** Where a client's file can be opened from, so Back returns to the screen the reader actually left. */
const CAME_FROM: Record<string, { to: string; label: string }> = {
  queue: { to: "/kyc", label: "KYC review queue" },
  review: { to: "/kyc-documents", label: "KYC document review" },
  documents: { to: "/client-documents", label: "Client documents" },
};

/** The longest a reason can be, as the API allows. */
/**
 * One client's KYC pack and the decision on it. A paper is judged against the rest of what they have handed
 * over, so the whole file is here; the decision applies to the one document chosen, and the reason given is
 * shown to the client when it is turned down (#83).
 */
/** One column of the pack a reader may move: its heading, and what it draws on a row. */
type Column = {
  id: string;
  label: string;
  nowrap?: boolean;
  tone?: string;
  cell: (row: KycDocumentRow) => ReactNode;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>The document itself is not among them: every row here is one paper of this one client's, so a row
 * that does not name the paper names nothing. The way through to reading it is, because it has a heading
 * of its own — and a reader who takes it off still opens any paper by clicking its row.
 */
const MOVABLE: Column[] = [
  {
    id: "uploaded",
    label: "Uploaded",
    tone: "text-ink-soft",
    cell: (row) => <PutOnFileBy at={row.uploadedAt} by={row.uploadedByName} />,
  },
  {
    id: "status",
    label: "Status",
    cell: (row) => (
      <>
        <Badge tone={reviewStateTones[row.reviewState]}>{reviewStateLabels[row.reviewState]}</Badge>
        <p className="mt-1 max-w-sm text-2xs leading-relaxed text-ink-muted">
          <DecidedBy
            by={row.decidedByName}
            at={row.decidedAt}
            reason={row.decisionReason}
          >
            Nobody has decided on it yet
          </DecidedBy>
        </p>
      </>
    ),
  },
  {
    id: "expires",
    label: "Expires",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (row) => (row.expiresOn ? formatDate(row.expiresOn) : "—"),
  },
  {
    id: "action",
    label: "Action",
    cell: (row) => (
      // Served through the API so that every look is recorded against the client.
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void openApiFile(`/api${getReadKycDocumentUrl(row.id).replace("/api", "")}`, row.fileName);
        }}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
      >
        Open in a tab
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </button>
    ),
  },
];

export function ClientKycPage() {
  const { customerId = "" } = useParams();
  const file = useGetClientKycFile<ClientKycFile, ApiError>(customerId, {
    query: { enabled: Boolean(customerId) },
  });
  // Set when a decision was just recorded on a document's own screen and this page was returned to.
  const decided = (useLocation().state as { decided?: boolean } | null)?.decided === true;
  const [search] = useSearchParams();
  const from = search.get("from");
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  // Putting a paper on file is Compliance's for any client and an advisor's for their own.
  const mayAdd = hasAnyAuthority(useStaffUser(), ...UPLOADS_CLIENT_DOCUMENTS);

  const documents = file.data?.documents ?? [];
  const waiting = documents.filter((one) => one.reviewState === "AWAITING_REVIEW");
  // Read before the pack has arrived, because how this reader has arranged it is a thing about them and
  // not about the fetch — a hook React sees on one render and not the next is a hook it cannot keep in
  // order.
  const view = useTableView("client-kyc-documents", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  if (!file.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        {file.isError ? <Alert tone="danger">{file.error.message}</Alert> : <p className="text-sm text-ink-muted">Loading the client's pack…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <Avatar name={file.data.clientName} />
          <div>
            <h1 className="text-[1.625rem] font-bold">{file.data.clientName}</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              {clientLine(file.data.clientType, file.data.clientCode)}
              {file.data.advisorName ? ` · advisor ${file.data.advisorName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">KYC</p>
            <Badge tone={kycStatusTones[file.data.kycStatus]}>{kycStatusLabels[file.data.kycStatus]}</Badge>
          </div>
          {/* Reading a client's papers and adding to them are different permissions: Operations read
              every client's to service them and add to none. A button that only ever came back refused
              is worse than no button. */}
          {mayAdd && (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Add a document
            </Button>
          )}
        </div>
      </header>

      <UploadKycDialog
        customerId={customerId}
        clientName={file.data.clientName}
        open={adding}
        onClose={() => setAdding(false)}
      />

      {/* Returned to from a document's own screen, where the decision was recorded. What it was is on the
          document's own row below, and where the client now stands is in the badge above. */}
      {decided && (
        <Alert tone="success">
          Recorded. {file.data.clientName}'s KYC now stands at{" "}
          {kycStatusLabels[file.data.kycStatus].toLowerCase()}.
        </Alert>
      )}

      {file.data.checklist.length > 0 && <Checklist checklist={file.data.checklist} />}

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
          <div>
            <h2 className="text-base font-bold">Documents on file</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Choose a document to decide on · {waiting.length} awaiting review
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewTabs
              views={view.views}
              current={view.current}
              edited={view.current === null ? view.arranged : view.changed}
              onPick={(name) => (name === null ? view.reset() : view.apply(name))}
              onSave={view.saveAs}
              onDelete={view.remove}
              firstLabel="Everything on file"
            />
            <ColumnPicker
              columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
              shown={new Set(view.shown)}
              order={view.order}
              arranged={view.arranged}
              onChange={(next) => {
                for (const one of MOVABLE) {
                  if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                }
              }}
              onMove={view.move}
              onReset={view.reset}
            />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-6">Document</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      column.nowrap && "whitespace-nowrap",
                      at === shownColumns.length - 1 && "pr-6",
                      drag.dragging === column.id && "cursor-grabbing opacity-40",
                      drag.over === column.id && "bg-primary-50",
                    )}
                    title={`Drag to move ${column.label}`}
                  >
                    {column.label}
                    <span className="sr-only">
                      , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documents.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-6 py-10 text-center text-ink-muted">
                    Nothing on file for this client yet.
                  </td>
                </tr>
              )}
              {documents.map((row) => (
                <Fragment key={row.id}>
                <tr
                  // A document is read on its own screen, where it has the room: any of them opens, decided
                  // on or not, because a decision already taken is still worth reading back.
                  onClick={() => void navigate(`/kyc/${customerId}/documents/${row.id}${from ? `?from=${from}` : ""}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-6">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-line bg-slate-50 text-2xs font-bold text-ink-soft">
                        {fileMark(row.contentType)}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{row.fileName}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {row.kindTitle}
                          {row.reference ? ` · ${row.reference}` : ""} · {pageCount(row.pages)}
                        </span>
                      </div>
                    </div>
                  </td>
                  {/* The cells in the order the headings are in, out of the one list that holds both. */}
                  {shownColumns.map((column, at) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3",
                        column.nowrap && "whitespace-nowrap",
                        at === shownColumns.length - 1 && "pr-6",
                        column.tone,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );



/** Back where they came from: Compliance from the review queue, an advisor from their own clients. */
/**
 * What this client's KYC waits on, and where each of it has got to.
 *
 * <p>Where their KYC stands is read off their papers rather than set by hand, so a client stays pending until
 * every paper here is on file and approved — this is the list that says why. A tick alone would not: a paper
 * nobody has sent is chased, one waiting on Compliance is read, one sent back is waited on, and one that has
 * run out is asked for again. Each says which it is, and whose move it is.
 */
function Checklist({ checklist }: { checklist: KycRequirement[] }) {
  const stillToCome = checklist.filter((one) => !one.settled);
  const ours = stillToCome.filter((one) => paperWaitsOn[one.stands] === "compliance");

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-base font-bold">What the KYC waits on</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        {stillToCome.length === 0
          ? "Every paper on the checklist is in and approved."
          : `${stillToCome.length} still to come${ours.length > 0 ? `, ${ours.length} of them with Compliance` : ""} · the KYC reads as approved once every one of these is on file and approved`}
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {checklist.map((one) => (
          <li
            key={one.kind}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
              one.settled ? "border-emerald-200 bg-emerald-50" : "border-line bg-slate-50",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                one.settled ? "border-emerald-600 bg-emerald-600 text-on-accent" : "border-line bg-white",
              )}
            >
              {one.settled && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{one.kindTitle}</span>
              <span className="block text-2xs text-ink-muted">
                {paperLabels[one.stands]}
                {/* Whose move it is, where it is anybody's. An approved paper is nobody's move. */}
                {paperWaitsOn[one.stands] === "client" && " · waiting on the client"}
                {paperWaitsOn[one.stands] === "compliance" && " · waiting on Compliance"}
              </span>
              {one.expiresOn && (
                <span className="block text-2xs text-ink-muted">
                  {one.stands === "EXPIRED" ? "Ran out " : "Runs out "}
                  {formatDate(one.expiresOn)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BackLink() {
  const decides = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:VIEW");
  // A client's file is opened from three screens: the review queue to see why they are not ready, the
  // document review to decide on what they sent, and Client documents to add to their file. Each says
  // which, so Back returns there instead of to whichever one the reader's permissions happen to favour —
  // which sent anybody who came from Client documents off to a screen they had not been on.
  const [search] = useSearchParams();
  const came = CAME_FROM[search.get("from") ?? ""];
  const to = came ? came.to : decides ? "/kyc-documents" : "/client-documents";
  const label = came ? came.label : decides ? "KYC document review" : "Client documents";
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
}
