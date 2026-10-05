import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useGetCustomer,
  useListClientHoldings,
  useListModelPortfolios,
  useRecordRebalance,
  useRecordReview,
  useSetClientHoldings,
  useSetClientModelPortfolio,
  type ClientHoldings,
  type CustomerDetail,
  type ModelsPage,
  type PortfolioStanding,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, DateInput, Field, SelectInput, TextInput, describedBy } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { asFigure } from "../../lib/figures";
import { useAssetClasses } from "./asset-classes";
import { ClassStandingTable } from "./class-standing-table";
import { ClientHoldingsPanel } from "./client-holdings-panel";
import { driftLabel, standingLabels, standingTones, underManagementLabel } from "./portfolio-labels";

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
  const [rebalancedOn, setRebalancedOn] = useState<string | null>(null);
  const [reviewedOn, setReviewedOn] = useState<string | null>(null);

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const kept = () => {
    setErrors(noErrors);
    void standing.refetch();
    // Adding or removing a line changes which classes are worked out rather than typed, so the boxes have
    // to be told as well as the totals.
    void lines.refetch();
  };
  const setModel = useSetClientModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const setHoldings = useSetClientHoldings<ApiError>({ mutation: { onSuccess: kept, onError } });
  const rebalanced = useRecordRebalance<ApiError>({ mutation: { onSuccess: kept, onError } });
  const reviewed = useRecordReview<ApiError>({ mutation: { onSuccess: kept, onError } });
  // Each control waits on its own work and nothing else's. One flag over the whole screen dimmed every
  // button the moment any of them was pressed, which reads as the page pressing all of them at once.

  // The boxes start from what is on file, and stay as they are typed from then on.
  const boxes = classesShown(assetClasses, standing.data);
  const holdings = held ?? heldFrom(standing.data, boxes);
  const on = rebalancedOn ?? standing.data?.lastRebalancedOn ?? "";
  const looked = reviewedOn ?? standing.data?.lastReviewedOn ?? "";
  const total = Object.values(holdings).reduce((sum, typed) => sum + (Number(typed) || 0), 0);
  const fromLines = new Set(
    (lines.data?.classes ?? []).filter((one) => one.heldAsPositions).map((one) => one.assetClass),
  );
  // What is typed but not yet saved. The table below reads what is on file, so a figure changed in a box and
  // not kept would otherwise be contradicted by the standings beside it with nothing to say why.
  const unsaved = held !== null && JSON.stringify(held) !== JSON.stringify(heldFrom(standing.data, boxes));

  function save() {
    const wanted: Record<string, number> = {};
    for (const [assetClass, typed] of Object.entries(holdings)) {
      if (typed.trim()) wanted[assetClass] = Number(typed);
    }
    setHoldings.mutate(
      { customerId, data: { holdings: wanted, currency: standing.data?.currency ?? "USD" } },
      { onSuccess: () => setHeld(null) },
    );
  }

  const named = client.data?.client.fullName ?? "";

  return (
    <div className="space-y-6">
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
        </div>
      </header>

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      {client.isError && <Alert tone="danger">{client.error.message}</Alert>}

      {/* Two columns on a wide screen: what is written down on the left, what it comes to against the model
          on the right. They are read together — a figure is typed and its standing checked in the same
          glance — and stacked they put the answer a screen below the question. */}
      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white px-6 py-5">
            <Field id="client-model" label="Measured against">
              <SelectInput
                id="client-model"
                value={standing.data?.modelPortfolioId ?? ""}
                disabled={setModel.isPending}
                onChange={(event) =>
                  setModel.mutate({ customerId, data: { modelPortfolioId: event.target.value || null } })
                }
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
              <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                What they hold, in {standing.data?.currency ?? "USD"}
              </legend>
              <p className="mt-1 text-xs text-ink-muted">
                Written down by hand: no custodian feed delivers these yet. A class listed holding by holding
                below takes its total from those holdings, so its figure here is worked out rather than typed.
              </p>
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
                      readOnly={fromLines.has(assetClass)}
                      className={fromLines.has(assetClass) ? "bg-canvas text-ink-muted" : undefined}
                      value={holdings[assetClass]}
                      onChange={(event) =>
                        setHeld({ ...holdings, [assetClass]: asFigure(event.target.value, holdings[assetClass]) })
                      }
                    />
                  </Field>
                ))}
              </div>
              {errors.fields.holdings && (
                <p className="mt-3 text-xs text-red-600">{errors.fields.holdings}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  {total > 0 ? `Adds up to ${total.toLocaleString()}.` : "Nothing written down yet."}
                  {unsaved && <span className="ml-1 font-semibold text-amber-700">Not saved yet.</span>}
                </p>
                <Button size="sm" disabled={setHoldings.isPending} onClick={save}>
                  {setHoldings.isPending ? "Saving…" : "Save the holdings"}
                </Button>
              </div>
            </fieldset>
          </section>

          <ClientHoldingsPanel customerId={customerId} onChanged={kept} />
        </div>

        <div className="space-y-6">
          {standing.data && standing.data.classes.length > 0 && (
            <section className="rounded-2xl border border-line bg-white px-6 py-5">
              <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Against the model
              </h2>
              {/* Said where the figures are, not at the foot of the screen: a table that disagrees with the
                  boxes beside it has to say why where it is read. */}
              {unsaved && (
                <p className="mt-1 text-xs text-amber-700">
                  This reads what is on file. The boxes beside it have been changed and not saved.
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

          <section className="space-y-5 rounded-2xl border border-line bg-white px-6 py-5">
            <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">When it was dealt with</h2>
            {/* Two dates the platform cannot work out for itself: the trading happens at the custodian and
                the reading happens in somebody's head. Written down here, they are what the review cadence
                and the drift queue are measured from. */}
            <Field
              id="rebalanced-on"
              label="Last put back to the model"
              hint="The day the trades were done. Drift is read as how far it has wandered since."
              error={errors.fields.on}
            >
              <div className="flex items-end gap-2">
                <DateInput
                  id="rebalanced-on"
                  name="rebalancedOn"
                  value={on}
                  min={yearsAgo(20)}
                  max={today()}
                  onChange={setRebalancedOn}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={rebalanced.isPending || !on}
                  onClick={() => rebalanced.mutate({ customerId, data: { on } })}
                >
                  {rebalanced.isPending ? "Recording…" : "Record it"}
                </Button>
              </div>
            </Field>

            {/* Reading the file is not the same as putting it back: a review can end in doing nothing at all. */}
            <Field
              id="reviewed-on"
              label="Last looked at"
              hint={
                standing.data?.lastReviewedOn
                  ? standing.data.reviewOverdue
                    ? "Due another look."
                    : `Next due ${standing.data.reviewDueOn ?? ""}.`
                  : "The day somebody read this file through. Nobody has yet."
              }
              error={errors.fields.on}
            >
              <div className="flex items-end gap-2">
                <DateInput
                  id="reviewed-on"
                  name="reviewedOn"
                  value={looked}
                  min={yearsAgo(20)}
                  max={today()}
                  onChange={setReviewedOn}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={reviewed.isPending || !looked}
                  onClick={() => reviewed.mutate({ customerId, data: { on: looked } })}
                >
                  {reviewed.isPending ? "Recording…" : "Record it"}
                </Button>
              </div>
            </Field>
          </section>
        </div>
      </div>
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
