import { ApiError } from "@atomprive/api-client";
import {
  getReadKycDocumentUrl,
  useBackToTheList,
  useExceptOneClient,
  useGetClientKycFile,
  type ClientKycFile,
  type ClientPaperRow,
  type KycDocumentRow,
  type KycRequirement,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Field, TextArea, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ExternalLink } from "lucide-react";
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
    // What the paper IS, as against what the file is called. A client sends "scan_01.pdf" and a firm
    // needs to know it is a passport; the two were one cell, with the kind in small grey type under the
    // file name, so the thing being decided on was the thing hardest to read down the page.
    id: "kind",
    label: "What it is",
    nowrap: true,
    cell: (row) => <span className="font-medium text-ink">{row.kindTitle}</span>,
  },
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
  // Putting a paper on file is Compliance's for any client and a relationship manager's for their own.
  const mayAdd = hasAnyAuthority(useStaffUser(), ...UPLOADS_CLIENT_DOCUMENTS);
  // Departing from the firm's own checklist for one client is Compliance's, like signing the KYC off: the
  // relationship manager who puts the papers on file does not decide which of them are owed.
  const keepsTheChecklist = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:CHANGE");

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
          <Avatar name={file.data.clientName} photo={file.data.clientPhoto} />
          <div>
            <h1 className="text-[1.625rem] font-bold">{file.data.clientName}</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              {clientLine(file.data.clientType, file.data.clientCode)}
              {file.data.advisorName ? ` · relationship manager ${file.data.advisorName}` : ""}
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
            // No plus before the word. "Add" already says what the button does, and the glyph beside it
            // says it a second time.
            <Button onClick={() => setAdding(true)}>Add a document</Button>
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

      {(file.data.checklist.length > 0 || file.data.exceptions.length > 0) && (
        <Checklist
          customerId={file.data.customerId}
          clientName={file.data.clientName}
          checklist={file.data.checklist}
          exceptions={file.data.exceptions}
          keepsTheChecklist={keepsTheChecklist}
        />
      )}

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
                          {row.reference ? `${row.reference} · ` : ""}{pageCount(row.pages)}
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
}

/**
 * What this client's KYC waits on, and where each of it has got to.
 *
 * <p>Where their KYC stands is read off their papers rather than set by hand, so a client stays pending until
 * every paper here is on file and approved — this is the list that says why. A tick alone would not: a paper
 * nobody has sent is chased, one waiting on Compliance is read, one sent back is waited on, and one that has
 * run out is asked for again. Each says which it is, and whose move it is.
 */
function Checklist({
  customerId,
  clientName,
  checklist,
  exceptions,
  keepsTheChecklist,
}: {
  customerId: string;
  clientName: string;
  checklist: KycRequirement[];
  exceptions: ClientPaperRow[];
  keepsTheChecklist: boolean;
}) {
  const stillToCome = checklist.filter((one) => !one.settled);
  const ours = stillToCome.filter((one) => paperWaitsOn[one.stands] === "compliance");
  const excused = exceptions.filter((one) => !one.required);
  const reasons = new Map(exceptions.map((one) => [one.paperId, one.why]));

  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries();
  /** The paper a reason is being given for, and which way round it is being decided. */
  const [deciding, setDeciding] = useState<{ paperId: string; title: string } | null>(null);
  const lift = useBackToTheList<ApiError>({ mutation: { onSuccess: refresh } });

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold">What the KYC waits on</h2>
        <p className="text-sm font-semibold tabular-nums text-ink-soft">
          {checklist.length - stillToCome.length} of {checklist.length} in
        </p>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">
        {stillToCome.length === 0
          ? "Every paper on the checklist is in and approved."
          : `${stillToCome.length} still to come${ours.length > 0 ? `, ${ours.length} of them with Compliance` : ""} · the KYC reads as approved once every one of these is on file and approved`}
      </p>
      {lift.isError && <div className="mt-3"><Alert tone="danger">{lift.error.message}</Alert></div>}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {checklist.map((one) => (
          <li
            key={one.paperId}
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
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {one.kindTitle}
                {/* Asked of this client in particular, rather than of everybody of their kind. Unmarked,
                    a reader has no way to tell the firm's own checklist from a departure from it. */}
                {one.exceptional && <span className="text-2xs font-semibold text-primary-600"> · asked of them</span>}
              </span>
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
              {one.exceptional && reasons.get(one.paperId) && (
                <span className="mt-0.5 block text-2xs text-ink-soft italic">{reasons.get(one.paperId)}</span>
              )}
              {keepsTheChecklist && (
                <button
                  type="button"
                  disabled={lift.isPending}
                  onClick={() =>
                    one.exceptional
                      ? lift.mutate({ customerId, paperId: one.paperId })
                      : setDeciding({ paperId: one.paperId, title: one.kindTitle })
                  }
                  className="mt-1.5 text-2xs font-semibold text-ink-muted hover:text-primary-700 hover:underline disabled:opacity-50"
                >
                  {one.exceptional ? "Stop asking for this" : "Excuse this client"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {excused.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-3">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Excused · not waited on for this client
          </p>
          <ul className="mt-2 space-y-1.5">
            {excused.map((one) => (
              <li key={one.paperId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-ink-soft line-through">{one.title}</span>
                {one.why && <span className="text-xs text-ink-muted italic">{one.why}</span>}
                <span className="text-2xs text-ink-muted">
                  {one.decidedBy ? `${one.decidedBy}, ` : ""}
                  {formatDate(one.decidedAt.slice(0, 10))}
                </span>
                {keepsTheChecklist && (
                  <button
                    type="button"
                    disabled={lift.isPending}
                    onClick={() => lift.mutate({ customerId, paperId: one.paperId })}
                    className="text-2xs font-semibold text-primary-700 hover:underline disabled:opacity-50"
                  >
                    Ask for it after all
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Asking one client for a paper their kind does not owe was offered here and is not any more. What
          the firm asks of a kind of client is kept on its own screen; a second way in, on one client's
          file, is a second place the answer can come from. Excusing a client stays — that is a departure
          the file itself has to carry, and the strip above is where it is read and put back. */}

      <WhyThisClient
        deciding={deciding}
        customerId={customerId}
        clientName={clientName}
        onClose={() => setDeciding(null)}
        onSaved={() => {
          setDeciding(null);
          refresh();
        }}
      />
    </section>
  );
}

/**
 * Why this client is being treated differently from the rest of their kind.
 *
 * <p>Offered rather than demanded. It was demanded at first, on the ground that an exception nobody wrote
 * down is one nobody can answer for; a box that has to be filled to get past it is a box that gets filled
 * with a full stop, and the firm decided otherwise.
 */
function WhyThisClient({
  deciding,
  customerId,
  clientName,
  onClose,
  onSaved,
}: {
  deciding: { paperId: string; title: string } | null;
  customerId: string;
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [why, setWhy] = useState("");
  const except = useExceptOneClient<ApiError>({ mutation: { onSuccess: onSaved } });

  return (
    <Dialog
      open={deciding !== null}
      title={deciding ? `Excuse ${clientName} ${deciding.title.toLowerCase()}?` : ""}
      description="Their kind of client owes this. Excusing it stops their KYC waiting on it — nobody else's changes."
      onClose={() => {
        setWhy("");
        except.reset();
        onClose();
      }}
    >
      <div className="space-y-3">
        {except.isError && <Alert tone="danger">{except.error.message}</Alert>}
        <Field
          id="exception-why"
          label="Why"
          hint="Optional. Whoever reads this file in a year will have only what is written here."
        >
          <TextArea
            id="exception-why"
            rows={3}
            maxLength={500}
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            placeholder="Already held under the family trust."
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setWhy("");
              except.reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={except.isPending || !deciding}
            onClick={() => {
              if (!deciding) return;
              except.mutate({
                customerId,
                // The API's switch goes both ways — true asks a client for a paper their kind does not owe,
                // false excuses one their kind does. This screen only ever excuses: asking for an extra paper
                // was taken off it, and what a kind of client owes is kept on What KYC asks for.
                data: { paperId: deciding.paperId, required: false, why: why.trim() || null },
              });
              setWhy("");
            }}
          >
            Excuse it
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Back where they came from: Compliance from the review queue, a relationship manager from their own clients. */
function BackLink() {
  const user = useStaffUser();
  // A client's file is opened from the review queue to see why they are not ready, from the document review
  // to decide on what they sent, and from Client documents to add to their file. Each says which, so Back
  // returns there instead of to whichever one the reader's permissions happen to favour — which sent
  // anybody who came from Client documents off to a screen they had not been on.
  const { customerId = "" } = useParams();
  const [search] = useSearchParams();
  const came = CAME_FROM[search.get("from") ?? ""];
  // Nothing in the address said where this was opened from — a bookmark, or a pasted link. Back then has to
  // name a screen this reader can actually get to, which is not the same as one they may read: the document
  // review is guarded on APPROVE_ONBOARDING:CHANGE, and Operations hold that permission only as VIEW_ONLY.
  // Asking for :VIEW here sent them back to a screen that is not on their menu and that the API refuses.
  const decides = hasAuthority(user, "APPROVE_ONBOARDING:CHANGE");
  const files = hasAnyAuthority(user, ...UPLOADS_CLIENT_DOCUMENTS);
  const fallback = decides
    ? { to: "/kyc-documents", label: "KYC document review" }
    : files
      ? { to: "/client-documents", label: "Client documents" }
      : { to: `/clients/${customerId}`, label: "The client" };
  const { to, label } = came ?? fallback;
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
