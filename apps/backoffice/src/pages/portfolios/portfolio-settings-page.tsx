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
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useStaffUser } from "../../auth/session";
import { ListPageHeader } from "../../components/record-list";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { AssetClassesTab } from "../config/asset-classes-tab";
import { BenchmarksPanel } from "./benchmarks-panel";
import { PreTradeLimitsPanel } from "./pre-trade-limits-panel";
import { useShowFirstError } from "../../lib/show-first-error";
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
  const page = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  // A refusal takes the reader to it: the rules run a long way above the button that saves them.
  useShowFirstError(errors, page);
  const [saved, setSaved] = useState(false);

  // The boxes start from what the firm has settled, and stay as they are typed from then on.
  const held = settings.data;
  const typed = edits ?? asTyped(held);
  const { classBreachAt, subAssetBreachAt, insideSubAssetBreachAt, sellOrder, minimumTrade,
    breachAlertTo, warnOnNearLimit } =
    typed;
  const set = (part: Partial<Typed>) => setEdits({ ...typed, ...part });
  // Nothing to save until something is different from what the firm has settled. Compared against the
  // record rather than against "has anybody typed", so typing a figure and typing it back leaves the
  // button where it was.
  const changed = held != null
    && (Object.keys(typed) as (keyof Typed)[]).some((field) => typed[field] !== asTyped(held)[field]);

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

  const figures = [classBreachAt, subAssetBreachAt, insideSubAssetBreachAt, minimumTrade];
  const readable = figures.every((typed) => typed.trim() !== "" && Number.isFinite(Number(typed)));
  // Nothing to put in order. Each figure answers for its own depth, and a depth has no reading finer than
  // past its band or not — so no figure here has to be wider or narrower than the one beside it. A class
  // is usually allowed further than the lines inside it, but that is the firm's judgement to make rather
  // than a rule to enforce.

  function submit(event?: FormEvent) {
    event?.preventDefault();
    change.mutate({
      data: {
        classBreachAt: Number(classBreachAt),
        subAssetBreachAt: Number(subAssetBreachAt),
        insideSubAssetBreachAt: Number(insideSubAssetBreachAt),
        sellOrder,
        minimumTrade: Number(minimumTrade),
        breachAlertTo,
        warnOnNearLimit,
      },
    });
  }

  if (settings.isError) return <Alert tone="danger">{settings.error.message}</Alert>;

  return (
    <div ref={page} className="space-y-6">
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

      <div className="space-y-5">
        {/* One figure for each depth a plan is written at, which is the shape the firm plans in: a class,
            the lines inside it, and the lines inside those. What stood here was three figures for one
            depth — worth watching, at the edge, broken — and nothing read any of them: a model carried
            its own numbers in the code, so the screen promised a rule it never applied. */}
        <Panel
          title="How far a plan may drift before it has breached"
          says="Percentage points from target, at each depth. Carried into a new model, which may write its own; a model already written is left as it was settled."
          takesEffect
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="set-class" label="Asset class" error={errors.fields.classBreachAt}>
              <TextInput
                {...describedBy("set-class", errors.fields.classBreachAt)}
                id="set-class"
                inputMode="decimal"
                disabled={!mayChange}
                value={classBreachAt}
                onChange={(event) => set({ classBreachAt: asFigure(event.target.value, classBreachAt) })}
              />
            </Field>
            <Field id="set-sub-asset" label="Sub-asset" error={errors.fields.subAssetBreachAt}>
              <TextInput
                {...describedBy("set-sub-asset", errors.fields.subAssetBreachAt)}
                id="set-sub-asset"
                inputMode="decimal"
                disabled={!mayChange}
                value={subAssetBreachAt}
                onChange={(event) => set({ subAssetBreachAt: asFigure(event.target.value, subAssetBreachAt) })}
              />
            </Field>
            <Field id="set-inside" label="Inside a sub-asset" error={errors.fields.insideSubAssetBreachAt}>
              <TextInput
                {...describedBy("set-inside", errors.fields.insideSubAssetBreachAt)}
                id="set-inside"
                inputMode="decimal"
                disabled={!mayChange}
                value={insideSubAssetBreachAt}
                onChange={(event) =>
                  set({ insideSubAssetBreachAt: asFigure(event.target.value, insideSubAssetBreachAt) })}
              />
            </Field>
          </div>
        </Panel>

      </div>

      {/* The indices themselves, not a line of small print pointing at them. They were a screen of their
          own, reached from here and from nowhere else — so the thing that makes Model performance work
          was two screens away from the rules it belongs with. */}
      <BenchmarksPanel />

      {/* The classes themselves, on the screen where the plans that use them are set up. Adding one used
          to be Admin work, because it sat behind managing configuration with the banks and the email
          templates; it has a permission of its own now and the portfolio desk holds it. */}
      <section aria-labelledby="panel-asset-classes" className="rounded-2xl border border-line bg-white p-5">
        <h2 id="panel-asset-classes" className="text-base font-bold">Asset classes</h2>
        <div className="mt-3">
          <AssetClassesTab lean />
        </div>
      </section>

      {/* A second form for the rules that are not about drift. One record behind both, so either Save
          writes the whole screen; they are apart because the plans' own furniture — the indices and the
          classes — belongs between them, and a form cannot hold a form. */}
      <div className="space-y-5">
        <Panel
          title="Rebalancing rules"
          says="Which holding to sell when a class is over-weight, and how small a trade is not worth raising."
          takesEffect
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="set-sell"
              label="Sell first"
              hint={
                held && !held.sellOrderActsYet
                  ? "Recorded, not yet obeyed anywhere."
                  : "On Ask, nothing is raised without somebody choosing."
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

        {/* Said in what it actually does. "Alerts · Tell about a breach · Near the limit" named three
            things and explained none of them: a reader could not tell what was looked at, when, who
            heard, or by what. */}
        <Panel
          title="Breach alerts"
          says="Every morning a sweep reads every client who is on a model and finds the classes past their band. Whoever is named below gets a bell in the portal — once for each class, and again only if it gets worse."
          takesEffect
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="set-alert" label="Who hears" error={errors.fields.breachAlertTo}>
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
            <Field id="set-near" label="Before it breaks">
              <label className="flex items-center gap-2 py-2.5 text-sm">
                <input
                  id="set-near"
                  type="checkbox"
                  className="size-4 rounded border-line"
                  checked={warnOnNearLimit}
                  disabled={!mayChange}
                  onChange={(event) => set({ warnOnNearLimit: event.target.checked })}
                />
                Say so at the edge too, not only once it has broken
              </label>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            A client on their own allocation is left alone — nobody settled the targets it would be drifting
            from. An email follows the bell once its wording is written on Email templates.
          </p>
        </Panel>

      </div>

      {/* Its own record and its own Save: the rules above are one row of defaults, these are a row a class. */}
      <PreTradeLimitsPanel mayChange={mayChange} />

      {/* One Save for the rules, at the foot of the screen rather than in the middle of it, and off until
          something is different from what the firm has settled. The ceilings below keep their own, because
          they are their own record. */}
      {mayChange && (
        <div className="flex items-center justify-end gap-3">
          <Button disabled={!changed || !readable || change.isPending} onClick={() => submit()}>
            {change.isPending ? "Saving…" : "Save the rules"}
          </Button>
        </div>
      )}

    </div>
  );
}

/** The rules as they are typed, which is as text until they are saved as figures. */
interface Typed {
  classBreachAt: string;
  subAssetBreachAt: string;
  insideSubAssetBreachAt: string;
  sellOrder: SellOrder;
  minimumTrade: string;
  breachAlertTo: AlertTo;
  warnOnNearLimit: boolean;
}

/** What the firm has settled, as boxes. Blank until it has been read, rather than a guess at the defaults. */
function asTyped(held: SettingsView | undefined): Typed {
  return {
    classBreachAt: held ? String(held.classBreachAt) : "",
    subAssetBreachAt: held ? String(held.subAssetBreachAt) : "",
    insideSubAssetBreachAt: held ? String(held.insideSubAssetBreachAt) : "",
    sellOrder: held?.sellOrder ?? "ASK",
    minimumTrade: held ? String(held.minimumTrade) : "",
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
  // A section with a heading rather than a fieldset with a legend. A legend is drawn ON the border it
  // belongs to, so every title here sat half inside the box and half out of it, which the panels beside
  // them — benchmarks, pre-trade limits — do not. Grouped for a screen reader by the heading it is
  // labelled with, which is what those panels do too.
  const titleId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-line bg-white p-5">
      <h2 id={titleId} className="text-base font-bold">{title}</h2>
      <p className={cn("mt-1 text-xs text-ink-muted", takesEffect && "flex items-center gap-1.5")}>
        {takesEffect && <Check aria-hidden="true" className="size-3.5 shrink-0 text-emerald-600" />}
        {says}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}
