import { ApiError } from "@atomprive/api-client";
import {
  getGetClientValuationsQueryKey,
  useGetClientPortfolio,
  useGetCustomer,
  useListClientHoldings,
  useListModelPortfolios,
  useRecordRebalance,
  useRecordReview,
  useSetClientHoldings,
  useChangeClientHolding,
  useRecordClientHolding,
  useRemoveClientHolding,
  useWriteTheirOwnAllocation,
  type PositionRow,
  useSetClientModelPortfolio,
  type ClientHoldings,
  type CustomerDetail,
  type ModelsPage,
  type PortfolioStanding,
  type RiskMatch,
  useClientOnThatModel,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, DateInput, Field, SelectInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator, Check, ChevronLeft, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useAssetClasses } from "./asset-classes";
import { ClassStandingTable } from "./class-standing-table";
import { AskToChangeTheModel } from "./ask-to-change-the-model";
import { AnalyticsPanel } from "./analytics-panel";
import { ClientHoldingsPanel } from "./client-holdings-panel";
import { DailyTrackerPanel } from "./daily-tracker-panel";
import { ModelDialog } from "./model-dialog";
import {
  anchorFor,
  driftLabel,
  riskProfileLabel,
  standingLabels,
  standingTones,
  underManagementLabel,
} from "./portfolio-labels";
import { isSetUp, mayFinishSettingUp } from "./set-up";
import { ConfirmDialog } from "../config/confirm-dialog";
import { LeaveWithoutSaving } from "../../components/leave-without-saving";
import { useJustSaved } from "../../lib/just-saved";
import { formatDate } from "../../lib/labels";
import { ValuationHistoryPanel } from "./valuation-history-panel";
import { WhatIfPanel } from "./what-if-panel";

/**
 * Where Back goes, by the queue this portfolio was opened from. A portfolio is reached from three screens
 * and is the same screen from all of them, so it has to be told which one it was: sending somebody to the
 * client list when they came from the drift queue puts them somewhere they have never been, with the work
 * they were half way through no longer in front of them.
 */
const CAME_FROM: Record<string, { to: string; label: string }> = {
  drift: { to: "/drift", label: "Back to drift & breaches" },
  dashboard: { to: "/dashboard", label: "Back to the dashboard" },
  // The two approval queues. Somebody who opened a client to read their figures before answering is in
  // the middle of answering, and sending them to the client list made them find the queue again.
  moves: { to: "/moves-to-approve", label: "Back to moves to approve" },
  restores: { to: "/restores-to-approve", label: "Back to restores to approve" },
};

const FROM_THE_LIST = { to: "/portfolio-clients", label: "Back to the clients" };

/** The four questions this screen answers, in the order somebody asks them. */
type Tab = "performance" | "daily" | "holdings" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "performance", label: "Portfolio performance" },
  { id: "daily", label: "Daily tracker" },
  { id: "holdings", label: "Holdings" },
  { id: "analytics", label: "Analytics" },
];

/** A box per class, keyed by code, since which classes there are is the firm's to decide. */
type Held = Record<string, string>;

/**
 * The boxes as they start: a blank for every class still in use, plus anything the client is already counted
 * under. A class the firm has retired is shown while a figure sits in it, because it has to be movable; it is
 * simply not offered on a portfolio that has nothing in it.
 */
function heldFrom(standing: PortfolioStanding | undefined, codes: string[]): Held {
  const typed: Held = {};
  for (const assetClass of codes) typed[assetClass] = "";
  for (const [assetClass, value] of Object.entries(standing?.holdings ?? {})) {
    typed[assetClass] = String(value);
  }
  return typed;
}

/** Today, as the calendar writes it, so a rebalance can be dated today but no later. */
function today() {
  const day = new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

function yearsAgo(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() - years, day.getMonth(), day.getDate());
}

/**
 * A client's portfolio: the model it is measured against, what it holds, and when it was last put back.
 *
 * <p>A screen of its own rather than a dialog. Writing a portfolio down is not a question to answer and
 * dismiss — it is three levels of detail read against a table of standings, returned to over a sitting, and
 * worth a link somebody can keep. In a box over the list it was taller than the window whatever was done to
 * it, and every way back out threw away where the reader had got to.
 *
 * <p>Holdings are written down by hand. No custodian feed delivers them yet; when one does it writes the same
 * figures, and this stays as the way to correct them.
 */
export function ClientPortfolioPage() {
  const { customerId = "" } = useParams();
  const [address, setAddress] = useSearchParams();
  const navigate = useNavigate();
  // Which part of the client's portfolio is being read. Four questions about one book, each with its own
  // shape: what it is worth against its plan today, what it did day by day, what it is actually made of,
  // and what all of that looks like drawn. One screen holding all four was a page nobody reached the
  // bottom of, and the figures that change daily sat under the ones that barely change at all.
  // Which tab is open lives in the address, not in this component. Held here alone it was lost on every
  // refresh, could not be linked to, and sent anybody coming back from a day of the tracker to the first
  // tab rather than the one they left.
  const asked = address.get("tab");
  const tab: Tab = TABS.some((one) => one.id === asked) ? (asked as Tab) : "performance";
  const setTab = (which: Tab) => {
    const next = new URLSearchParams(address);
    // The first tab is the one you get without asking, so asking for it adds nothing to the address.
    if (which === "performance") next.delete("tab");
    else next.set("tab", which);
    setAddress(next, { replace: true });
  };
  const came = CAME_FROM[address.get("from") ?? ""] ?? FROM_THE_LIST;
  // With the queue as it was left: a list worked down with a filter on it, and three pages in, is not the
  // same list when it comes back at page one with the filter cleared.
  const asLeft = address.get("back") ?? "";
  const back = { ...came, to: came.to + asLeft };
  // Who is reading. Not everybody who may read this screen may fill the calculator in, and only somebody
  // who may is sent to it.
  const user = useStaffUser();
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);
  // Which classes are written down line by line. Theirs is the one figure nobody types: the total is worked
  // out from the lines, and the API refuses a figure that disagrees with them.
  const lines = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const assetClasses = useAssetClasses();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [held, setHeld] = useState<Held | null>(null);
  const [rebalancedOn, setRebalancedOn] = useState<string | null>(null);
  const [reviewedOn, setReviewedOn] = useState<string | null>(null);
  /**
   * The screen is read until somebody says they are changing it.
   *
   * <p>One way in and one way out, over everything on the page at once: a reader cannot alter a figure by
   * brushing a box, and somebody changing one thing is not asked to save it separately from the next.
   */
  const [editing, setEditing] = useState(false);
  /** Whether the client is already measured against something, which makes a change somebody else's to answer. */
  const onAmodel = (standing.data?.modelPortfolioId ?? null) !== null;
  // Every holding touched since Edit was pressed, with what it looked like beforehand — null where it did
  // not exist. A holding is written to the server the moment it is confirmed, so these are already on file:
  // Discard puts them back as they were, and Save leaves them.
  //
  // The first entry per holding wins. Edited twice, what Discard restores is how it stood before the first
  // edit, not the state between the two.
  const [touchedHoldings, setTouchedHoldings] = useState<Map<string, PositionRow | null>>(new Map());
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Writing this client an allocation of their own: the same dialog a model is written in, because that is
  // what it is — targets, bands and the lines inside a class, belonging to one person.
  const [writingOwn, setWritingOwn] = useState(false);
  // The class somebody asked to see the inside of, from the table that measures it. Kept so the card opens
  // even if they had shut it: being sent to a class and finding it closed is being sent nowhere.
  const [revealed, setRevealed] = useState<string | null>(null);
  const showClass = (assetClass: string) => {
    setRevealed(assetClass);
    // After the card has opened, not before. Opening it does not move its own top — but it does make the
    // page longer, and a card near the foot of a short page cannot be scrolled to the top of the window
    // until the page is long enough to allow it. Scrolled first, the browser went as far as it could and
    // stopped short, leaving the class somebody had just asked for below the fold.
    requestAnimationFrame(() => {
      document.getElementById(anchorFor(assetClass))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const [ownErrors, setOwnErrors] = useState<FormErrors>(noErrors);
  const writeOwn = useWriteTheirOwnAllocation<ApiError>({
    mutation: {
      onSuccess: () => {
        setWritingOwn(false);
        setOwnErrors(noErrors);
        setChosenModel(null);
        kept();
      },
      onError: (caught) => setOwnErrors(toFormErrors(caught)),
    },
  });
  /** The model picked but not yet kept. Nothing on this screen writes until Save is pressed. */
  const [chosenModel, setChosenModel] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  // Each of these writes something somebody has already typed, so the screen looks the same afterwards
  // whether it worked or not. These are what let the buttons say it worked.
  const [holdingsSaved, sayHoldingsSaved] = useJustSaved();
  const kept = () => {
    setErrors(noErrors);
    void standing.refetch();
    // Adding or removing a line changes which classes are worked out rather than typed, so the boxes have
    // to be told as well as the totals.
    void lines.refetch();
    // Saving the holdings is what writes a day of history.
    void queryClient.invalidateQueries({ queryKey: getGetClientValuationsQueryKey(customerId) });
  };
  const setModel = useSetClientModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  // Taking back a holding added since Edit was pressed, when Discard is confirmed.
  // Each reports what it was refused for: a Discard that cannot put something back is the last moment to
  // be quiet about it.
  const forget = useRemoveClientHolding<ApiError>({ mutation: { onError } });
  const putBack = useChangeClientHolding<ApiError>({ mutation: { onError } });
  const writeAgain = useRecordClientHolding<ApiError>({ mutation: { onError } });
  const setHoldings = useSetClientHoldings<ApiError>({
    mutation: { onSuccess: () => { kept(); sayHoldingsSaved(); }, onError },
  });
  const rebalanced = useRecordRebalance<ApiError>({ mutation: { onSuccess: kept, onError } });
  const reviewed = useRecordReview<ApiError>({ mutation: { onSuccess: kept, onError } });
  // Each control waits on its own work and nothing else's. One flag over the whole screen dimmed every
  // button the moment any of them was pressed, which reads as the page pressing all of them at once.

  const boxes = classesShown(assetClasses, standing.data);
  // What the portfolio is written in, read off the portfolio. It is not a choice on this screen.
  const currency = standing.data?.currency ?? "USD";

  /**
   * The figures the boxes show: what somebody typed, or what is on file.
   *
   * <p>Only the classes somebody actually typed into are kept, and they are laid over the live figures
   * rather than replacing them. Snapshotting every class at the first keystroke froze the ones that are
   * worked out from their lines rather than typed: add or remove a sub-asset afterwards and Save sent that
   * class's total as it stood before, which is the one figure the API refuses for disagreeing with its own
   * lines.
   */
  const live = heldFrom(standing.data, boxes);
  const holdings = held === null ? live : { ...live, ...held };
  const on = rebalancedOn ?? standing.data?.lastRebalancedOn ?? "";
  const looked = reviewedOn ?? standing.data?.lastReviewedOn ?? "";
  const total = Object.values(holdings).reduce((sum, typed) => sum + (Number(typed) || 0), 0);
  // Read off the client and sent back untouched when the holdings are saved, so keeping a figure on this
  // screen never writes over what the calculator worked out.
  const netAum = standing.data?.netAum == null ? "" : String(standing.data.netAum);
  // What is typed but not yet saved. The table below reads what is on file, so a figure changed in a box and
  // not kept would otherwise be contradicted by the standings beside it with nothing to say why.
  // The portfolio arrives after the first render, so the box reads from it until somebody picks another.
  const model = chosenModel ?? standing.data?.modelPortfolioId ?? "";
  // A model picked in the box but not yet saved. Reading what it would do is how somebody chooses one,
  // rather than how they find out what they chose: nothing is written down to ask the question.
  const tryingOn = chosenModel !== null && chosenModel !== "" && chosenModel !== (standing.data?.modelPortfolioId ?? "");
  const preview = useClientOnThatModel<PortfolioStanding, ApiError>(customerId, tryingOn ? model : "", {
    query: { enabled: tryingOn },
  });
  const figuresChanged =
    held !== null && JSON.stringify(holdings) !== JSON.stringify(heldFrom(standing.data, boxes));
  const unsaved =
    // A holding written down in this sitting, or a tolerance written over, is unkept work exactly as a
    // typed-over box is. Counting only the boxes, a move made and walked away from asked nothing and took
    // its own undo with it.
    touchedHoldings.size > 0 ||
    figuresChanged ||
    (chosenModel !== null && chosenModel !== (standing.data?.modelPortfolioId ?? "")) ||
    (rebalancedOn !== null && rebalancedOn !== (standing.data?.lastRebalancedOn ?? "")) ||
    (reviewedOn !== null && reviewedOn !== (standing.data?.lastReviewedOn ?? ""));
  const saving =
    setHoldings.isPending || setModel.isPending || rebalanced.isPending
    || reviewed.isPending;

  /** Puts the screen back to what is on file, throwing away whatever was typed. */
  /**
   * Puts the page back, and takes off the holdings added since Edit was pressed.
   *
   * <p>A holding changed or removed meanwhile is left as it is. Putting those back is not what Discard was
   * asked to do, and a Discard that quietly restored a line somebody deleted would be its own surprise.
   */
  function discard() {
    if (touchedHoldings.size > 0) {
      setConfirmingDiscard(true);
      return;
    }
    putTheBoxesBack();
  }

  /**
   * Puts back everything written down since Edit was pressed, and keeps a record of whatever would not go.
   *
   * <p>Every failure used to be swallowed and the record thrown away in the same breath, which destroyed
   * the only list of what still had to be put back at the moment it was known to be needed — and then left
   * edit mode and refetched, so the screen showed the un-reverted figures as the truth. Pressing Discard
   * again had nothing to replay.
   */
  async function discardIncludingHoldings() {
    const stuck = new Map<string, PositionRow | null>();
    let refused: ApiError | null = null;
    for (const [id, before] of touchedHoldings) {
      try {
        if (before === null) {
          // It did not exist when Edit was pressed, so putting it back means taking it off.
          await forget.mutateAsync({ customerId, id });
          continue;
        }
        const was = {
          assetClass: before.assetClass,
          subClass: before.subClass,
          name: before.name,
          identifier: before.identifier,
          issuer: before.issuer,
          countryCode: before.countryCode,
          sector: before.sector,
          yieldPercent: before.yieldPercent,
          durationYears: before.durationYears,
          creditRating: before.creditRating,
          valueAmount: before.valueAmount,
          // Put back as it stood, tolerance and all: a Discard that quietly dropped a client's own figures
          // would be putting back something other than what was there.
          watchPp: before.watchPp,
          edgePp: before.edgePp,
          breachPp: before.breachPp,
        };
        try {
          await putBack.mutateAsync({ customerId, id, data: was });
        }
        catch {
          // Changed is one thing; removed is another. A holding taken off during this sitting has no row
          // left to write over, so it is written down again — a new line saying what the old one said.
          await writeAgain.mutateAsync({ customerId, data: was });
        }
      }
      catch (caught) {
        // One holding that will not go back does not strand the others. It is kept, though, so Discard can
        // be pressed again for it rather than the work being lost with the record of it.
        stuck.set(id, before);
        refused ??= caught as ApiError;
      }
    }
    setConfirmingDiscard(false);
    if (stuck.size > 0) {
      // What is left to put back, and nothing else. The page stays in edit so Discard can be pressed
      // again, and says what happened — after the refetch, because reading the portfolio back clears the
      // message along with everything else.
      setTouchedHoldings(stuck);
      kept();
      setErrors(toFormErrors(refused as ApiError));
      return;
    }
    putTheBoxesBack();
    kept();
  }

  function putTheBoxesBack() {
    setTouchedHoldings(new Map());
    setHeld(null);
    setChosenModel(null);
    setRebalancedOn(null);
    setReviewedOn(null);
    setErrors(noErrors);
    setEditing(false);
  }

  /**
   * Keeps everything that changed, in one press.
   *
   * <p>Only what changed is sent. The two dates are somebody's own record of when a thing was done, and a
   * screen that wrote them again every time it saved would stamp today's reading over last month's.
   *
   * <p>One write at a time, stopping at the first refusal. Sent all at once, a model the API refuses — a
   * draft, say — left the figures beside it saved anyway, so the page came back showing the holdings kept
   * and the model quietly dropped, over a message that named neither. What is refused now stops the rest,
   * and the screen stays in edit with everything still typed in it.
   */
  async function save() {
    setErrors(noErrors);
    try {
      // The model first: it is what every figure below is measured against, so there is no sense keeping
      // figures against a model that was refused.
      if (chosenModel !== null && chosenModel !== (standing.data?.modelPortfolioId ?? "")) {
        await setModel.mutateAsync({ customerId, data: { modelPortfolioId: chosenModel || null } });
      }
      if (rebalancedOn !== null && rebalancedOn !== (standing.data?.lastRebalancedOn ?? "") && rebalancedOn) {
        await rebalanced.mutateAsync({ customerId, data: { on: rebalancedOn } });
      }
      if (reviewedOn !== null && reviewedOn !== (standing.data?.lastReviewedOn ?? "") && reviewedOn) {
        await reviewed.mutateAsync({ customerId, data: { on: reviewedOn } });
      }
      const wanted: Record<string, number> = {};
      for (const [assetClass, typed] of Object.entries(holdings)) {
        if (typed.trim()) wanted[assetClass] = Number(typed);
      }
      // The currency goes back exactly as it came: what the portfolio is written in is not something this
      // screen can change, and sending it unchanged is what keeps it.
      await setHoldings.mutateAsync({
        customerId,
        // Left out rather than sent as nought: nobody saying what the client has is a different thing
        // from somebody saying they have nothing.
        data: { holdings: wanted, currency, netAum: netAum.trim() === "" ? null : Number(netAum) },
      });
    }
    catch {
      // Each mutation reports what it was refused for through onError, which has already put the message
      // on the screen. Nothing else is written, and nothing typed is thrown away.
      return;
    }
    setHeld(null);
    setChosenModel(null);
    setRebalancedOn(null);
    setReviewedOn(null);
    // Saved is kept: what was written down in this sitting is the client's now, not this sitting's.
    setTouchedHoldings(new Map());
    setEditing(false);
  }

  const named = client.data?.client.fullName ?? "";

  // A client the calculator has not been finished for has no screen here: every figure below is a share
  // of a target, so what would be drawn is a column of dashes beside a column of money, which reads as a
  // portfolio nobody has looked at rather than one nobody has finished setting up. They go back into the
  // calculator, which is the only place the missing answers can come from.
  //
  // Said here rather than only on the link that got here. Eight other screens — the drift queue, the
  // manager's dashboard, the client file, the trading panel, and the role's own idea of where a client
  // lives — name a client and come straight to this address, and a rule each of them has to remember is
  // a rule one of them will forget.
  //
  // Three things hold it back, and each of them was a way of making somebody worse off than before:
  //
  // Until the standing has arrived. Undefined is not "not set up", it is "not asked yet", and turning on
  // it would throw every reader out of the page for the length of a request — and a refused request would
  // turn them out for good.
  //
  // Only somebody who could finish it. The calculator's every write is a portfolio manager's; an advisor,
  // compliance and operations may all read this screen and none of them may save a step of it, so sending
  // them there is sending them to a form that refuses them, having shut the one they could read.
  //
  // Never out of a save. Taking a client off their model is done on this very screen, and the model is
  // written before the holdings are: the refetch that follows it would turn this on and unmount the page
  // with the holdings still in flight — quietly, because the warning about unsaved work is mounted below
  // this line and would go with it.
  if (standing.isSuccess && !isSetUp(standing.data) && mayFinishSettingUp(user)
    && !saving && !unsaved) {
    return <Navigate to={`/portfolio-clients/${customerId}/net-aum`} replace />;
  }

  return (
    /* Capped, but wide enough for the widest thing on it. Uncapped, every box stretched to fill the
       window and left a date sitting in the corner of an acre of white; at the old cap the sub-asset
       table had eight columns to fit and wrapped half its headings onto a second line. This is the
       width at which they stop wrapping. */
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      {/* Typing into a box and walking off used to lose it without a word. */}
      <LeaveWithoutSaving
        when={unsaved}
        what="This client's portfolio"
        saving={saving}
        onSave={() => void save()}
        /* Straight to the putting-back: somebody who has just answered "discard" has been asked. */
        onDiscard={() => discardIncludingHoldings()}
      />
      <Link
        to={back.to}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {back.label}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">{named || "Portfolio"}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {client.data?.client.code}
            {standing.data?.modelName ? ` · measured against ${standing.data.modelName}` : " · on no model yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {standing.data && standing.data.underManagement > 0 && (
            <span className="text-sm text-ink-muted">
              {underManagementLabel(standing.data.underManagement, standing.data.currency)}
            </span>
          )}
          {standing.data?.standing && (
            <Badge tone={standingTones[standing.data.standing]}>
              {standingLabels[standing.data.standing]}
              {standing.data.drift === null ? "" : ` · ${driftLabel(standing.data.drift)}`}
            </Badge>
          )}
          {/* One way in and one way out, for everything on the page at once. */}
          {editing ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={saving} onClick={discard}>
                Discard
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <>
              {holdingsSaved && <Saved />}
              {/* Back to where the figures came from. Putting more into one sub-asset than the client has
                  is not a move between lines — the portfolio is worth more than it was, and what it is
                  worth is the calculator's to say. Until now the only way back in was a client who had
                  never finished it: once the last step was done the calculator had no door at all, and
                  the one screen that could change a figure was the one that may not.

                  It opens at the first step with every figure already in its box, because that is the
                  step money is written in, and a reader sent to the last one would have to walk back
                  through three to reach it. */}
              {mayFinishSettingUp(user) && (
                <Button
                  variant="secondary"
                  onClick={() => void navigate(
                    `/portfolio-clients/${customerId}/net-aum?at=1&from=portfolio`,
                  )}
                >
                  <Calculator aria-hidden="true" />
                  Recalculate Net AUM
                </Button>
              )}
              {/* The one thing to do on a screen that is otherwise read, so it is the one thing that
                  looks like a button rather than part of the furniture. */}
              {/* Not shut while something waits, which is what this said last week and was wrong: this is
                  the door to ASKING for a move, so shutting it left nothing to press at all — not even to
                  take the ask back. What is refused while something waits is writing a figure, and the
                  server refuses that; what is offered here is asking, which is the point.

                  Named for what is behind it rather than "Edit". Nothing here writes a decision any more:
                  moving money, changing the model and putting the figures back are each asked for and
                  answered by whoever looks after the client. */}
              <Button onClick={() => {
                setTouchedHoldings(new Map());
                setEditing(true);
              }}>
                <Pencil aria-hidden="true" />
                Make changes
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Scrolls rather than wraps: a second row would break the line the tabs sit on. */}
      <div role="tablist" aria-label="This client's portfolio"
        className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              tab === option.id
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      {client.isError && <Alert tone="danger">{client.error.message}</Alert>}

      {tab === "performance" && (<>
      {/* One column, read top to bottom. Side by side, two panels are never the same height, so whichever
          is shorter leaves a hole beside the other — and the hole moves about as the figures change. */}
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        {/* The plan on its own. The Net AUM used to sit beside it, typed into this screen — it is worked
            out by the calculator now, out of what the client holds, what they own that nobody manages and
            what they owe, and a box here that could be typed over was a second answer to a question that
            already has one. */}
        {/* Picked once. Moving a client from one model to another — or off every model — decides what
            counts as a breach and what the firm will be told to buy and sell, and the platform has a queue
            for it that somebody else answers. This dropdown wrote it outright, so the queue could be walked
            straight past by anyone who could reach the portfolio. Taking a client off is the same kind of
            act and is asked for too: measured against nothing, they have no drift and no band, so the
            monitoring simply stops. The first assignment is the one thing left here, because until it is
            done they are measured against nothing anyway. */}
        <Field id="client-model" label="Measured against" className="min-w-0">
              {/* Kept by Save like everything else. Written the moment it was picked, a reader who brushed
                  the list changed what the client is measured against and was never asked. */}
              <SelectInput
                id="client-model"
                value={model}
                disabled={!editing || saving || onAmodel}
                onChange={(event) => setChosenModel(event.target.value)}
              >
                <option value="">No model — nothing to drift from</option>
                {/* A draft is a model still being written, and the API refuses to measure anybody against
                    one. Offering it as though it could be picked turned that refusal into a failed save. */}
                {(models.data?.items ?? []).map((model) => (
                  <option key={model.id} value={model.id} disabled={model.status === "DRAFT"}>
                    {model.name}
                    {/* What each model is written for, so it can be picked by the client's risk rather than
                        picked and then checked. */}
                    {` — ${riskProfileLabel(model.riskProfile)}`}
                    {model.status === "DRAFT" ? " · still a draft" : ""}
                    {model.status === "RETIRED" ? " · retired" : ""}
                  </option>
                ))}
          </SelectInput>
        </Field>
        {/* An allocation of their own is written in the same dialog a model is, because it is the same
            thing: targets, bands, and the lines inside a class. What differs is who it belongs to. */}
        {editing && !standing.data?.customModel && (
          <p className="mt-3 text-xs text-ink-muted">
            None of these fit?{" "}
            <button
              type="button"
              onClick={() => setWritingOwn(true)}
              className="font-medium text-primary-700 hover:underline"
            >
              Write this client an allocation of their own
            </button>
            . It is measured like any plan, and nothing acts on it by itself.
          </p>
        )}
        {standing.data?.customModel && (
          <p className="mt-3 text-xs text-ink-muted">
            This client is on an allocation written for them alone. It is not offered to anybody else, not
            rebalanced with the firm's plans, and nobody is told overnight when it drifts.
          </p>
        )}
        <RiskMatchNote match={(tryingOn ? preview.data?.riskMatch : standing.data?.riskMatch) ?? null} />
      </section>


      {/* What the picked model would make of this client's own money, before anybody is put on it. Beside
          the table of what is on file rather than up by the picker, so the two read one after the other and
          are plainly measuring the same holdings. */}
      {tryingOn && preview.isError && <Alert tone="danger">{preview.error.message}</Alert>}
      {tryingOn && preview.data && (
        <section className="rounded-2xl border border-line bg-white px-6 py-5">
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            On {preview.data.modelName ?? "this model"}, before saving
          </h2>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">
            This client's own figures against the model picked above. Nothing is saved until you press Save,
            and the table below still reads what is on file.
          </p>
          <div className="mt-3">
            <ClassStandingTable
              classes={preview.data.classes}
              currency={preview.data.currency}
              suggestions={!preview.data.customModel}
              underManagement={preview.data.underManagement}
            />
          </div>
        </section>
      )}

      {standing.data && standing.data.classes.length > 0 && (
            <section className="rounded-2xl border border-line bg-white px-6 py-5">
              <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Against the model
              </h2>
              {/* A table that disagrees with the figures under it has to say why where it is read, rather
                  than leaving somebody to find the difference themselves. */}
              {unsaved && (
                <p className="mt-1 text-xs text-amber-700">
                  This reads what is on file. The page has been changed and not saved.
                </p>
              )}
              <div className="mt-3">
                <ClassStandingTable
                  classes={standing.data.classes}
                  currency={standing.data.currency}
                  suggestions={!standing.data.customModel}
                  underManagement={standing.data.underManagement}
                  unwritten={standing.data.unwritten}
                  onPick={showClass}
                />
              </div>
            </section>
          )}

      {/* What they actually hold, under the tables that measure it: the plan is read first, then how far
          this client sits from it, and then the holdings themselves line by line. */}
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <fieldset>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    What they hold
                  </legend>
                  {/* What a class listed holding by holding does with its total is said by the list itself
                      now that the list is here, rather than twice over by the heading above it. */}
                  <p className="mt-1 max-w-prose text-xs text-ink-muted">
                    Written down by hand: no custodian feed delivers these yet.
                  </p>
                </div>
                {/* A currency picker stood here. Restating a portfolio converts every class total,
                    every holding under it and every day of history behind it, and what it did not
                    convert was the Net AUM, the assets nobody manages and the loans — so a portfolio
                    restated came back measured against a figure still counted in the currency it had
                    left. The firm works in one currency while that is so. What the portfolio is
                    written in is said beside the figures, not offered as a choice. */}
                <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  {currency}
                </span>
              </div>
              {/* What each class is worth, and what it is made of, in one list. The figures used to be a
                  grid of boxes with the breakdown of them at the foot of the page, so a class was typed in
                  one place and read in another, and the two were never on screen together. */}
              <div className="mt-3">
                <ClientHoldingsPanel
                  customerId={customerId}
                  against={tryingOn ? model : null}
                  offer={boxes}
                  reveal={revealed}
                  readOnly={!editing}
                />
              </div>
              {errors.fields.currency && <p className="mt-3 text-xs text-red-600">{errors.fields.currency}</p>}
              {errors.fields.holdings && (
                <p className="mt-3 text-xs text-red-600">{errors.fields.holdings}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  {total > 0 ? `Adds up to ${currency} ${total.toLocaleString()}.` : "Nothing written down yet."}
                  {figuresChanged && (
                    <span className="ml-1 font-semibold text-amber-700">Not saved yet.</span>
                  )}
                </p>
          </div>
        </fieldset>
      </section>

      {/* Two dates the platform cannot work out for itself: the trading happens at the custodian and the
          reading happens in somebody's head. Written down here, they are what the review cadence and the
          drift queue are measured from.

          Set out as a record rather than as a column of fields: stacked, a label, a date and a line of
          explanation three times over reads as one thing running into the next. */}
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">When it was dealt with</h2>

        <dl className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          <Dealt
            id="rebalanced-on"
            label="Last put back to the model"
            said="The day the trades were done. Drift is read as how far it has wandered since."
          >
            {/* Kept with everything else by the one Save in the corner, rather than by a button of its own. */}
            {editing ? (
              <DateInput
                id="rebalanced-on"
                name="rebalancedOn"
                value={on}
                min={yearsAgo(20)}
                max={today()}
                onChange={setRebalancedOn}
              />
            ) : (
              <p className="text-sm">{on ? formatDate(on) : "Never put back"}</p>
            )}
          </Dealt>

          {/* Reading the file is not the same as putting it back: a review can end in doing nothing at all. */}
          <Dealt
            id="reviewed-on"
            label="Last looked at"
            said={
              standing.data?.lastReviewedOn
                ? standing.data.reviewOverdue
                  ? "Due another look."
                  : `Next due ${standing.data.reviewDueOn ? formatDate(standing.data.reviewDueOn) : ""}.`
                : "The day somebody read this file through. Nobody has yet."
            }
          >
            {editing ? (
              <DateInput
                id="reviewed-on"
                name="reviewedOn"
                value={looked}
                min={yearsAgo(20)}
                max={today()}
                onChange={setReviewedOn}
              />
            ) : (
              <p className="text-sm">{looked ? formatDate(looked) : "Nobody has looked yet"}</p>
            )}
          </Dealt>
        </dl>
        {errors.fields.on && <p className="mt-3 text-xs text-red-600">{errors.fields.on}</p>}
      </section>

      {/* Asking is not moving. An advisor who thinks they are on the wrong plan says so here, and whoever
          may move them answers it. */}
      {standing.data && (
        <AskToChangeTheModel
          customerId={customerId}
          onModelId={standing.data.modelPortfolioId ?? null}
          onModelName={standing.data.modelName ?? "no model"}
        />
      )}

      {/* A holding is kept the moment it is added, so Discard has to take it off again rather than simply
          forget it. What is about to go is counted, because it is a line of somebody's portfolio. */}
      {writingOwn && (
        <ModelDialog
          model={null}
          errors={ownErrors}
          busy={writeOwn.isPending}
          onClose={() => {
            setWritingOwn(false);
            setOwnErrors(noErrors);
          }}
          onSave={(data) => writeOwn.mutate({ customerId, data })}
        />
      )}

      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard, and put it back as it was?"
        description={
          [
            touchedHoldings.size === 1
              ? "One holding was written down since you pressed Edit."
              : touchedHoldings.size > 1
                ? `${touchedHoldings.size} holdings were written down since you pressed Edit.`
                : "",
            "Each was kept the moment it was confirmed, so discarding puts it back as it stood when you"
            + " pressed Edit — anything moved out of a sub-asset goes back into it, and anything moved in"
            + " is taken off again.",
          ].filter(Boolean).join(" ")
        }
        confirmLabel="Discard and put it back"
        busy={forget.isPending || putBack.isPending || writeAgain.isPending}
        onConfirm={() => void discardIncludingHoldings()}
        onClose={() => setConfirmingDiscard(false)}
      />

      <ValuationHistoryPanel customerId={customerId} />

      {/* What the bonds do, where the money sits and where the change came from used to follow. Each was
          built for a feed the firm does not have yet: no holding carries a yield, a duration, a country or
          a sector, and a day of history is only written when somebody saves — so the first two said "no
          bond carries a yield yet" under every client, and the third measured one client's whole portfolio
          as ninety-nine per cent down because the only other day it had was an old test figure. Three
          panels that cannot answer are worse than three panels that are not there. */}
      {standing.data && (
        <WhatIfPanel customerId={customerId} standing={standing.data} editing={editing} />
      )}
      </>)}

      {tab === "daily" && <DailyTrackerPanel customerId={customerId} />}

      {/* Nothing yet, and said so rather than drawn empty. The firm's line-by-line holdings list is still
          to come; until it does, what the client holds is read under Portfolio performance. */}
      {tab === "holdings" && (
        <section className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
          <p className="font-semibold text-ink">Holdings is not built yet.</p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-ink-muted">
            The firm&apos;s own list of what a client holds, instrument by instrument, goes here. Until it
            arrives, what they hold by asset class and sub-asset is under Portfolio performance.
          </p>
        </section>
      )}

      {tab === "analytics" && <AnalyticsPanel customerId={customerId} />}
    </div>
  );
}

/**
 * Which classes this client's screen offers: the ones their model asks for, plus any they are already
 * counted under.
 *
 * <p>A plan naming three classes is a plan for three: listing the firm's other six beside them invites
 * money into places the model has nothing to say about, and every one of them would then be measured
 * against a target of nothing. What is already written down stays listed whatever the model says — a class
 * with no box is a figure nobody can take out, and a retired class holding money is exactly that.
 *
 * <p>A client on no model has nothing to narrow the list by, so they get the firm's own.
 */
function classesShown(
  assetClasses: ReturnType<typeof useAssetClasses>,
  standing: PortfolioStanding | undefined,
): string[] {
  const held = new Set(Object.keys(standing?.holdings ?? {}));
  const asked = new Set((standing?.classes ?? []).map((one) => one.assetClass));
  return assetClasses.all
    .filter((one) => (one.retiredAt === null || held.has(one.code))
      && (asked.size === 0 || asked.has(one.code) || held.has(one.code)))
    .map((one) => one.code);
}

/** Said beside a control that has just written something, because the screen itself does not change. */
function Saved({ said = "Saved" }: { said?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
      <Check aria-hidden="true" className="size-3.5" />
      {said}
    </span>
  );
}

/**
 * One dated fact: what is being dated, the date itself, and what the date means.
 *
 * <p>Side by side with the other, and each stacked the way every other field on the page is stacked. A
 * label column wide enough for the longer name left the date marooned in the middle of the row with the
 * whole right-hand side of the screen empty beside it.
 */
function Dealt({
  id,
  label,
  said,
  children,
}: {
  id: string;
  label: string;
  said: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      </dt>
      <dd className="mt-1.5">{children}</dd>
      <dd className="mt-1.5 text-xs text-ink-muted">{said}</dd>
    </div>
  );
}

/**
 * Whether the model this client is on was written for the risk they came out as.
 *
 * <p>A client nobody has profiled says so rather than showing as a mismatch: the question has not been
 * answered, and treating silence as a wrong answer would have every client the questionnaire has not reached
 * look wrongly placed.
 */
function RiskMatchNote({ match }: { match: RiskMatch | null }) {
  if (!match) {
    return (
      <p className="mt-3 text-xs text-ink-muted">
        Nobody has profiled this client yet, so there is nothing to match a model against. Their Investment
        risk profile form is where that answer comes from.
      </p>
    );
  }
  const client = riskProfileLabel(match.clientProfile);
  if (!match.modelProfile) {
    return (
      <p className="mt-3 text-xs text-ink-muted">
        This client came out <strong className="font-semibold text-ink">{client}</strong>. Nobody has said
        what this model is written for, so it has not been matched to them — only not ruled out.
      </p>
    );
  }
  const model = riskProfileLabel(match.modelProfile);
  return (
    <div className="mt-3">
      <Alert tone={match.matches ? "success" : "warning"}>
        {match.matches
          ? `This client came out ${client}, and this model is written for ${client}.`
          : `This client came out ${client}, and this model is written for ${model}. Putting them on it means putting them on a portfolio built for a different risk.`}
        {!match.settled && " Their questionnaire is still a draft, so this may yet change."}
      </Alert>
    </div>
  );
}
