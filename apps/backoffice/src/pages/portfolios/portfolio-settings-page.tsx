import { ApiError } from "@atomprive/api-client";
import {
  getGetPortfolioSettingsQueryKey,
  useChangePortfolioSettings,
  useGetPortfolioSettings,
  type SettingsView,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, SelectInput, TextInput, cn, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ListPageHeader } from "../../components/record-list";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { asFigure } from "../../lib/figures";
import { formatDateTime } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";

type SellOrder = SettingsView["sellOrder"];
type AlertTo = SettingsView["breachAlertTo"];

/**
 * The rules the firm sets once and every other portfolio screen obeys.
 *
 * <p>Changing a default changes what the next model is written with. It does not re-judge the models already
 * written: a client measured against something settled last quarter stays measured against it until somebody
 * deliberately changes that model.
 */
export function PortfolioSettingsPage() {
  const queryClient = useQueryClient();
  const mayChange = hasAuthority(useStaffUser(), "SEND_PROPOSALS:CHANGE");
  const settings = useGetPortfolioSettings<SettingsView, ApiError>();

  const [edits, setEdits] = useState<Typed | null>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [saved, setSaved] = useState(false);

  // The boxes start from what the firm has settled, and stay as they are typed from then on.
  const held = settings.data;
  const typed = edits ?? asTyped(held);
  const { watchAt, edgeAt, breachAt, sellOrder, minimumTrade, reviewEveryMonths, breachAlertTo, warnOnNearLimit } =
    typed;
  const set = (part: Partial<Typed>) => setEdits({ ...typed, ...part });

  const change = useChangePortfolioSettings<ApiError>({
    mutation: {
      onSuccess: () => {
        setErrors(noErrors);
        setSaved(true);
        void queryClient.invalidateQueries({ queryKey: getGetPortfolioSettingsQueryKey() });
      },
      onError: (caught) => {
        setSaved(false);
        setErrors(toFormErrors(caught));
      },
    },
  });

  const figures = [watchAt, edgeAt, breachAt, minimumTrade, reviewEveryMonths];
  const readable = figures.every((typed) => typed.trim() !== "" && Number.isFinite(Number(typed)));
  // The bands have to widen, or a drift would be at the edge before it was worth watching.
  const widen = readable && Number(watchAt) < Number(edgeAt) && Number(edgeAt) < Number(breachAt);

  function submit(event: FormEvent) {
    event.preventDefault();
    change.mutate({
      data: {
        defaultWatchAt: Number(watchAt),
        defaultEdgeAt: Number(edgeAt),
        defaultBreachAt: Number(breachAt),
        sellOrder,
        minimumTrade: Number(minimumTrade),
        reviewEveryMonths: Number(reviewEveryMonths),
        breachAlertTo,
        warnOnNearLimit,
      },
    });
  }

  if (settings.isError) return <Alert tone="danger">{settings.error.message}</Alert>;

  return (
    <div className="space-y-6">
      <ListPageHeader title="Portfolio settings" lead="The rules every other portfolio screen obeys." />

      {held && (
        <p className="-mt-3 text-xs text-ink-muted">
          Last changed {formatDateTime(held.updatedAt)}
          {held.updatedBy ? ` by ${held.updatedBy}` : ""}.
        </p>
      )}

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      {saved && !change.isPending && (
        <Alert tone="success">
          Saved. A new default applies to the next model written — the models already written are left as they
          were settled.
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-5">
        <Panel
          title="Default tolerance bands"
          says="Applied to a new model unless it overrides them. Changing these does not re-judge a model already written."
          takesEffect
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="set-watch" label="Worth watching from" error={errors.fields.defaultWatchAt}>
              <TextInput
                {...describedBy("set-watch", errors.fields.defaultWatchAt)}
                id="set-watch"
                inputMode="decimal"
                disabled={!mayChange}
                value={watchAt}
                onChange={(event) => set({ watchAt: asFigure(event.target.value, watchAt) })}
              />
            </Field>
            <Field id="set-edge" label="At the edge from" error={errors.fields.defaultEdgeAt}>
              <TextInput
                {...describedBy("set-edge", errors.fields.defaultEdgeAt)}
                id="set-edge"
                inputMode="decimal"
                disabled={!mayChange}
                value={edgeAt}
                onChange={(event) => set({ edgeAt: asFigure(event.target.value, edgeAt) })}
              />
            </Field>
            <Field id="set-breach" label="Breached from" error={errors.fields.defaultBreachAt}>
              <TextInput
                {...describedBy("set-breach", errors.fields.defaultBreachAt)}
                id="set-breach"
                inputMode="decimal"
                disabled={!mayChange}
                value={breachAt}
                onChange={(event) => set({ breachAt: asFigure(event.target.value, breachAt) })}
              />
            </Field>
          </div>
          {readable && !widen && (
            <p className="mt-2 text-xs text-red-600">
              The bands have to widen: worth watching, then the edge, then broken.
            </p>
          )}
        </Panel>

        <Panel
          title="Rebalancing rules"
          says="Which holding to sell when a class is over-weight, and how small a trade is not worth raising. Drafting proposals from a model's rebalancing obeys both."
          takesEffect
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="set-sell"
              label="Sell first"
              hint={
                held && !held.sellOrderActsYet
                  ? "Recorded, not yet obeyed anywhere."
                  : "On Ask, bulk rebalancing refuses to draft rather than guessing for the firm."
              }
              error={errors.fields.sellOrder}
            >
              <SelectInput
                id="set-sell"
                value={sellOrder}
                disabled={!mayChange}
                onChange={(event) => set({ sellOrder: event.target.value as SellOrder })}
              >
                <option value="ASK">Ask — raise no trade without somebody choosing</option>
                <option value="LARGEST_FIRST">The largest holding first</option>
                <option value="WORST_PERFORMER_FIRST">Whatever has done worst first</option>
              </SelectInput>
            </Field>
            <Field
              id="set-minimum"
              label="Smallest trade worth raising"
              hint="Below this, bulk rebalancing leaves the drift alone."
              error={errors.fields.minimumTrade}
            >
              <TextInput
                {...describedBy("set-minimum", errors.fields.minimumTrade)}
                id="set-minimum"
                inputMode="decimal"
                disabled={!mayChange}
                value={minimumTrade}
                onChange={(event) => set({ minimumTrade: asFigure(event.target.value, minimumTrade) })}
              />
            </Field>
          </div>
          {sellOrder === "WORST_PERFORMER_FIRST" && (
            <p className="mt-2 text-xs text-amber-700">
              Choosing by performance needs what each holding has done, which the platform does not record: it
              keeps what a portfolio was worth, not what each line in it did.
            </p>
          )}
        </Panel>

        <Panel
          title="Review cadence"
          says="How often a client should be looked at. A client past it shows on the dashboard, and one nobody has ever read is waiting from the day their portfolio is opened."
          takesEffect
        >
          <Field id="set-review" label="Months between reviews" error={errors.fields.reviewEveryMonths}>
            <TextInput
              {...describedBy("set-review", errors.fields.reviewEveryMonths)}
              id="set-review"
              inputMode="numeric"
              className="max-w-32"
              disabled={!mayChange}
              value={reviewEveryMonths}
              onChange={(event) => set({ reviewEveryMonths: asFigure(event.target.value, reviewEveryMonths) })}
            />
          </Field>
        </Panel>

        <Panel
          title="Alerts"
          says="Who hears when a client's portfolio breaks its model. Looked for once a day; said once, and again only when a drift gets worse."
          takesEffect
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="set-alert" label="Tell about a breach" error={errors.fields.breachAlertTo}>
              <SelectInput
                id="set-alert"
                value={breachAlertTo}
                disabled={!mayChange}
                onChange={(event) => set({ breachAlertTo: event.target.value as AlertTo })}
              >
                <option value="NOBODY">Nobody — the drift queue is read, not sent</option>
                <option value="PORTFOLIO_MANAGER">The portfolio manager</option>
                <option value="ADVISOR">The client's advisor</option>
                <option value="BOTH">Both</option>
              </SelectInput>
            </Field>
            <Field id="set-near" label="Near the limit">
              <label className="flex items-center gap-2 py-2.5 text-sm">
                <input
                  id="set-near"
                  type="checkbox"
                  className="size-4 rounded border-line"
                  checked={warnOnNearLimit}
                  disabled={!mayChange}
                  onChange={(event) => set({ warnOnNearLimit: event.target.checked })}
                />
                Say so before it breaks, not only after
              </label>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            It reaches the bell inside the portal whatever the firm has worded. The breach email follows once
            somebody writes it on Email templates.
          </p>
        </Panel>

        {mayChange && (
          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={change.isPending || !readable || !widen}>
              {change.isPending ? "Saving…" : "Save the rules"}
            </Button>
          </div>
        )}
      </form>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-bold">Where the rest of the rules live</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="font-semibold">
              <Link to="/benchmarks" className="text-primary-700 hover:underline">
                Benchmarks
              </Link>
            </dt>
            <dd className="text-ink-muted">
              Which index each model is measured against, and in which currency. On its own screen, because
              each one carries a series of levels rather than a single figure.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Asset class taxonomy</dt>
            <dd className="text-ink-muted">
              The six classes are fixed in the platform, in the order the firm's own portfolio review prints
              them. Sub-classes are not a list to maintain: they are written on a model and on a holding as
              the firm writes them, so a new one needs nothing set up here first.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/** The rules as they are typed, which is as text until they are saved as figures. */
interface Typed {
  watchAt: string;
  edgeAt: string;
  breachAt: string;
  sellOrder: SellOrder;
  minimumTrade: string;
  reviewEveryMonths: string;
  breachAlertTo: AlertTo;
  warnOnNearLimit: boolean;
}

/** What the firm has settled, as boxes. Blank until it has been read, rather than a guess at the defaults. */
function asTyped(held: SettingsView | undefined): Typed {
  return {
    watchAt: held ? String(held.defaultWatchAt) : "",
    edgeAt: held ? String(held.defaultEdgeAt) : "",
    breachAt: held ? String(held.defaultBreachAt) : "",
    sellOrder: held?.sellOrder ?? "ASK",
    minimumTrade: held ? String(held.minimumTrade) : "",
    reviewEveryMonths: held ? String(held.reviewEveryMonths) : "",
    breachAlertTo: held?.breachAlertTo ?? "PORTFOLIO_MANAGER",
    warnOnNearLimit: held?.warnOnNearLimit ?? true,
  };
}

function Panel({
  title,
  says,
  takesEffect = false,
  children,
}: {
  title: string;
  says: string;
  takesEffect?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-line bg-white p-5">
      <legend className="px-1.5 text-sm font-bold">{title}</legend>
      <p className={cn("text-xs text-ink-muted", takesEffect && "flex items-center gap-1.5")}>
        {takesEffect && <Check aria-hidden="true" className="size-3.5 shrink-0 text-emerald-600" />}
        {says}
      </p>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}
