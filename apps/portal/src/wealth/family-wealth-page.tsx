import { ApiError } from "@atomprive/api-client";
import {
  getFamilyWealthQueryKey,
  getWealthGrantsQueryKey,
  useFamily,
  useFamilyWealth,
  useShareWealth,
  useStopSharingWealth,
  useWealthGrants,
  type FamilyPerson,
  type LinePoint,
  type MyFamily,
  type PortalFamilyWealth,
  type TopHolding,
  type ValueSlice,
  type WealthGrant,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Check, Lock, Share2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { when } from "../lib/dates";
import { initialsOf } from "../lib/money";
import { treeOf, type Branch } from "../pages/family-tree";
import { Card } from "./card";
import { AllocationRing, LineChart } from "./dashboard-charts";
import { compact, percent, whole } from "./figures";

/**
 * The family's wealth as this client may read it: their own, and that of every family member who chose to show
 * it to them, added up in the client's currency. The tree shows the whole family; a member who has not shared
 * theirs is drawn with a lock and is not counted.
 */

const PERIODS = ["3M", "YTD", "1Y", "MAX"] as const;

const FAMILY = "family";

function tomorrow() {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  return day.toISOString().slice(0, 10);
}

function Face({ person, size = "size-10" }: { person: Pick<FamilyPerson, "fullName" | "photo">; size?: string }) {
  return person.photo ? (
    <img src={person.photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700`}>{initialsOf(person.fullName)}</span>
  );
}

/** One person on the tree: what they are to the family, and their net worth where they shared it. */
function Node({
  person,
  worth,
  currency,
  picked,
  onPick,
}: {
  person: FamilyPerson;
  worth: number | undefined;
  currency: string;
  picked: boolean;
  onPick: () => void;
}) {
  const shared = worth !== undefined;
  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={!shared}
      onClick={onPick}
      title={shared ? undefined : `${person.fullName} has not shared their wealth with you`}
      className={`flex w-60 items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors ${
        picked ? "border-primary-600 bg-primary-50 ring-1 ring-primary-600" : shared ? "border-line hover:bg-sidebar" : "cursor-not-allowed border-dashed border-line opacity-70"
      }`}
    >
      <Face person={person} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">
          {person.fullName}
          {person.you && <span className="font-medium text-ink-muted"> (you)</span>}
        </span>
        <span className="block truncate text-xs text-ink-muted">{person.relationshipToPrimary ?? person.relationship ?? (person.primaryHolder ? "Account holder" : "Family member")}</span>
        {shared ? (
          <span className="block text-xs font-semibold text-ink tabular-nums">{compact(worth, currency)}</span>
        ) : (
          <span className="flex items-center gap-1 text-xs whitespace-nowrap text-ink-muted">
            <Lock aria-hidden="true" className="size-3" />
            Not shared with you
          </span>
        )}
      </span>
    </button>
  );
}

/** A branch and everybody under it, a line down to each generation. */
function Tree({ branch, render }: { branch: Branch; render: (person: FamilyPerson) => ReactNode }) {
  return (
    <li className="flex flex-col items-center">
      {render(branch.person)}
      {branch.children.length > 0 && (
        <>
          <span aria-hidden="true" className="h-5 w-px bg-line" />
          <ul className={`flex gap-6 pt-5 ${branch.children.length > 1 ? "border-t border-line" : ""}`}>
            {branch.children.map((one) => (
              <Tree key={one.person.id} branch={one} render={render} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

function Figure({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 p-5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="mt-1 truncate text-xl font-bold text-ink tabular-nums">{value}</div>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function Return({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-muted">—</span>;
  const Arrow = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`flex items-center gap-1 ${value >= 0 ? "text-access-full-ink" : "text-access-none-ink"}`}>
      <Arrow aria-hidden="true" className="size-5" />
      {percent(value)}
    </span>
  );
}

function Holdings({ holdings, currency }: { holdings: TopHolding[]; currency: string }) {
  if (holdings.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No holdings yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
            <th scope="col" className="py-3 pr-4 pl-3">Holding</th>
            <th scope="col" className="px-4 py-3">Type</th>
            <th scope="col" className="py-3 pr-3 pl-4 text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {holdings.map((one) => (
            <tr key={`${one.name}-${one.kind}`}>
              <td className="px-3 py-2.5 font-semibold text-ink">{one.name}</td>
              <td className="px-3 py-2.5 text-ink-soft">{one.kind}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-ink tabular-nums">{whole(one.value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Choose who may see your wealth, until when; and stop showing it to anybody already shown. */
function ShareDialog({ people, onClose }: { people: FamilyPerson[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const grants = useWealthGrants<WealthGrant[], ApiError>();
  const [who, setWho] = useState<string>();
  const [until, setUntil] = useState("");
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getWealthGrantsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getFamilyWealthQueryKey() });
  };
  const share = useShareWealth<ApiError>({
    mutation: {
      onSuccess: () => {
        refresh();
        setWho(undefined);
        setUntil("");
      },
    },
  });
  const stop = useStopSharingWealth<ApiError>({ mutation: { onSuccess: refresh } });
  const others = people.filter((one) => !one.you);
  const given = (grants.data ?? []).filter((one) => one.mine);
  const nameOf = (id: string) => people.find((one) => one.id === id)?.fullName ?? "A family member";

  return (
    <Dialog
      open
      onClose={onClose}
      title="Share my wealth"
      description="Let a family member see your wealth: your portfolio, what you own outside it and your loans. They can see it, never change it."
    >
      <div className="space-y-5">
        {given.length > 0 && (
          <div>
            <p className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Shared with</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {given.map((one) => (
                <li key={one.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{nameOf(one.granteeId)}</span>
                    <span className="block text-xs text-ink-muted">{one.expiresOn ? `Until ${when(one.expiresOn)}` : "Until you stop it"}</span>
                  </span>
                  <Button variant="secondary" size="sm" disabled={stop.isPending} onClick={() => stop.mutate({ id: one.id })}>
                    Stop sharing
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Family member</legend>
          {others.length === 0 ? (
            <p className="rounded-xl bg-sidebar px-4 py-3 text-sm text-ink-muted">There is nobody else in your family group to share with yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {others.map((one) => (
                <li key={one.id}>
                  <button
                    type="button"
                    aria-pressed={who === one.id}
                    onClick={() => setWho(one.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                      who === one.id ? "border-primary-600 bg-primary-50" : "border-line hover:bg-sidebar"
                    }`}
                  >
                    <Face person={one} size="size-9" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{one.fullName}</span>
                      {one.relationship && <span className="block text-xs text-ink-muted">{one.relationship}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div>
          <label htmlFor="share-until" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Until (optional)
          </label>
          <input
            id="share-until"
            name="share-until"
            type="date"
            min={tomorrow()}
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
          <p className="mt-1 text-xs text-ink-muted">Leave empty to keep sharing until you stop it.</p>
        </div>

        {share.isError && <Alert tone="danger">{share.error.message}</Alert>}
        {stop.isError && <Alert tone="danger">{stop.error.message}</Alert>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={share.isPending}>
            Close
          </Button>
          <Button disabled={!who || share.isPending} onClick={() => who && share.mutate({ data: { granteeId: who, expiresOn: until || null } })}>
            <Check aria-hidden="true" />
            {share.isPending ? "Sharing…" : "Share"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function FamilyWealthPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("YTD");
  const [picked, setPicked] = useState<string>(FAMILY);
  const [sharing, setSharing] = useState(false);
  const family = useFamily<MyFamily, ApiError>();
  const wealth = useFamilyWealth<PortalFamilyWealth, ApiError>({ period });

  const people = family.data?.people ?? [];
  const data = wealth.data;
  const currency = data?.wealth.currency ?? "USD";
  const worthOf = new Map((data?.wealth.members ?? []).map((one) => [one.customerId, one]));
  const member = picked === FAMILY ? undefined : worthOf.get(picked);
  const counted = data?.wealth.members.length ?? 0;

  const shown: {
    name: string;
    netWorth: number;
    managed: number | null;
    owned: number;
    loans: number;
    twr: number | null;
    line: LinePoint[];
    slices: ValueSlice[];
    holdings: TopHolding[];
  } | null = !data
    ? null
    : member
      ? {
          name: member.name,
          netWorth: member.netWorth,
          managed: member.managed,
          owned: member.owned,
          loans: member.loans,
          twr: member.twrYearToDate,
          line: member.netWorthLine,
          slices: member.byAssetClass,
          holdings: member.topHoldings,
        }
      : {
          name: "Whole family",
          netWorth: data.wealth.netWorth,
          managed: data.wealth.managed,
          owned: data.wealth.owned,
          loans: data.wealth.loans,
          twr: data.wealth.twrYearToDate,
          line: data.wealth.netWorthLine,
          slices: data.wealth.byAssetClass,
          holdings: data.topHoldings,
        };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Family Wealth</h1>
          <p className="mt-1 text-sm text-ink-muted">Your wealth, and that of family members who have shared theirs with you.</p>
        </div>
        <Button onClick={() => setSharing(true)} disabled={!family.data}>
          <Share2 aria-hidden="true" />
          Share my wealth
        </Button>
      </div>

      <Card title="Family tree" action={<span className="text-xs font-medium text-ink-muted">{counted} of {people.length || counted} counted</span>}>
        {family.isError ? (
          <p className="text-sm text-access-none-ink">Your family could not be loaded. Refresh the page to try again.</p>
        ) : !family.data ? (
          <div className="h-40 animate-pulse rounded-xl bg-sidebar" />
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max flex-col items-center">
              <button
                type="button"
                aria-pressed={picked === FAMILY}
                onClick={() => setPicked(FAMILY)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left ${
                  picked === FAMILY ? "border-primary-600 bg-primary-50 ring-1 ring-primary-600" : "border-line bg-white hover:bg-sidebar"
                }`}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-600 text-on-accent">
                  <Users aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{family.data.name ?? "Whole family"}</span>
                  <span className="block text-xs font-semibold text-ink tabular-nums">{data ? compact(data.wealth.netWorth, currency) : "…"}</span>
                </span>
              </button>
              <span aria-hidden="true" className="h-5 w-px bg-line" />
              <ul className={`flex gap-6 pt-5 ${treeOf(people).length > 1 ? "border-t border-line" : ""}`}>
                {treeOf(people).map((branch) => (
                  <Tree
                    key={branch.person.id}
                    branch={branch}
                    render={(person) => (
                      <Node
                        person={person}
                        worth={worthOf.get(person.id)?.netWorth}
                        currency={currency}
                        picked={picked === person.id}
                        onPick={() => setPicked(person.id)}
                      />
                    )}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      {wealth.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">Your family's wealth could not be loaded. Refresh the page to try again.</p>
      ) : !shown || !data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">{shown.name}</h2>
            <div role="radiogroup" aria-label="Period" className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-line">
              {PERIODS.map((one) => (
                <button
                  key={one}
                  type="button"
                  role="radio"
                  aria-checked={period === one}
                  onClick={() => setPeriod(one)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${period === one ? "bg-primary-600 text-on-accent" : "text-ink-muted hover:text-ink"}`}
                >
                  {one}
                </button>
              ))}
            </div>
          </div>

          <div className="grid divide-line rounded-2xl border border-line bg-white sm:grid-cols-3 sm:divide-x xl:grid-cols-5">
            <Figure label="Net worth" value={whole(shown.netWorth, currency)} />
            <Figure label="Managed portfolio" value={shown.managed === null ? "—" : whole(shown.managed, currency)} />
            <Figure label="Owned outside the portfolio" value={whole(shown.owned, currency)} />
            <Figure label="Loans" value={whole(shown.loans, currency)} />
            <Figure label="Return (YTD)" value={<Return value={shown.twr} />} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Net worth" className="lg:col-span-2" action={<span className="text-xs font-medium text-ink-muted">{period} · {currency}</span>}>
              <LineChart
                series={[{ name: "Net worth", colour: "var(--color-primary-600)", points: shown.line, area: true }]}
                format={(value) => whole(value, currency)}
                tick={(value) => compact(value)}
                label={`Net worth of ${shown.name}`}
                empty="Net worth appears here once the portfolio has been valued in this period."
              />
            </Card>
            <Card title="Asset allocation">
              {shown.slices.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">Nothing to allocate yet.</p>
              ) : (
                <AllocationRing slices={shown.slices} currency={currency} />
              )}
            </Card>
          </div>

          <div className={`grid gap-5 ${member ? "" : "lg:grid-cols-2"}`}>
            {!member && (
              <Card title="Members">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                        <th scope="col" className="py-3 pr-4 pl-3">Member</th>
                        <th scope="col" className="px-4 py-3 text-right">Net worth</th>
                        <th scope="col" className="py-3 pr-3 pl-4 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.wealth.members.map((one) => (
                        <tr key={one.customerId} className="hover:bg-sidebar">
                          <td className="px-3 py-2.5">
                            <button type="button" onClick={() => setPicked(one.customerId)} className="font-semibold text-ink hover:underline">
                              {one.name}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-ink tabular-nums">{whole(one.netWorth, currency)}</td>
                          <td className="px-3 py-2.5 text-right text-ink-soft tabular-nums">{one.share.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {counted < people.length && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
                    <Lock aria-hidden="true" className="size-3" />
                    {people.length - counted} {people.length - counted === 1 ? "member has" : "members have"} not shared their wealth with you.
                  </p>
                )}
              </Card>
            )}
            <Card title="Top holdings">
              <Holdings holdings={shown.holdings} currency={currency} />
            </Card>
          </div>
        </>
      )}

      {sharing && <ShareDialog people={people} onClose={() => setSharing(false)} />}
    </div>
  );
}
