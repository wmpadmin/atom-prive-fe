import { ApiError } from "@atomprive/api-client";
import {
  getGetClientAttributionQueryKey,
  getGetClientValuationsQueryKey,
  useGetClientPortfolio,
  useGetCustomer,
  useListClientHoldings,
  useListModelPortfolios,
  useSetClientModelPortfolio,
  type ClientHoldings,
  type CustomerDetail,
  type ModelsPage,
  type PortfolioStanding,
  type RiskMatch,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Field, SelectInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { AttributionPanel } from "./attribution-panel";
import { NetAumPanel } from "./net-aum-panel";
import { useAssetClasses } from "./asset-classes";
import { ClassStandingTable } from "./class-standing-table";
import { AskToChangeTheModel } from "./ask-to-change-the-model";
import { AnalyticsPanel } from "./analytics-panel";
import { ClientHoldingsPanel } from "./client-holdings-panel";
import { ClientReturnPanel } from "./client-return-panel";
import { DailyTrackerPanel } from "./daily-tracker-panel";
import {
  anchorFor,
  driftLabel,
  riskProfileLabel,
  standingLabels,
  standingTones,
  worthLabel,
} from "./portfolio-labels";
import { isSetUp, mayFinishSettingUp } from "./set-up";
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
  // The approval queue somebody came from. Opening a client to read their figures before answering is
  // the middle of answering, and sending them to the client list made them find the queue again.
  moves: { to: "/approvals?queue=client-requests", label: "Back to client requests" },
  restores: { to: "/approvals?queue=restores", label: "Back to restores to approve" },
};

const FROM_THE_LIST = { to: "/portfolio-clients", label: "Back to the clients" };

/** The questions this screen answers, in the order somebody asks them. */
type Tab = "performance" | "daily" | "return" | "holdings" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "performance", label: "Portfolio performance" },
  { id: "daily", label: "Daily tracker" },
  // After the tracker, because the tracker is what it is made of: the return is read off the days
  // somebody wrote down, and the money in and out written down beside them.
  { id: "return", label: "Return" },
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
  /** Whether the client is already measured against something, which makes a change somebody else's to answer. */
  const onAmodel = (standing.data?.modelPortfolioId ?? null) !== null;
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
  const queryClient = useQueryClient();
  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  // Each of these writes something somebody has already typed, so the screen looks the same afterwards
  // whether it worked or not. These are what let the buttons say it worked.
  const kept = () => {
    setErrors(noErrors);
    void standing.refetch();
    // Adding or removing a line changes which classes are worked out rather than typed, so the boxes have
    // to be told as well as the totals.
    void lines.refetch();
    // Saving the holdings is what writes a day of history.
    void queryClient.invalidateQueries({ queryKey: getGetClientValuationsQueryKey(customerId) });
    // Attribution is read off those same days, so it goes stale on exactly the saves they do.
    void queryClient.invalidateQueries({ queryKey: getGetClientAttributionQueryKey(customerId) });
  };
  const setModel = useSetClientModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  // Each control waits on its own work and nothing else's. One flag over the whole screen dimmed every
  // button the moment any of them was pressed, which reads as the page pressing all of them at once.

  const boxes = classesShown(assetClasses, standing.data);
  // What the portfolio is written in, read off the portfolio. It is not a choice on this screen.
  const currency = standing.data?.currency ?? "USD";

  // What is on file, and only that. There is no typing over it here any more: a class total is the sum of
  // the sub-assets written under it, and those are written in the panel below or through the calculator.
  const holdings: Held = heldFrom(standing.data, boxes);
  const total = Object.values(holdings).reduce((sum: number, typed) => sum + (Number(typed) || 0), 0);
  // What the client is measured against, read off the portfolio. Picking in the box writes it, so there
  // is never a picked-but-unwritten model for the screen to hold.
  const model = standing.data?.modelPortfolioId ?? "";
  const saving = setModel.isPending;

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
  if (standing.isSuccess && !isSetUp(standing.data) && mayFinishSettingUp(user) && !saving) {
    return <Navigate to={`/portfolio-clients/${customerId}/net-aum`} replace />;
  }

  return (
    /* Capped, but wide enough for the widest thing on it. Uncapped, every box stretched to fill the
       window and left a date sitting in the corner of an acre of white; at the old cap the sub-asset
       table had eight columns to fit and wrapped half its headings onto a second line. This is the
       width at which they stop wrapping. */
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
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
        {/* The figure somebody opened this screen to read, written as a figure rather than tucked into
            the line of small print beside the client's name. Said in full: a client's own screen has
            room for the thousands, and 41.8K is a column's answer to a question nobody asked here. */}
        {/* The figure on its own line and the verdict under it. Side by side the badge sat level with
            the caption and read as a label on the money, when it is a verdict about the portfolio. */}
        {/* The way back into the calculator, level with the whole of what it works out rather than with
            the first line of it. The clients list opens the calculator for a client nobody has written
            down yet and opens the portfolio once they have — so the moment a client was set up, the one
            screen that shows the working became unreachable. */}
        <div className="flex items-center gap-3">
          {/* Said where it was opened from. The calculator is a dialog over the clients list, so closing
              it puts somebody back on that list unless the address says otherwise — and a reader who
              opened it from a client's own screen had the screen they were working on taken away. */}
          <Link to={`/portfolio-clients/${customerId}/net-aum?from=portfolio`}>
            <Button size="lg">Net AUM calculator</Button>
          </Link>
          {/* What it is worth and how it stands, read down: the money first, the verdict about it under.
              Side by side the badge sat level with the caption and read as a label on the money, when it
              is a verdict about the portfolio. */}
          <div className="flex flex-col items-end gap-2">
            {standing.data && standing.data.underManagement > 0 && (
              <div className="text-right">
                <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  Under management
                </p>
                <p className="text-xl font-bold whitespace-nowrap text-ink tabular-nums">
                  {worthLabel(standing.data.underManagement, standing.data.currency)}
                </p>
              </div>
            )}
            {standing.data?.standing && (
              <Badge tone={standingTones[standing.data.standing]}>
                {standingLabels[standing.data.standing]}
                {standing.data.drift === null ? "" : ` · ${driftLabel(standing.data.drift)}`}
              </Badge>
            )}
          </div>
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
      {/* The plan, and then the asking to change it. Side by side the two were never the same height —
          one is three lines and the other is however many requests a client has had — so whichever was
          shorter carried a hand's depth of empty card. One after the other, each takes only the room it
          needs, and they stay together, which is the part that mattered. */}
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
              <SelectInput
                id="client-model"
                value={model}
                disabled={onAmodel || setModel.isPending}
                onChange={(event) => {
                  // Written the moment it is picked. There is no Save to keep it, and the only time this
                  // box is open at all is a client measured against nothing — where picking is the whole
                  // act and there is nothing to overrule.
                  setModel.mutate({ customerId, data: { modelPortfolioId: event.target.value || null } });
                }}
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
        {/* Writing one here is gone. A plan is written in Model portfolios and then a client is put on
            it, which is one order of events rather than two: a plan nobody else can see, written on the
            screen that measures one client against it, was a second way of making one — and the way that
            skipped every reader a plan is supposed to pass. What is left is the picker above, where the
            first is chosen outright and a change is asked of whoever looks after them. */}
        {standing.data?.customModel && (
          <p className="mt-3 text-xs text-ink-muted">
            This client is on an allocation written for them alone. It is not offered to anybody else, not
            rebalanced with the firm's plans, and nobody is told overnight when it drifts.
          </p>
        )}
        <RiskMatchNote match={standing.data?.riskMatch ?? null} />
      </section>

      {/* Asking is not moving. An advisor who thinks their client is on the wrong plan says so here, and
          whoever may move them answers it. Directly under the plan rather than further down the page: the
          two are one question — what this client is measured against, and what somebody wants it to be —
          and read a screen apart, a waiting request looked like a queue entry belonging to nobody. */}
      {standing.data && (
        <AskToChangeTheModel
          customerId={customerId}
          onModelId={standing.data.modelPortfolioId ?? null}
          onModelName={standing.data.modelName ?? "no model"}
        />
      )}


      {standing.data && standing.data.classes.length > 0 && (
            <section className="rounded-2xl border border-line bg-white px-6 py-5">
              <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Against the model
              </h2>
              <div className="mt-3">
                <ClassStandingTable
                  classes={standing.data.classes}
                  currency={standing.data.currency}
                  suggestions={!standing.data.customModel}
                  underManagement={standing.data.underManagement}
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
                  offer={boxes}
                  reveal={revealed}
                  readOnly={false}
                />
              </div>
              {errors.fields.currency && <p className="mt-3 text-xs text-red-600">{errors.fields.currency}</p>}
              {errors.fields.holdings && (
                <p className="mt-3 text-xs text-red-600">{errors.fields.holdings}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  {total > 0 ? `Adds up to ${currency} ${total.toLocaleString()}.` : "Nothing written down yet."}
                </p>
          </div>
        </fieldset>
      </section>

      <ValuationHistoryPanel customerId={customerId} />

      {/* Under the figures it is worked out from, and above what the bonds do: a reader who has just read
          the classes is the reader this answers. It draws nothing at all for a client who owes nothing
          and owns nothing outside their portfolio, because for them it would restate the figure at the
          top of the screen under a second name. */}
      <NetAumPanel customerId={customerId} />

      {/* Where the change came from was taken off in October with two others when none of them could
          answer, and is back because the holdings now carry what it reads: every line names a country and
          a sector, and the lines add up to their classes to the penny on every client.

          The other two stay off. What the bonds do — the yield, the duration and what it lends to — the
          firm does not want on this screen. Where the money sits by country and by sector could not
          answer anyway: no model carries a country or a sector target, and the dialog that set them was
          taken off the same day, so three of its six columns would be a dash under every client. Both are
          left on disk unreferenced, which is how a screen turned off here is kept — twice now one has
          been wanted back. */}
      <AttributionPanel customerId={customerId} />

      {standing.data && (
        <WhatIfPanel customerId={customerId} standing={standing.data} editing />
      )}
      </>)}

      {tab === "daily" && <DailyTrackerPanel customerId={customerId} />}

      {tab === "return" && <ClientReturnPanel customerId={customerId} />}

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
