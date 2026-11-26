import { ApiError } from "@atomprive/api-client";
import {
  backToTheList,
  exceptOneClient,
  stopAskingForPaper,
  useAskForPaper,
  useGetKycChecklist,
  useListCustomers,
  useNameKycPaper,
  useStopAskingForPaper,
  type ChecklistForA,
  type ChecklistView,
  type CustomerPage,
  type PaperRow,
  changeChecklistPaperSettings,
  type ChecklistPaperSettings,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, Switch, TextInput, cn } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  BookUser,
  Building2,
  CircleCheck,
  Coins,
  FileBadge,
  FileSpreadsheet,
  FileText,
  Gavel,
  Gem,
  IdCard,
  MapPin,
  PencilLine,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createElement, useState } from "react";
import { useSearchParams } from "react-router";
import { HowOftenAsked } from "./how-often-asked";

type ClientType = ChecklistForA["clientType"];
type Reach = "ALL" | "NEW" | "EXISTING";

/** Who one paper is asked of: the kinds whose list it is on and which of them, or clients by name. */
interface Asked {
  kinds: ClientType[];
  which: Reach | "SPECIFIC";
  clients: { id: string; name: string }[];
}

/** Each built-in paper's picture; a paper the firm named itself is a plain page. */
const PAPER_ICON: Record<string, LucideIcon> = {
  PASSPORT: BookUser,
  NATIONAL_ID: IdCard,
  PROOF_OF_ADDRESS: MapPin,
  SOURCE_OF_FUNDS: Coins,
  SOURCE_OF_WEALTH: Gem,
  TRADE_LICENCE: FileBadge,
  CERTIFICATE_OF_INCUMBENCY: ShieldCheck,
  BOARD_RESOLUTION: Gavel,
  AUDITED_ACCOUNTS: FileSpreadsheet,
  SHAREHOLDER_REGISTER: Users,
};

/** Which clients of a kind a paper on the list is asked of, as a row says it. Every client says nothing. */
const REACH_NOTE: Record<Reach, string | null> = {
  ALL: null,
  NEW: "New clients only",
  EXISTING: "Existing clients only",
};

/** The choices in Add a paper: the three a list can hold, and a few clients picked by name. */
const WHICH_CLIENTS: { key: Reach | "SPECIFIC"; label: string; hint: string }[] = [
  { key: "ALL", label: "All clients", hint: "Existing and new" },
  { key: "NEW", label: "New clients only", hint: "Those added from today" },
  { key: "EXISTING", label: "Existing clients only", hint: "Not those added later" },
  { key: "SPECIFIC", label: "Specific clients", hint: "Picked by name" },
];

const KIND_OF_CLIENT: Record<ClientType, string> = {
  INDIVIDUAL: "An individual",
  ENTITY: "A company or trust",
};

const BOTH: ClientType[] = ["INDIVIDUAL", "ENTITY"];

/**
 * What the firm's KYC waits on, kept by the people who wait on it.
 *
 * <p>Both checklists were constants in the code — three papers for an individual, six for a company — so
 * asking every new client for a fourth, or dropping one the firm had stopped collecting, was a release.
 * Compliance keep them here instead, and a change takes effect on every client of that kind the moment it
 * is made.
 *
 * <p>One list, two switches to a row. The first cut put each checklist in a card of its own and then
 * listed every paper again underneath, so a paper appeared twice with nothing connecting the two mentions
 * and the rows ran the width of the window with the label at one end and its meaning at the other. Two
 * switches say the same thing the two lists say, in the shape the data is actually kept in: a paper is
 * asked of a kind of client or it is not, and those are two independent answers rather than one four-way
 * choice.
 *
 * <p>Asking one awkward client for something extra, or excusing one of them a paper everybody else owes,
 * is not done here. That is a fact about that client rather than about their kind, and it is written on
 * their own file.
 */
export function KycChecklistPage() {
  const queryClient = useQueryClient();
  const checklist = useGetKycChecklist<ChecklistView, ApiError>({
    query: { refetchOnWindowFocus: true },
  });

  if (checklist.isPending) {
    return <p className="text-sm text-ink-muted">Reading the firm's checklist…</p>;
  }
  if (checklist.isError) {
    return <Alert tone="danger">{checklist.error.message}</Alert>;
  }

  return <Checklist view={checklist.data} onChanged={() => void queryClient.invalidateQueries()} />;
}

function Checklist({ view, onChanged }: { view: ChecklistView; onChanged: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "often" ? "often" : "checklist";
  const [managing, setManaging] = useState(false);
  // The paper whose clients are being changed, or null while adding a new one.
  const [editing, setEditing] = useState<PaperRow | null>(null);
  // The paper and kind of client whose settings are open (23 Nov 2026).
  const [setting, setSetting] = useState<{ paper: PaperRow; clientType: ClientType } | null>(null);
  const settingsOf = (clientType: ClientType, paperId: string) =>
    view.lists.find((list) => list.clientType === clientType)?.settings[paperId];
  const ask = useAskForPaper<ApiError>({ mutation: { onSuccess: onChanged } });
  const stop = useStopAskingForPaper<ApiError>({ mutation: { onSuccess: onChanged } });
  const failed = ask.error ?? stop.error;
  const busy = ask.isPending || stop.isPending;

  // Which kinds of client each paper is asked of, turned round from the two lists the server keeps into
  // the one question each row asks.
  const askedFor = new Map<string, ClientType[]>();
  for (const list of view.lists) {
    for (const paper of list.papers) {
      askedFor.set(paper.id, [...(askedFor.get(paper.id) ?? []), list.clientType]);
    }
  }
  const reachOf = (clientType: ClientType, paperId: string): Reach =>
    view.lists.find((list) => list.clientType === clientType)?.appliesTo[paperId] ?? "ALL";
  /** Who a paper is asked of now, as the box starts out when it is opened to change that. */
  const nowAskedOf = (paper: PaperRow): Asked => {
    const kinds = askedFor.get(paper.id) ?? [];
    const clients = view.askedOfClients[paper.id] ?? [];
    const which = kinds.length > 0 ? reachOf(kinds[0]!, paper.id) : clients.length > 0 ? "SPECIFIC" : "ALL";
    return { kinds, which, clients };
  };
  const listFor = (clientType: ClientType) => view.lists.find((list) => list.clientType === clientType)?.papers.length ?? 0;
  const counted = view.lists
    .map((list) => `${list.papers.length} for ${KIND_OF_CLIENT[list.clientType].toLowerCase()}`)
    .join(" · ");

  return (
    <div className="space-y-6">
      <header className="space-y-5">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-600">
            <ShieldCheck aria-hidden="true" className="size-7" />
          </span>
          <div>
            <h1 className="text-[1.625rem] font-bold">KYC Compliance</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              Manage the required KYC documents and compliance settings for your clients.
            </p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total documents", value: view.papers.filter((one) => !one.retired).length, icon: FileText, tone: "bg-primary-50 text-primary-600" },
            { label: "Enabled for individuals", value: listFor("INDIVIDUAL"), icon: CircleCheck, tone: "bg-emerald-50 text-emerald-600" },
            { label: "Enabled for companies", value: listFor("ENTITY"), icon: Building2, tone: "bg-violet-50 text-violet-600" },
          ].map((tile) => (
            <div key={tile.label} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5">
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", tile.tone)}>
                <tile.icon aria-hidden="true" className="size-5" />
              </span>
              <div className="flex flex-col-reverse">
                <dt className="text-xs font-semibold text-ink-muted">{tile.label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{tile.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </header>

      {/* Two tabs since 26 Nov 2026: the checklist itself, and how often each paper is asked for again. Kept in the
          address, so a reload or a link opens the same one. */}
      <div role="tablist" aria-label="What KYC asks for" className="flex gap-2">
        {([["checklist", "The firm's checklist"], ["often", "How often it's asked"]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key}
            onClick={() => setSearchParams(key === "checklist" ? {} : { tab: key }, { replace: true })}
            className={cn("rounded-xl border px-4 py-2 text-sm font-semibold",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              tab === key ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink-soft hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "often" ? <HowOftenAsked view={view} /> : (
      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-bold">The firm's checklist</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {counted}. Both switches off means nobody is asked for it.
            </p>
          </div>
          <Button onClick={() => setManaging(true)}>
            Add a paper
          </Button>
        </div>

        {failed && <div className="px-5 pt-4"><Alert tone="danger">{failed.message}</Alert></div>}

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-x-5 px-5 pb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          <span>Paper</span>
          {BOTH.map((clientType) => <span key={clientType}>{KIND_OF_CLIENT[clientType]}</span>)}
          <span className="sr-only">Change</span>
        </div>

        <ul>
          {view.papers.map((paper) => {
            const kinds = askedFor.get(paper.id) ?? [];
            return (
              <li
                key={paper.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-x-5 border-t border-line px-5 hover:bg-slate-50"
              >
                {/* The name and whether it is still in use. Nothing about who named it: the list is read
                    to see what the firm asks for, and a tag on half the rows says nothing about that. The
                    "Add a paper" box says which are the firm's own, where it matters. */}
                <span className="flex min-w-0 items-center gap-3 py-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
                    {createElement(PAPER_ICON[paper.kind ?? ""] ?? FileText, { "aria-hidden": true, className: "size-4" })}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("truncate text-sm font-semibold", paper.retired && "text-ink-muted line-through")}>
                        {paper.name}
                      </span>
                      {paper.retired && <Badge tone="neutral">Out of use</Badge>}
                    </span>
                    {(view.askedOfClients[paper.id]?.length ?? 0) > 0 && (
                      <span className="block truncate text-xs text-ink-muted">
                        {kinds.length > 0 ? "Also asked of " : "Asked of "}
                        {view.askedOfClients[paper.id]!.map((one) => one.name).join(", ")}
                      </span>
                    )}
                  </span>
                </span>
                {BOTH.map((clientType) => (
                  <span key={clientType} className="py-2">
                    <Switch
                      label={`${paper.name}, asked of ${KIND_OF_CLIENT[clientType].toLowerCase()}`}
                      on={kinds.includes(clientType)}
                      onLabel="Asked for"
                      offLabel="No"
                      disabled={paper.retired}
                      busy={busy}
                      onChange={(on) =>
                        on
                          ? ask.mutate({ clientType, data: { paperId: paper.id, appliesTo: null } })
                          : stop.mutate({ clientType, paperId: paper.id })
                      }
                    />
                    {kinds.includes(clientType) && REACH_NOTE[reachOf(clientType, paper.id)] && (
                      <span className="mt-0.5 block text-xs text-ink-muted">{REACH_NOTE[reachOf(clientType, paper.id)]}</span>
                    )}
                    {kinds.includes(clientType) && settingsOf(clientType, paper.id) && (
                      <button type="button" onClick={() => setSetting({ paper, clientType })}
                        className="mt-0.5 block text-left text-xs text-primary-700 hover:underline">
                        {summaryOf(settingsOf(clientType, paper.id)!)}
                      </button>
                    )}
                  </span>
                ))}
                <span className="flex justify-end">
                  <Button variant="ghost" size="sm" disabled={paper.retired} onClick={() => setEditing(paper)}
                    aria-label={`Change who is asked for ${paper.name}`}>
                    <PencilLine aria-hidden="true" />
                    Edit
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      )}

      {setting && settingsOf(setting.clientType, setting.paper.id) && (
        <SettingsDialog paper={setting.paper} clientType={setting.clientType}
          settings={settingsOf(setting.clientType, setting.paper.id)!}
          onClose={() => setSetting(null)} onSaved={() => { setSetting(null); onChanged(); }} />
      )}

      {/* Keyed by what it is opened for, so each opening starts from that paper's own answers. */}
      <PapersTheFirmKnowsOf
        key={editing?.id ?? "new"}
        open={managing || editing !== null}
        paper={editing}
        was={editing ? nowAskedOf(editing) : undefined}
        onClose={() => {
          setManaging(false);
          setEditing(null);
        }}
        onChanged={onChanged}
      />
    </div>
  );
}

/**
 * Naming a paper the platform has never heard of, and saying who has to hand it over.
 *
 * <p>Behind the one button rather than on the list, where a field under twelve rows was read as part of
 * the last row. Both halves of the answer are given here, because a paper named and asked of nobody is a
 * row the reader then has to find and switch on — and the two switches are the same two the row carries,
 * so what is set here is what the new row will show.
 *
 * <p>Taking a paper out of use is not offered anywhere on this screen. The endpoint is there and tested,
 * and nothing reaches it.
 */
function PapersTheFirmKnowsOf({ open, paper: editing, was, onClose, onChanged }: {
  open: boolean;
  /** The paper being changed; left out, a new one is named. */
  paper?: PaperRow | null;
  /** Who that paper is asked of now. */
  was?: Asked;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [kinds, setKinds] = useState<ClientType[]>(was?.kinds ?? []);
  const [which, setWhich] = useState<Reach | "SPECIFIC">(was?.which ?? "ALL");
  const [chosen, setChosen] = useState<{ id: string; name: string }[]>(was?.clients ?? []);
  const specific = which === "SPECIFIC";
  const [failed, setFailed] = useState<string>();
  const [adding, setAdding] = useState(false);
  // Add it pressed with no name: the box shows in red until one is typed.
  const [tried, setTried] = useState(false);
  const noneChosen = tried && specific && chosen.length === 0;
  const unnamed = tried && name.trim().length === 0;
  const named = useNameKycPaper<ApiError>();
  const ask = useAskForPaper<ApiError>();

  function clear() {
    setName(editing?.name ?? "");
    setKinds(was?.kinds ?? []);
    setWhich(was?.which ?? "ALL");
    setChosen(was?.clients ?? []);
    setFailed(undefined);
    setTried(false);
  }

  /**
   * Names the paper, then puts it on each checklist that was switched on.
   *
   * <p>Two calls rather than one, because that is what the server offers: naming a paper and asking a kind
   * of client for it are separate things, and the second is the same call the row's own switch makes. A
   * failure part-way leaves the paper named and says so, rather than pretending nothing happened — the
   * name is matched rather than added twice, so pressing Add it again finishes the job.
   */
  async function add() {
    if (name.trim().length === 0) {
      setTried(true);
      document.getElementById("name-a-paper")?.focus();
      return;
    }
    if (specific && chosen.length === 0) {
      setTried(true);
      document.getElementById("pick-a-client")?.focus();
      return;
    }
    setFailed(undefined);
    setAdding(true);
    try {
      const paper = editing ?? await named.mutateAsync({ data: { name: name.trim() } });
      const before = was ?? { kinds: [], which: "ALL", clients: [] };
      // The choice made here replaces the one before it: off the lists it no longer belongs on, and off the
      // file of any client it is no longer asked of by name (the firm, 16 Nov 2026).
      if (specific) {
        for (const clientType of before.kinds) {
          await stopAskingForPaper(clientType, paper.id);
        }
        for (const client of chosen) {
          if (!before.clients.some((one) => one.id === client.id)) {
            // On each chosen client's own file, the way one client is asked for something extra there.
            await exceptOneClient(client.id, { paperId: paper.id, required: true, why: null });
          }
        }
        for (const client of before.clients) {
          if (!chosen.some((one) => one.id === client.id)) await backToTheList(client.id, paper.id);
        }
      } else {
        for (const clientType of BOTH) {
          if (kinds.includes(clientType)) {
            await ask.mutateAsync({ clientType, data: { paperId: paper.id, appliesTo: which } });
          } else if (before.kinds.includes(clientType)) {
            await stopAskingForPaper(clientType, paper.id);
          }
        }
        for (const client of before.clients) await backToTheList(client.id, paper.id);
      }
      onChanged();
      clear();
      onClose();
    }
    catch (caught) {
      setFailed(caught instanceof ApiError ? caught.message : editing ? "Couldn't save it. Try again." : "Couldn't add it. Try again.");
    }
    finally {
      setAdding(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={editing ? `Edit “${editing.name}”` : "Add a paper"}
      description={editing
        ? "Change which clients are asked for it. Clients no longer covered stop being asked; nothing already on a file moves."
        : "Names a paper the firm asks for, so it can go on the checklist before anybody has sent one."}
      onClose={() => {
        clear();
        onClose();
      }}
    >
      <div className="space-y-5">
        {failed && <Alert tone="danger">{failed}</Alert>}

        <Field
          id="name-a-paper"
          label="What is it called?"
          required={!editing}
          hint={editing ? "The name stays as it is." : "A name already on the list is matched rather than added twice, whatever its case or spacing."}
          error={unnamed ? "Enter a name." : undefined}
        >
          <TextInput
            id="name-a-paper"
            readOnly={Boolean(editing)}
            aria-invalid={unnamed || undefined}
            value={name}
            maxLength={120}
            placeholder="Trust deed"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Asked of</p>
          {/* The kind first, the switch after it, so the two switches line up as a pair instead of each
              one being read as part of the words beside it — "No An individual". */}
          <div className={cn("mt-2 divide-y divide-line rounded-xl border border-line", specific && "opacity-50")}>
            {BOTH.map((clientType) => (
              <div key={clientType} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-ink">{KIND_OF_CLIENT[clientType]}</span>
                <Switch
                  // A fixed width, or the two tracks sit at different x because "Asked for" is wider
                  // than "No" and the control is pushed to the right-hand edge.
                  className="w-[8.5rem] shrink-0"
                  label={`Asked of ${KIND_OF_CLIENT[clientType].toLowerCase()}`}
                  on={kinds.includes(clientType)}
                  onLabel="Asked for"
                  offLabel="No"
                  busy={adding}
                  disabled={specific}
                  onChange={(on) =>
                    setKinds((was) =>
                      on ? [...was, clientType] : was.filter((one) => one !== clientType))
                  }
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {specific
              ? "Not used for specific clients: the paper goes on each chosen client's own file."
              : kinds.length === 0
                ? "Left off, the paper is named but nobody is asked for it yet. You can switch it on from the list."
                : which === "NEW"
                  ? "Clients of that kind added from today are asked for it. Those already on the books are not."
                  : which === "EXISTING"
                    ? "Clients of that kind already on the books are asked for it. Those added later are not."
                    : "Every client of that kind is asked for it from the moment this is added."}
          </p>
        </div>

        <fieldset>
          <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Which clients</legend>
          <div className="mt-2 divide-y divide-line rounded-xl border border-line">
            {WHICH_CLIENTS.map((one) => (
              <label key={one.key} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <input type="radio" name="which-clients" value={one.key} checked={which === one.key}
                  onChange={() => setWhich(one.key)} className="size-4 accent-primary-600" />
                <span className="text-ink">{one.label}</span>
                <span className="text-xs text-ink-muted">{one.hint}</span>
              </label>
            ))}
          </div>
          {specific && (
            <div className="mt-3">
              <PickClients chosen={chosen} invalid={noneChosen}
                onPick={(client) => setChosen((was) => was.some((one) => one.id === client.id) ? was : [...was, client])}
                onDrop={(id) => setChosen((was) => was.filter((one) => one.id !== id))} />
            </div>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            A client already approved stays approved; the paper shows as outstanding on their file until they send it.
          </p>
        </fieldset>

        <div className="flex justify-end gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              clear();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button disabled={adding} onClick={() => void add()}>
            {editing ? (adding ? "Saving\u2026" : "Save") : adding ? "Adding\u2026" : "Add it"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Clients picked by name for a paper asked of them in particular: a search box, its matches, and the picks. */
function PickClients({ chosen, invalid, onPick, onDrop }: {
  chosen: { id: string; name: string }[];
  invalid: boolean;
  onPick: (client: { id: string; name: string }) => void;
  onDrop: (id: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const query = typed.trim();
  const found = useListCustomers<CustomerPage, ApiError>(
    { query, page: 0, size: 6 },
    { query: { enabled: query.length > 0, placeholderData: keepPreviousData } },
  );
  const matches = (found.data?.items ?? []).filter((one) => !chosen.some((picked) => picked.id === one.id));
  return (
    <Field id="pick-a-client" label="Clients" required error={invalid ? "Choose at least one client." : undefined}>
      <div className="space-y-2">
        <TextInput id="pick-a-client" aria-invalid={invalid || undefined} value={typed} placeholder="Search a client by name or code"
          autoComplete="off" onChange={(event) => setTyped(event.target.value)} />
        {query.length > 0 && (
          <ul className="max-h-48 overflow-y-auto rounded-xl border border-line">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-muted">{found.isFetching ? "Searching…" : `No clients match “${query}”.`}</li>
            ) : matches.map((one) => (
              <li key={one.id}>
                <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => { onPick({ id: one.id, name: one.fullName }); setTyped(""); }}>
                  <span className="truncate font-semibold text-ink">{one.fullName}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">{one.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {chosen.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chosen.map((one) => (
              <span key={one.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-slate-50 py-0.5 pr-1 pl-2.5 text-xs font-semibold text-ink">
                {one.name}
                <button type="button" aria-label={`Take ${one.name} off`} onClick={() => onDrop(one.id)}
                  className="rounded-full p-0.5 text-ink-muted hover:text-ink">
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

const CATEGORIES: Record<ChecklistPaperSettings["category"], string> = {
  IDENTITY: "Identity", ADDRESS: "Address proof", INCOME: "Income", SOURCE_OF_FUNDS: "Source of funds", ENTITY: "Entity", OTHER: "Other",
};

/** One line saying what Compliance set for a paper on a list (23 Nov 2026). */
function summaryOf(settings: ChecklistPaperSettings) {
  return [settings.mandatory ? "Mandatory" : "Optional", CATEGORIES[settings.category],
    settings.multipleFiles ? null : "one file", settings.expiryRequired ? "expiry required" : null,
    settings.onboardingOnly ? "onboarding only" : null].filter(Boolean).join(" · ") + " — settings";
}

/**
 * What a paper on a kind of client's list asks (23 Nov 2026): mandatory before a prospect is approved, its category,
 * several files or one, an expiry date required, and instructions for the RM and Operations.
 */
function SettingsDialog({ paper, clientType, settings, onClose, onSaved }: {
  paper: PaperRow;
  clientType: ClientType;
  settings: ChecklistPaperSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mandatory, setMandatory] = useState(settings.mandatory);
  const [category, setCategory] = useState(settings.category);
  const [multiple, setMultiple] = useState(settings.multipleFiles);
  const [expiry, setExpiry] = useState(settings.expiryRequired);
  const [instructions, setInstructions] = useState(settings.instructions ?? "");
  const [problem, setProblem] = useState<string>();
  async function save() {
    setProblem(undefined);
    try {
      await changeChecklistPaperSettings(clientType, paper.id, {
        mandatory, category, multipleFiles: multiple, expiryRequired: expiry, instructions: instructions.trim() || null,
      });
      onSaved();
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "That couldn't be saved.");
    }
  }
  return (
    <Dialog open onClose={onClose} title={`${paper.name} · ${KIND_OF_CLIENT[clientType]}`} description="What this paper asks of this kind of client.">
      <div className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}
        <Switch label="Mandatory before Compliance approve a prospect" on={mandatory} onLabel="Mandatory" offLabel="Optional" onChange={setMandatory} />
        <Field id="paper-category" label="Category">
          <select id="paper-category" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}
            className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm">
            {Object.entries(CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <Switch label="Several files may be put on file for it" on={multiple} onLabel="Several files" offLabel="One file" onChange={setMultiple} />
        <Switch label="It must carry an expiry date" on={expiry} onLabel="Expiry required" offLabel="No expiry" onChange={setExpiry} />
        <Field id="paper-instructions" label="Instructions for the RM and Operations" hint="Shown beside the paper when they upload it.">
          <TextInput id="paper-instructions" value={instructions} maxLength={500} placeholder="e.g. Utility bill or tenancy, under 3 months old"
            onChange={(event) => setInstructions(event.target.value)} />
        </Field>
        {settings.onboardingOnly && <p className="text-xs text-ink-muted">Asked only while a prospect is onboarded; not part of a client's standing KYC.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()}>Save</Button>
        </div>
      </div>
    </Dialog>
  );
}
