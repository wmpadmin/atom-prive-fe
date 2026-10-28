import { ApiError } from "@atomprive/api-client";
import {
  useAskForPaper,
  useGetKycChecklist,
  useNameKycPaper,
  useStopAskingForPaper,
  type ChecklistForA,
  type ChecklistView,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, Switch, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import {  } from "lucide-react";
import { useState } from "react";

type ClientType = ChecklistForA["clientType"];

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
  const [managing, setManaging] = useState(false);
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
  const counted = view.lists
    .map((list) => `${list.papers.length} for ${KIND_OF_CLIENT[list.clientType].toLowerCase()}`)
    .join(" · ");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">What KYC asks for</h1>
        <p className="mt-1 max-w-[74ch] text-sm text-ink-muted">
          The papers a client's KYC waits on, and who has to hand each one over. Switch one on and every
          client of that kind is asked for it from that moment; switch it off and the firm stops waiting —
          nothing already on a file moves either way. One client who owes something different is excepted on
          their own file, not here.
        </p>
      </header>

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

        <div className="mt-4 grid grid-cols-3 items-center gap-x-5 px-5 pb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          <span>Paper</span>
          {BOTH.map((clientType) => <span key={clientType}>{KIND_OF_CLIENT[clientType]}</span>)}
        </div>

        <ul>
          {view.papers.map((paper) => {
            const kinds = askedFor.get(paper.id) ?? [];
            return (
              <li
                key={paper.id}
                className="grid grid-cols-3 items-center gap-x-5 border-t border-line px-5 hover:bg-slate-50"
              >
                {/* The name and whether it is still in use. Nothing about who named it: the list is read
                    to see what the firm asks for, and a tag on half the rows says nothing about that. The
                    "Add a paper" box says which are the firm's own, where it matters. */}
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("truncate text-sm font-semibold", paper.retired && "text-ink-muted line-through")}>
                    {paper.name}
                  </span>
                  {paper.retired && <Badge tone="neutral">Out of use</Badge>}
                </span>
                {BOTH.map((clientType) => (
                  <Switch
                    key={clientType}
                    className="py-2"
                    label={`${paper.name}, asked of ${KIND_OF_CLIENT[clientType].toLowerCase()}`}
                    on={kinds.includes(clientType)}
                    onLabel="Asked for"
                    offLabel="No"
                    disabled={paper.retired}
                    busy={busy}
                    onChange={(on) =>
                      on
                        ? ask.mutate({ clientType, data: { paperId: paper.id } })
                        : stop.mutate({ clientType, paperId: paper.id })
                    }
                  />
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <PapersTheFirmKnowsOf
        open={managing}
        onClose={() => setManaging(false)}
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
function PapersTheFirmKnowsOf({ open, onClose, onChanged }: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [kinds, setKinds] = useState<ClientType[]>([]);
  const [failed, setFailed] = useState<string>();
  const [adding, setAdding] = useState(false);
  const named = useNameKycPaper<ApiError>();
  const ask = useAskForPaper<ApiError>();

  function clear() {
    setName("");
    setKinds([]);
    setFailed(undefined);
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
    setFailed(undefined);
    setAdding(true);
    try {
      const paper = await named.mutateAsync({ data: { name: name.trim() } });
      for (const clientType of kinds) {
        await ask.mutateAsync({ clientType, data: { paperId: paper.id } });
      }
      onChanged();
      clear();
      onClose();
    }
    catch (caught) {
      setFailed(caught instanceof ApiError ? caught.message : "Couldn't add it. Try again.");
    }
    finally {
      setAdding(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Add a paper"
      description="Names a paper the firm asks for, so it can go on the checklist before anybody has sent one."
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
          hint="A name already on the list is matched rather than added twice, whatever its case or spacing."
        >
          <TextInput
            id="name-a-paper"
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
          <div className="mt-2 divide-y divide-line rounded-xl border border-line">
            {BOTH.map((clientType) => (
              <div key={clientType} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-ink">{KIND_OF_CLIENT[clientType]}</span>
                <Switch
                  // A fixed width, or the two tracks sit at different x because "Asked for" is wider
                  // than "No" and the control is pushed to the right-hand edge.
                  className="w-[7.5rem] shrink-0"
                  label={`Asked of ${KIND_OF_CLIENT[clientType].toLowerCase()}`}
                  on={kinds.includes(clientType)}
                  onLabel="Asked for"
                  offLabel="No"
                  busy={adding}
                  onChange={(on) =>
                    setKinds((was) =>
                      on ? [...was, clientType] : was.filter((one) => one !== clientType))
                  }
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {kinds.length === 0
              ? "Left off, the paper is named but nobody is asked for it yet. You can switch it on from the list."
              : "Every client of that kind is asked for it from the moment this is added."}
          </p>
        </div>

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
          <Button disabled={name.trim().length === 0 || adding} onClick={() => void add()}>
            {adding ? "Adding\u2026" : "Add it"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
