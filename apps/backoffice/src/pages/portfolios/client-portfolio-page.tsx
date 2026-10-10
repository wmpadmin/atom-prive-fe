import { ApiError } from "@atomprive/api-client";
import {
  getGetClientAttributionQueryKey,
  getGetClientValuationsQueryKey,
  useGetClientPortfolio,
  useGetCustomer,
  useListClientHoldings,
  useListCurrencies,
  useListModelPortfolios,
  useRecordRebalance,
  useRecordReview,
  useSetClientHoldings,
  useSetClientModelPortfolio,
  usePreviewPortfolioCurrency,
  useSetPortfolioCurrency,
  type ClientHoldings,
  type Currency,
  type CustomerDetail,
  type ModelsPage,
  type PortfolioStanding,
  type Redenomination,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, DateInput, Field, SelectInput, TextInput, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { asFigure } from "../../lib/figures";
import { AttributionPanel } from "./attribution-panel";
import { ExposurePanel } from "./exposure-panel";
import { FixedIncomePanel } from "./fixed-income-panel";
import { useAssetClasses } from "./asset-classes";
import { ClassStandingTable } from "./class-standing-table";
import { ClientHoldingsPanel } from "./client-holdings-panel";
import { driftLabel, standingLabels, standingTones, underManagementLabel } from "./portfolio-labels";
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
};

const FROM_THE_LIST = { to: "/portfolio-clients", label: "Back to the clients" };

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

/** The same boxes, filled from what the API says the figures would read in another currency. */
function asBoxes(wouldRead: Record<string, number>, codes: string[]): Held {
  const typed: Held = {};
  for (const assetClass of codes) typed[assetClass] = "";
  for (const [assetClass, value] of Object.entries(wouldRead)) typed[assetClass] = String(value);
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
  const address = useSearchParams()[0];
  const came = CAME_FROM[address.get("from") ?? ""] ?? FROM_THE_LIST;
  // With the queue as it was left: a list worked down with a filter on it, and three pages in, is not the
  // same list when it comes back at page one with the filter cleared.
  const asLeft = address.get("back") ?? "";
  const back = { ...came, to: came.to + asLeft };
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);
  // Which classes are written down line by line. Theirs is the one figure nobody types: the total is worked
  // out from the lines, and the API refuses a figure that disagrees with them.
  const lines = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const assetClasses = useAssetClasses();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [held, setHeld] = useState<Held | null>(null);
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  /** What the last conversion did, so the screen can say it rather than leaving it to be noticed. */
  const [converted, setConverted] = useState<Redenomination | null>(null);
  const currencies = useListCurrencies<Currency[], ApiError>();
  const [rebalancedOn, setRebalancedOn] = useState<string | null>(null);
  const [reviewedOn, setReviewedOn] = useState<string | null>(null);
  /**
   * The screen is read until somebody says they are changing it.
   *
   * <p>One way in and one way out, over everything on the page at once: a reader cannot alter a figure by
   * brushing a box, and somebody changing one thing is not asked to save it separately from the next.
   */
  const [editing, setEditing] = useState(false);
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
    // Saving the holdings is what writes a day of history, and converting rewrites every day of it.
    void queryClient.invalidateQueries({ queryKey: getGetClientValuationsQueryKey(customerId) });
    void queryClient.invalidateQueries({ queryKey: getGetClientAttributionQueryKey(customerId) });
  };
  const setModel = useSetClientModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const setHoldings = useSetClientHoldings<ApiError>({
    mutation: { onSuccess: () => { kept(); sayHoldingsSaved(); }, onError },
  });
  const setCurrency = useSetPortfolioCurrency<ApiError>({ mutation: { onError } });
  const rebalanced = useRecordRebalance<ApiError>({ mutation: { onSuccess: kept, onError } });
  const reviewed = useRecordReview<ApiError>({ mutation: { onSuccess: kept, onError } });
  // Each control waits on its own work and nothing else's. One flag over the whole screen dimmed every
  // button the moment any of them was pressed, which reads as the page pressing all of them at once.

  const boxes = classesShown(assetClasses, standing.data);
  const currency = chosenCurrency ?? standing.data?.currency ?? "USD";

  /**
   * Whether keeping the currency means restating what is already on file.
   *
   * <p>Writing the portfolio in another currency converts every class total and every holding line at
   * today's rate, which only the API can do — a line listed under a class carries no currency of its own. A
   * portfolio with nothing written down has nothing to restate, so the choice simply rides along with the
   * figures when they are saved.
   */
  const converting =
    standing.data !== undefined && currency !== standing.data.currency
    && standing.data.underManagement > 0;

  /**
   * What the figures would read in the currency just picked, worked out by the API so that what is shown
   * is what would be written — the same rates, the same rounding, and the same refusal where a rate is
   * missing. Nothing is written by asking.
   */
  const wouldRead = usePreviewPortfolioCurrency<Record<string, number>, ApiError>(customerId, currency, {
    query: { enabled: converting },
  });

  /**
   * The figures the boxes show: what somebody typed, or what the currency they picked would make of what is
   * on file, or what is on file. Shown the moment the currency changes so that the figures and the money
   * they are counted in never read as two different things — and still written only by Save.
   */
  const holdings =
    held ?? (converting && wouldRead.data ? asBoxes(wouldRead.data, boxes) : heldFrom(standing.data, boxes));
  const on = rebalancedOn ?? standing.data?.lastRebalancedOn ?? "";
  const looked = reviewedOn ?? standing.data?.lastReviewedOn ?? "";
  const total = Object.values(holdings).reduce((sum, typed) => sum + (Number(typed) || 0), 0);
  const fromLines = new Set(
    (lines.data?.classes ?? []).filter((one) => one.heldAsPositions).map((one) => one.assetClass),
  );
  // What is typed but not yet saved. The table below reads what is on file, so a figure changed in a box and
  // not kept would otherwise be contradicted by the standings beside it with nothing to say why.
  // The portfolio arrives after the first render, so the box reads from it until somebody picks another.
  const model = chosenModel ?? standing.data?.modelPortfolioId ?? "";
  const figuresChanged =
    held !== null && JSON.stringify(held) !== JSON.stringify(heldFrom(standing.data, boxes));
  const unsaved =
    figuresChanged ||
    (standing.data !== undefined && currency !== standing.data.currency) ||
    (chosenModel !== null && chosenModel !== (standing.data?.modelPortfolioId ?? "")) ||
    (rebalancedOn !== null && rebalancedOn !== (standing.data?.lastRebalancedOn ?? "")) ||
    (reviewedOn !== null && reviewedOn !== (standing.data?.lastReviewedOn ?? ""));
  const saving =
    setHoldings.isPending || setModel.isPending || setCurrency.isPending || rebalanced.isPending
    || reviewed.isPending;

  /** Puts the screen back to what is on file, throwing away whatever was typed. */
  function discard() {
    setHeld(null);
    setChosenModel(null);
    setChosenCurrency(null);
    setRebalancedOn(null);
    setReviewedOn(null);
    setErrors(noErrors);
    setConverted(null);
    setEditing(false);
  }

  /**
   * Keeps everything that changed, in one press.
   *
   * <p>Only what changed is sent. The two dates are somebody's own record of when a thing was done, and a
   * screen that wrote them again every time it saved would stamp today's reading over last month's.
   */
  function save() {
    // The note about a conversion belongs to that conversion, not to everything done afterwards.
    setConverted(null);
    if (chosenModel !== null && chosenModel !== (standing.data?.modelPortfolioId ?? "")) {
      setModel.mutate({ customerId, data: { modelPortfolioId: chosenModel || null } });
    }
    if (rebalancedOn !== null && rebalancedOn !== (standing.data?.lastRebalancedOn ?? "") && rebalancedOn) {
      rebalanced.mutate({ customerId, data: { on: rebalancedOn } });
    }
    if (reviewedOn !== null && reviewedOn !== (standing.data?.lastReviewedOn ?? "") && reviewedOn) {
      reviewed.mutate({ customerId, data: { on: reviewedOn } });
    }
    const done = () => {
      setHeld(null);
      setChosenModel(null);
      setChosenCurrency(null);
      setRebalancedOn(null);
      setReviewedOn(null);
      setEditing(false);
    };
    // Restating what is on file and retyping it are two different things, and the picker does not let them
    // be asked for together, so only one of these can be what was meant.
    if (converting) {
      setCurrency.mutate(
        { customerId, data: { currency } },
        {
          onSuccess: (answer) => {
            setConverted(answer);
            kept();
            done();
          },
        },
      );
      return;
    }
    const wanted: Record<string, number> = {};
    for (const [assetClass, typed] of Object.entries(holdings)) {
      if (typed.trim()) wanted[assetClass] = Number(typed);
    }
    setHoldings.mutate({ customerId, data: { holdings: wanted, currency } }, { onSuccess: done });
  }

  const named = client.data?.client.fullName ?? "";

  return (
    <div className="space-y-6">
      {/* Typing into a box and walking off used to lose it without a word. */}
      <LeaveWithoutSaving
        when={unsaved}
        what="This client's portfolio"
        saving={saving}
        onSave={save}
        onDiscard={discard}
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
              <Button disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <>
              {holdingsSaved && <Saved />}
              {/* The one thing to do on a screen that is otherwise read, so it is the one thing that
                  looks like a button rather than part of the furniture. */}
              <Button onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Edit
              </Button>
            </>
          )}
        </div>
      </header>

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      {client.isError && <Alert tone="danger">{client.error.message}</Alert>}

      {/* One column, read top to bottom. Side by side, two panels are never the same height, so whichever
          is shorter leaves a hole beside the other — and the hole moves about as the figures change. */}
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <Field id="client-model" label="Measured against">
              {/* Kept by Save like everything else. Written the moment it was picked, a reader who brushed
                  the list changed what the client is measured against and was never asked. */}
              <SelectInput
                id="client-model"
                value={model}
                disabled={!editing || saving}
                onChange={(event) => setChosenModel(event.target.value)}
              >
                <option value="">No model — nothing to drift from</option>
                {(models.data?.items ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
          </SelectInput>
        </Field>
      </section>

      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <fieldset>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    What they hold
                  </legend>
                  <p className="mt-1 max-w-prose text-xs text-ink-muted">
                    Written down by hand: no custodian feed delivers these yet. A class listed holding by
                    holding below takes its total from those holdings, so its figure here is worked out
                    rather than typed.
                  </p>
                </div>
                <Field id="holdings-currency" label="Currency">
                  {/* Restating a portfolio and retyping its figures cannot be asked for in one go: the
                      typed figures would be in the currency being left behind, and nothing could say
                      which of the two was meant. */}
                  <SelectInput
                    id="holdings-currency"
                    value={currency}
                    className="w-auto"
                    disabled={!editing || saving || figuresChanged}
                    onChange={(event) => setChosenCurrency(event.target.value)}
                  >
                    {/* Whatever the portfolio is already written in stays offered, even if the firm has
                        since stopped dealing in it. */}
                    {!(currencies.data ?? []).some((one) => one.code === currency) && (
                      <option value={currency}>{currency}</option>
                    )}
                    {(currencies.data ?? []).map((one) => (
                      <option key={one.code} value={one.code}>
                        {one.code} — {one.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {boxes.map((assetClass) => (
                  <Field
                    key={assetClass}
                    id={`holding-${assetClass}`}
                    label={assetClasses.names[assetClass] ?? assetClass}
                    hint={fromLines.has(assetClass) ? "Worked out from its holdings below." : undefined}
                  >
                    {/* A class listed holding by holding is read here, never typed: the API refuses a figure
                        that disagrees with its lines, and a box that can only be refused is a box that should
                        not take a figure in the first place. */}
                    <TextInput
                      {...describedBy(`holding-${assetClass}`, errors.fields.holdings)}
                      id={`holding-${assetClass}`}
                      inputMode="decimal"
                      readOnly={!editing || fromLines.has(assetClass)}
                      className={!editing || fromLines.has(assetClass) ? "bg-canvas text-ink-muted" : undefined}
                      value={holdings[assetClass]}
                      onChange={(event) =>
                        setHeld({ ...holdings, [assetClass]: asFigure(event.target.value, holdings[assetClass]) })
                      }
                    />
                  </Field>
                ))}
              </div>
              {/* Said under the boxes rather than beside the picker: a line of explanation hung off a
                  control stretches the row it is in, and the heading next to it moves with it. */}
              {editing && figuresChanged && (
                <p className="mt-3 text-xs text-ink-muted">
                  Save the figures before changing the currency: typed in one currency and restated into
                  another, nothing could say which was meant.
                </p>
              )}
              {converting && (
                <p className="mt-3 text-xs text-amber-700">
                  {wouldRead.isError
                    ? wouldRead.error.message
                    : wouldRead.isPending
                      ? `Working out what these read in ${currency}…`
                      : `These are what the figures read in ${currency}. Nothing is written until you save, and saving restates every day of history at the rate that applied on each day.`}
                </p>
              )}
              {converted && (
                <p className="mt-3 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Converted from {converted.from}.</span> The client
                  holds the same things; only the money they are counted in has changed.
                  {converted.lines > 0 &&
                    ` ${converted.lines === 1 ? "1 holding" : `${converted.lines} holdings`} listed under a class moved with it.`}
                  {converted.days > 0 &&
                    ` ${converted.days === 1 ? "1 day" : `${converted.days} days`} of history ${converted.days === 1 ? "was" : "were"} rewritten, each at the rate that applied on that day, so a return read in ${standing.data?.currency ?? ""} is the one it actually earned.`}
                </p>
              )}
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

      {standing.data && standing.data.classes.length > 0 && (
            <section className="rounded-2xl border border-line bg-white px-6 py-5">
              <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Against the model
              </h2>
              {/* Said where the figures are, not at the foot of the screen: a table that disagrees with the
                  boxes beside it has to say why where it is read. */}
              {unsaved && (
                <p className="mt-1 text-xs text-amber-700">
                  This reads what is on file. The page has been changed and not saved.
                </p>
              )}
              <div className="mt-3">
                <ClassStandingTable
                  classes={standing.data.classes}
                  currency={standing.data.currency}
                  underManagement={standing.data.underManagement}
                />
              </div>
            </section>
          )}

      {/* Two dates the platform cannot work out for itself: the trading happens at the custodian and the
          reading happens in somebody's head. Written down here, they are what the review cadence and the
          drift queue are measured from.

          Set out as a record rather than as a column of fields: stacked, a label, a date and a line of
          explanation three times over reads as one thing running into the next. */}
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">When it was dealt with</h2>

        <dl className="mt-4 divide-y divide-line">
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

      <ClientHoldingsPanel customerId={customerId} onChanged={kept} readOnly={!editing} />

      <ValuationHistoryPanel customerId={customerId} />

      <FixedIncomePanel customerId={customerId} />

      <ExposurePanel customerId={customerId} />

      <AttributionPanel customerId={customerId} />

      {standing.data && (
        <WhatIfPanel customerId={customerId} standing={standing.data} editing={editing} />
      )}
    </div>
  );
}

/**
 * Which classes get a box: the ones the firm still uses, plus any retired one this client is already counted
 * under — that figure has to be movable, and a box that never appears is a figure nobody can take out.
 */
function classesShown(
  assetClasses: ReturnType<typeof useAssetClasses>,
  standing: PortfolioStanding | undefined,
): string[] {
  const held = new Set(Object.keys(standing?.holdings ?? {}));
  return assetClasses.all
    .filter((one) => one.retiredAt === null || held.has(one.code))
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
 * One line of the record: what is being dated, the date itself, and what the date means.
 *
 * <p>Name on the left and date on the right, on one line each, so two of them read as a pair of facts
 * rather than as six paragraphs in a row.
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
    <div className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-baseline">
      <dt>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="mt-0.5 block text-xs text-ink-muted">{said}</span>
      </dt>
      <dd className="sm:justify-self-start">{children}</dd>
    </div>
  );
}
