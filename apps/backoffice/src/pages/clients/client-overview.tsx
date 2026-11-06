import { ApiError } from "@atomprive/api-client";
import {
  useGetAmlClientSheet,
  useGetClientAttribution,
  useGetClientKycFile,
  useGetClientOverview,
  useGetClientPortfolio,
  useListClientBankAccounts,
  useListClientChecklist,
  useRiskProfileReview,
  type RiskReview,
  type Attribution,
  type BankAccountRow,
  type ClientChecklist,
  type ClientKycFile,
  type ClientOverview,
  type ClientSheet,
  type CustomerDetail,
  type ExportSheet,
  type OverviewReportRequest,
  getClientOverviewReportUrl,
  type PortfolioStanding,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Badge, Button, StaffAvatar, cn } from "@atomprive/ui";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChartLine,
  Coins,
  Download,
  ExternalLink,
  Info,
  FileText,
  Landmark,
  Network,
  PencilLine,
  Sheet,
  ShieldCheck,
  UserRound,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Children, isValidElement, useState, type ReactNode } from "react";
import { useStaffUser } from "../../auth/session";
import { countryName } from "../../lib/countries";
import { formatDate } from "../../lib/labels";
import { formatMobileNumber } from "../../lib/mobile-numbers";
import { hasAnyAuthority, READS_AML_RISK } from "../../lib/permissions";
import { isoDay, short, signedPercent } from "../book/book-figures";
import { CategoryChart, TimeChart } from "../book/overview-charts";
import { column, downloadWorkbook, row } from "../book/overview-export";
import { saveApiPost } from "../../lib/download";
import { Popover } from "../book/overview-dialogs";
import { reviewStateLabels } from "../kyc/kyc-labels";
import { accountTypeLabels, bankAccountStatus } from "./bank-account-labels";
import { clientTypeLabels, kycStatusLabels, kycStatusTones, oneLine } from "./client-labels";

/** The tabs this overview links on to. */
export type OverviewLink = "family" | "advisors" | "portfolioManagers" | "banks" | "holdings" | "documents" | "activity";

const RANGES = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"] as const;
type Range = (typeof RANGES)[number];

const PROFILES: Record<string, string> = {
  CONSERVATIVE: "Conservative",
  BALANCED: "Balanced",
  AGGRESSIVE: "Aggressive",
  // A client profiled on the earlier questionnaire keeps the word they signed until they are profiled again.
  MODERATE: "Moderate (earlier questionnaire)",
  BALANCE: "Balance (earlier questionnaire)",
  GROWTH: "Growth (earlier questionnaire)",
};

/** A whole figure with the currency in front, the way the tiles across the top read: AUD 12,450,000. */
function whole(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function startOf(range: Range, today: Date) {
  const from = new Date(today);
  if (range === "YTD") return isoDay(new Date(today.getFullYear(), 0, 1));
  const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 }[range];
  from.setMonth(from.getMonth() - months);
  return isoDay(from);
}

/** Years and months since a day: 7 years 11 months. */
function since(day: string, today: Date) {
  const start = new Date(day);
  let months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years > 0 && `${years} year${years === 1 ? "" : "s"}`, `${rest} month${rest === 1 ? "" : "s"}`].filter(Boolean);
  return parts.join(" ");
}

function ageOn(birth: string, today: Date) {
  const born = new Date(birth);
  let age = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age -= 1;
  return age;
}

/**
 * Everything the overview reads about a client, in one place: the tab draws it and Generate report writes it down,
 * so the file says what the screen says.
 */
function useOverviewFacts(detail: CustomerDetail) {
  const { client, family, application } = detail;
  const user = useStaffUser();
  const today = new Date();
  const todayIso = isoDay(today);
  const yearStart = isoDay(new Date(today.getFullYear(), 0, 1));
  const quiet = { query: { retry: false } };

  const year = useGetClientOverview<ClientOverview, ApiError>(client.id, { from: yearStart, to: todayIso }, quiet);
  const attribution = useGetClientAttribution<Attribution, ApiError>(client.id, { from: yearStart }, quiet);
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(client.id, quiet);
  const readsAml = hasAnyAuthority(user, ...READS_AML_RISK);
  const aml = useGetAmlClientSheet<ClientSheet, ApiError>(client.id, { query: { retry: false, enabled: readsAml } });
  const kyc = useGetClientKycFile<ClientKycFile, ApiError>(client.id, quiet);
  const forms = useListClientChecklist<ClientChecklist, ApiError>(client.id, quiet);
  const banks = useListClientBankAccounts<BankAccountRow[], ApiError>(client.id, quiet);
  const review = useRiskProfileReview<RiskReview, ApiError>(client.id, quiet);

  const overview = year.data;
  const ccy = overview?.currency ?? standing.data?.currency ?? "";
  const gained = attribution.data ? attribution.data.change - attribution.data.paidIn + attribution.data.takenOut : null;
  const gainedShare =
    attribution.data && gained !== null && attribution.data.opening > 0 ? (gained / attribution.data.opening) * 100 : null;
  const holder = application?.holders?.find((one) => one.fullName === client.fullName) ?? application?.holders?.[0] ?? null;
  const me = family.find((one) => one.id === client.id);
  const linked = new Set([...family.map((one) => one.id), ...client.heldWith.map((one) => one.id)]);
  linked.delete(client.id);
  const amlStanding = aml.data?.standing ?? null;
  const riskProfile = standing.data?.riskMatch?.clientProfile ?? null;
  const documents = [
    ...(kyc.data?.documents ?? []).map((one) => ({
      id: one.id,
      name: one.kindTitle,
      category: "KYC",
      on: one.uploadedAt,
      state: reviewStateLabels[one.reviewState],
    })),
    ...(forms.data?.forms ?? []).map((one) => ({
      id: `${one.kind}-${one.title}`,
      name: one.title,
      category: "Form",
      on: one.submittedAt ?? one.requestedOn,
      state: null,
    })),
  ].sort((a, b) => (b.on ?? "").localeCompare(a.on ?? ""));
  const accounts = banks.data ?? [];
  return {
    today, year, overview, ccy, attribution, gained, gainedShare, holder, me, linked, amlStanding, readsAml, riskProfile,
    documents, accounts, kyc, forms, banks, application, riskReview: review.data ?? null,
  };
}

/** Where the onboarding stands, in the words its badge uses. */
function onboardingWords(onboarding: CustomerDetail["onboarding"]): { label: string; tone: "success" | "info" | "warning" | "neutral" } {
  if (onboarding === null || onboarding.signOff === "APPROVED") return { label: "Completed", tone: "success" };
  if (onboarding.signOff === "AWAITING") return { label: "With Compliance", tone: "info" };
  if (onboarding.signOff === "RETURNED") return { label: "Sent back", tone: "warning" };
  return { label: onboarding.submitted ? onboarding.currentStage : "Draft", tone: "neutral" };
}

const STATUS_WORDS: Record<string, string> = { ACTIVE: "Active", DEACTIVATED: "Deactivated", ARCHIVED: "Archived" };

/** What kind of holder this client is in their family. */
function accessWords(me: CustomerDetail["family"][number] | undefined) {
  return me?.primaryHolder ? "Primary holder" : me?.accountHolder ? "Joint holder" : me ? "Family member" : "Primary holder";
}

/**
 * The client at a glance: what they are worth and how it is doing across the top, who they are and how their money
 * is spread under it, then the people, the compliance record and the family, and last what is linked, what has
 * happened and what is on file.
 */
export function ClientOverviewTab({
  detail,
  canEdit,
  onEdit,
  onOpen,
  extra,
  arranging,
  onDoneArranging,
}: {
  detail: CustomerDetail;
  canEdit: boolean;
  onEdit: () => void;
  onOpen: (tab: OverviewLink) => void;
  /** Panels the page adds under the overview's own, each a card on the same board. */
  extra: { id: string; node: ReactNode }[];
  /** Whether the cards are being moved and resized, which is started from the Edit client menu. */
  arranging: boolean;
  onDoneArranging: () => void;
}) {
  const { client, advisors, portfolioManagers, family, familyGroup, activity, onboarding } = detail;
  const facts = useOverviewFacts(detail);
  const { today, year, overview, ccy, attribution, gained, gainedShare, holder, me, linked, amlStanding, readsAml, riskProfile } = facts;
  const riskReview = facts.riskReview;
  const { documents, accounts, kyc, forms, banks, application } = facts;
  const [range, setRange] = useState<Range>("YTD");
  const ranged = useGetClientOverview<ClientOverview, ApiError>(
    client.id,
    { from: startOf(range, today), to: isoDay(today) },
    { query: { retry: false } },
  );

  return (
    <OverviewBoard extra={extra} arranging={arranging} onDone={onDoneArranging}>
      {/* What they are worth and how it is going, read before anything else. */}
      <Cell id="kpis">
        <div className="grid h-full grid-cols-2 content-start gap-4 overflow-y-auto md:grid-cols-3 xl:grid-cols-6">
          <Kpi
            icon={UserRound}
            label="Total portfolio value"
            value={overview ? whole(ccy, overview.marketValue) : null}
            note={attribution.data?.changeShare != null ? <Change value={attribution.data.changeShare} after="YTD" /> : undefined}
          />
          <Kpi
            icon={BarChart3}
            label="Total return"
            value={overview?.twrYearToDate != null ? `${overview.twrYearToDate.toFixed(1)}%` : null}
            note={<span className="text-ink-muted">YTD</span>}
          />
          <Kpi icon={Coins} label="Income (YTD)" value={null} missing="Not tracked yet" />
          <Kpi
            icon={ChartLine}
            label="Gain / loss (YTD)"
            value={gained !== null ? whole(ccy, gained) : null}
            note={gainedShare !== null ? <Change value={gainedShare} /> : undefined}
          />
          <Kpi icon={Landmark} label="No. of accounts" value={String(client.linkedAccounts)} />
          <Kpi
            icon={CalendarDays}
            label="Relationship since"
            value={formatDate(client.registeredAt)}
            note={<span className="text-ink-muted">({since(client.registeredAt, today)})</span>}
          />
        </div>
      </Cell>

      <Card
        id="profile"
        title="Client profile"
        action={
          canEdit ? (
            <IconButton label="Edit the profile" onClick={onEdit}>
              <PencilLine />
            </IconButton>
          ) : undefined
        }
      >
        <dl className="divide-y divide-line text-sm">
          <Fact label="Full name">{client.fullName}</Fact>
          <Fact label="Client code">
            <span className="font-mono text-xs">{client.code}</span>
          </Fact>
          <Fact label="Client type">{clientTypeLabels[client.type]}</Fact>
          <Fact label="Date of birth">
            {holder?.dateOfBirth ? `${formatDate(holder.dateOfBirth)} (${ageOn(holder.dateOfBirth, today)} years)` : null}
          </Fact>
          <Fact label="Nationality">{holder?.nationality ? countryName(holder.nationality) : null}</Fact>
          <Fact label="Tax residency">{application?.entity?.taxResidency ? countryName(application.entity.taxResidency) : null}</Fact>
          <Fact label="Email">{client.email}</Fact>
          <Fact label="Mobile">{formatMobileNumber(client.phone)}</Fact>
          <Fact label="Address">{oneLine(client.address)}</Fact>
        </dl>
      </Card>

      <Card
        id="allocation"
        title={
          <span className="flex items-center gap-1.5">
            Asset allocation
            <span title="Today's value of each asset class in the managed portfolio" className="text-ink-muted">
              <Info aria-hidden="true" className="size-4" />
            </span>
          </span>
        }
        action={
          <IconButton label="Open the holdings" onClick={() => onOpen("holdings")}>
            <ExternalLink />
          </IconButton>
        }
      >
        {overview && overview.byAssetClass.length > 0 ? (
          <div className="@container flex flex-1 items-center">
            <div className="w-full">
              <CategoryChart
                ring={{ size: 150, centre: `${ccy} ${short(overview.marketValue)}`, amount: (value) => `${ccy} ${short(value)}` }}
                rows={overview.byAssetClass.map((one) => ({
                  key: one.key,
                  label: one.name,
                  value: one.value,
                }))}
                type="PIE"
                format={(value) => whole(ccy, value)}
                classes={[]}
                label="Asset allocation"
              />
            </div>
          </div>
        ) : (
          <Empty>{year.isPending ? "Reading the portfolio…" : "No holdings on file yet."}</Empty>
        )}
      </Card>

      <Card id="performance" title="Portfolio performance">
        <div role="radiogroup" aria-label="Period" className="mb-3 flex flex-wrap gap-1.5">
          {RANGES.map((one) => (
            <button
              key={one}
              type="button"
              role="radio"
              aria-checked={range === one}
              onClick={() => setRange(one)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-semibold",
                range === one ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              {one}
            </button>
          ))}
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_max-content]">
          <div className="h-44 min-w-0">
            {ranged.data && ranged.data.performance.length > 1 ? (
              <TimeChart
                key={range}
                points={ranged.data.performance}
                label="Portfolio return"
                axisTitle="TWR %"
                format={signedPercent}
                axisFormat={(value) => `${value.toFixed(0)}%`}
              />
            ) : (
              <Empty>{ranged.isPending ? "Reading the returns…" : "Not enough history for this period."}</Empty>
            )}
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-3 self-start rounded-xl border border-line px-3.5 py-3 text-sm whitespace-nowrap xl:flex-col">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-primary-600" />
                Portfolio return
              </dt>
              <dd className="font-semibold tabular-nums">
                {ranged.data && ranged.data.performance.length > 0 ? signedPercent(ranged.data.performance.at(-1)?.value ?? 0) : "0.00%"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 text-ink-muted">
              <dt className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-slate-300" />
                Benchmark
              </dt>
              <dd>Not set</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card id="relations" title="Key relationships">
        <ul className="divide-y divide-line text-sm">
          <Relation
            icon={UserRoundCog}
            label="Relationship manager"
            people={advisors.map((one) => one.advisor)}
            onOpen={() => onOpen("advisors")}
          />
          <Relation
            icon={UserRound}
            label="Portfolio manager"
            people={portfolioManagers.map((one) => one.manager)}
            onOpen={() => onOpen("portfolioManagers")}
          />
          <Relation icon={Users} label="Operations" people={[]} empty="Operations team" />
        </ul>
      </Card>

      <Card id="compliance" title="Onboarding & compliance">
        <ul className="divide-y divide-line text-sm">
          <Row icon={ShieldCheck} label="Onboarding status">
            <Badge tone={onboardingWords(onboarding).tone}>{onboardingWords(onboarding).label}</Badge>
          </Row>
          <Row icon={ShieldCheck} label="KYC status">
            <Badge tone={kycStatusTones[client.kycStatus]}>{kycStatusLabels[client.kycStatus]}</Badge>
          </Row>
          <Row icon={ShieldCheck} label="AML status">
            {amlStanding ? (
              <Badge tone={amlStanding.dueDiligence === "ENHANCED" ? "warning" : "success"}>{amlStanding.bandName}</Badge>
            ) : (
              <Missing>{readsAml ? "Not rated" : "Not shown to you"}</Missing>
            )}
          </Row>
          <Row icon={ShieldCheck} label="Risk profile">
            {riskProfile ? <Badge tone="info">{PROFILES[riskProfile] ?? riskProfile}</Badge> : <Missing>Not set</Missing>}
          </Row>
          <Row icon={CalendarDays} label="Risk profile review">
            {riskReview?.nextReviewOn ? (
              <span className={cn("font-semibold", riskReview.standing === "OVERDUE" ? "text-danger" : riskReview.standing === "DUE_SOON" && "text-amber-700")}>
                {formatDate(riskReview.nextReviewOn)}
                {riskReview.standing === "OVERDUE" ? " · overdue" : riskReview.standing === "DUE_SOON" ? " · due soon" : ""}
              </span>
            ) : (
              <Missing>Not profiled</Missing>
            )}
          </Row>
          <Row icon={CalendarDays} label="AML review date">
            {amlStanding ? (
              <span className={cn("font-semibold", amlStanding.overdue && "text-danger")}>{formatDate(amlStanding.nextReviewOn)}</span>
            ) : (
              <Missing>Not set</Missing>
            )}
          </Row>
        </ul>
      </Card>

      <Card
        id="family"
        title="Family & access"
        action={
          <IconButton label="Open the family group" onClick={() => onOpen("family")}>
            <ExternalLink />
          </IconButton>
        }
      >
        <ul className="divide-y divide-line text-sm">
          <Row icon={Users} label="Family group">
            {familyGroup ? <span className="font-semibold">{familyGroup.name}</span> : <Missing>None</Missing>}
          </Row>
          <Row icon={Users} label="Family members">
            <span className="font-semibold">{familyGroup?.members ?? family.length}</span>
          </Row>
          <Row icon={UserRound} label="Access type">
            <span className="font-semibold">
              {accessWords(me)}
            </span>
          </Row>
          <Row icon={Network} label="Linked clients">
            <span className="font-semibold">{linked.size}</span>
          </Row>
        </ul>
      </Card>

      <Card id="banks" title={`Bank accounts (${accounts.length})`} action={<ViewAll onClick={() => onOpen("banks")} />}>
        {accounts.length === 0 ? (
          <Empty>{banks.isPending ? "Reading the accounts…" : "No bank account linked yet."}</Empty>
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col />
              <col className="w-[5.5rem]" />
              <col className="w-12" />
              <col className="w-[5.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2">
                  Account
                </th>
                <th scope="col" className="px-2 py-2">
                  No.
                </th>
                <th scope="col" className="px-2 py-2">
                  Ccy
                </th>
                <th scope="col" className="py-2 pl-2">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {accounts.slice(0, 4).map((one) => {
                const status = bankAccountStatus(one.status);
                return (
                  <tr key={one.id}>
                    <td className="truncate py-2.5 pr-2" title={one.bankName}>
                      {one.nickname ?? `${one.bankName} ${accountTypeLabels[one.accountType]}`}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap tabular-nums">•••• {one.lastFour}</td>
                    <td className="px-2 py-2.5">{one.currency}</td>
                    <td className="py-2.5 pl-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card id="activity" title="Recent activity" action={<ViewAll onClick={() => onOpen("activity")} />}>
        {activity.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line">
            {activity.slice(0, 4).map((event, index) => (
              <li key={`${event.occurredAt}-${index}`} className="relative flex gap-3 pl-6">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-white bg-primary-600 ring-1 ring-primary-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{event.description}</p>
                  {event.byWhom && <p className="truncate text-xs text-ink-muted">{event.byWhom}</p>}
                </div>
                <p className="text-xs whitespace-nowrap text-ink-muted tabular-nums">{formatDate(event.occurredAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card id="documents" title="Important documents" action={<ViewAll onClick={() => onOpen("documents")} />}>
        {documents.length === 0 ? (
          <Empty>{kyc.isPending || forms.isPending ? "Reading the file…" : "Nothing on file yet."}</Empty>
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col />
              <col className="w-14" />
              <col className="w-[6.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2">
                  Document
                </th>
                <th scope="col" className="px-2 py-2">
                  Type
                </th>
                <th scope="col" className="py-2 pl-2 text-right">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {documents.slice(0, 4).map((one) => (
                <tr key={one.id}>
                  <td className="py-2.5 pr-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md bg-red-50 text-red-600">
                        <FileText className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{one.name}</span>
                        {one.state && <span className="block text-xs text-ink-muted">{one.state}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5">{one.category}</td>
                  <td className="py-2.5 pl-2 text-right whitespace-nowrap tabular-nums">{one.on ? formatDate(one.on) : "Not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </OverviewBoard>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
  missing = "Not on file",
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  note?: ReactNode;
  missing?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-ink-muted" title={label}>{label}</p>
        {value === null ? (
          <p className="mt-0.5 text-sm text-ink-muted/80">{missing}</p>
        ) : (
          <p className="text-base leading-snug font-bold whitespace-nowrap tabular-nums xl:text-lg 2xl:text-xl">{value}</p>
        )}
        {note && value !== null && <p className="text-xs font-semibold">{note}</p>}
      </div>
    </div>
  );
}

function Change({ value, after }: { value: number; after?: string }) {
  return (
    <span className={value < 0 ? "text-danger" : "text-emerald-700"}>
      {value < 0 ? "▼" : "▲"} {signedPercent(value).replace(/0$/, "")}
      {after ? ` ${after}` : ""}
    </span>
  );
}

/** One card on the board: a heading that is also the handle it is dragged by, and a body that scrolls if it is made small. */
function Card({ title, action, children }: { id: string; title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white px-5 py-4">
      <div className="panel-grip mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg border border-line text-primary-700 hover:bg-primary-50 [&>svg]:size-4"
    >
      {children}
    </button>
  );
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-semibold text-primary-700 hover:underline">
      View all
    </button>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-1">
      <dt className="text-[0.8125rem] text-ink-muted">{label}</dt>
      <dd className="text-[0.8125rem] break-words text-ink">{children ?? <span className="text-ink-muted/80">Not on file</span>}</dd>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary-700" />
      <span className="flex-1">{label}</span>
      {children}
    </li>
  );
}

function Relation({
  icon: Icon,
  label,
  people,
  onOpen,
  empty = "Nobody yet",
}: {
  icon: LucideIcon;
  label: string;
  people: StaffMember[];
  onOpen?: () => void;
  empty?: string;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary-700" />
      <span className="flex-1">{label}</span>
      <span className="flex min-w-0 flex-wrap justify-end gap-x-2 gap-y-1">
        {people.length === 0 ? (
          <span className="text-ink-muted">{empty}</span>
        ) : (
          people.map((one) => (
            <span key={one.id} className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
              <StaffAvatar name={one.fullName} photo={one.photo} className="size-5 text-3xs" />
              {one.fullName}
            </span>
          ))
        )}
      </span>
      {onOpen && (
        <button
          type="button"
          aria-label={`Open ${label.toLowerCase()}s`}
          onClick={onOpen}
          className="text-primary-700 hover:text-primary-800"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
        </button>
      )}
    </li>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="grid h-full min-h-24 place-items-center text-center text-sm text-ink-muted">{children}</p>;
}

/**
 * The client's overview as an Excel workbook, made and downloaded in one press: the figures across the top, who the
 * client is, how their money is spread and how it has done this year, the people and the compliance record, the
 * family, the bank accounts, what has happened and what is on file — read from what the overview itself reads.
 */
export function GenerateReport({ detail }: { detail: CustomerDetail }) {
  const facts = useOverviewFacts(detail);
  const [busy, setBusy] = useState<"PDF" | "EXCEL" | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client, advisors, portfolioManagers, family, familyGroup, activity, onboarding } = detail;
  const { today, overview, ccy, attribution, gained, gainedShare, holder, me, linked, amlStanding, riskProfile, documents, accounts, application } = facts;

  const make = async (as: "PDF" | "EXCEL") => {
    setBusy(as);
    setOpen(false);
    setError(null);
    try {
      const pairs = (rows: [string, string | null | undefined][]) => ({
        columns: [column("Item"), column("Value")],
        rows: rows.map(([label, value]) => row([label, value ?? "Not on file"])),
      });
      const sheets: ExportSheet[] = [
        {
          name: "Summary",
          columns: [column("Figure"), column(ccy ? `Value (${ccy})` : "Value", "MONEY"), column("Change %", "PERCENT"), column("Note")],
          rows: [
            row(["Total portfolio value", overview?.marketValue ?? null, attribution.data?.changeShare ?? null, "Change this year"]),
            row(["Total return (TWR, YTD)", null, overview?.twrYearToDate ?? null, ""]),
            row(["Income (YTD)", null, null, "Not tracked yet"]),
            row(["Gain / loss (YTD)", gained, gainedShare, "Money paid in and taken out left out"]),
            row(["No. of accounts", null, null, String(client.linkedAccounts)]),
            row(["Relationship since", null, null, formatDate(client.registeredAt)]),
          ],
        },
        {
          name: "Client profile",
          ...pairs([
            ["Full name", client.fullName],
            ["Client code", client.code],
            ["Client type", clientTypeLabels[client.type]],
            ["Date of birth", holder?.dateOfBirth ? formatDate(holder.dateOfBirth) : null],
            ["Nationality", holder?.nationality ? countryName(holder.nationality) : null],
            ["Tax residency", application?.entity?.taxResidency ? countryName(application.entity.taxResidency) : null],
            ["Email", client.email],
            ["Mobile", formatMobileNumber(client.phone)],
            ["Address", oneLine(client.address)],
          ]),
        },
        {
          name: "Asset allocation",
          columns: [column("Asset class"), column("Share %", "PERCENT"), column(`Value (${ccy})`, "MONEY")],
          rows: (overview?.byAssetClass ?? []).map((one) => row([one.name, one.share, one.value])),
        },
        {
          name: "Performance (YTD)",
          columns: [column("Date"), column("TWR %", "PERCENT")],
          rows: (overview?.performance ?? []).map((one) => row([formatDate(one.on), one.value])),
        },
        {
          name: "Key relationships",
          ...pairs([
            ["Relationship manager", advisors.map((one) => one.advisor.fullName).join(", ") || "Nobody yet"],
            ["Portfolio manager", portfolioManagers.map((one) => one.manager.fullName).join(", ") || "Nobody yet"],
            ["Operations", "Operations team"],
          ]),
        },
        {
          name: "Onboarding & compliance",
          ...pairs([
            ["Onboarding status", onboardingWords(onboarding).label],
            ["KYC status", kycStatusLabels[client.kycStatus]],
            ["AML status", amlStanding?.bandName ?? "Not rated"],
            ["Risk profile", riskProfile ? (PROFILES[riskProfile] ?? riskProfile) : "Not set"],
            ["Risk profile review", facts.riskReview?.nextReviewOn ? formatDate(facts.riskReview.nextReviewOn) : "Not profiled"],
            ["AML review date", amlStanding ? formatDate(amlStanding.nextReviewOn) : "Not set"],
          ]),
        },
        {
          name: "Family & access",
          ...pairs([
            ["Family group", familyGroup?.name ?? "None"],
            ["Family members", String(familyGroup?.members ?? family.length)],
            ["Access type", accessWords(me)],
            ["Linked clients", String(linked.size)],
          ]),
        },
        {
          name: "Bank accounts",
          columns: [column("Account name"), column("Bank"), column("Account no."), column("Currency"), column("Status")],
          rows: accounts.map((one) => row([
            one.nickname ?? accountTypeLabels[one.accountType], one.bankName, `•••• ${one.lastFour}`, one.currency, bankAccountStatus(one.status).label,
          ])),
        },
        {
          name: "Recent activity",
          columns: [column("Date"), column("What happened"), column("By")],
          rows: activity.slice(0, 50).map((one) => row([formatDate(one.occurredAt), one.description, one.byWhom])),
        },
        {
          name: "Important documents",
          columns: [column("Document"), column("Category"), column("Last updated"), column("Status")],
          rows: documents.map((one) => row([one.name, one.category, one.on ? formatDate(one.on) : "Not yet", one.state])),
        },
      ];
      const about = [
        `${client.code} · ${clientTypeLabels[client.type]}`,
        `Figures in ${ccy || "the client's currency"}, as on ${formatDate(isoDay(today))}`,
      ];
      if (as === "EXCEL") {
        await downloadWorkbook(client.id, client.fullName, "Overview", about, sheets);
      } else {
        const change = (value: number | null | undefined) => (value == null || value === 0 ? null : value > 0 ? "UP" as const : "DOWN" as const);
        const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
        const pair = (label: string, value: string | null | undefined, tone: "PLAIN" | "GOOD" | "PENDING" | "MUTED" = "PLAIN") => ({ label, value: value ?? null, tone });
        const toneOf = (tone: string) => (tone === "success" ? "GOOD" as const : tone === "warning" || tone === "info" ? "PENDING" as const : "PLAIN" as const);
        const empty = { pairs: [], bars: [], columns: [], rows: [], alignRight: [] };
        const report: OverviewReportRequest = {
          status: STATUS_WORDS[client.status] ?? client.status,
          subtitle: [client.code, clientTypeLabels[client.type], client.email].filter(Boolean).join(" · "),
          asOf: `As on ${formatDate(isoDay(today))} · Figures in ${ccy || "the client's currency"}`,
          figures: [
            { label: "Total portfolio value", value: overview ? whole(ccy, overview.marketValue) : null,
              note: attribution.data?.changeShare != null ? `${signed(attribution.data.changeShare)} YTD` : null, change: change(attribution.data?.changeShare) },
            { label: "Total return", value: overview?.twrYearToDate != null ? `${overview.twrYearToDate.toFixed(2)}%` : null, note: "Time-weighted, YTD", change: null },
            { label: "Income (YTD)", value: null, note: null, change: null },
            { label: "Gain / loss (YTD)", value: gained !== null ? whole(ccy, gained) : null,
              note: gainedShare !== null ? signed(gainedShare) : null, change: change(gainedShare) },
            { label: "No. of accounts", value: String(client.linkedAccounts), note: "Linked bank accounts", change: null },
            { label: "Relationship since", value: formatDate(client.registeredAt), note: since(client.registeredAt, today), change: null },
          ],
          panels: [
            { ...empty, title: "Client profile", place: "LEFT", pairs: [
              pair("Full name", client.fullName), pair("Client code", client.code), pair("Client type", clientTypeLabels[client.type]),
              pair("Date of birth", holder?.dateOfBirth ? `${formatDate(holder.dateOfBirth)} (${ageOn(holder.dateOfBirth, today)} years)` : null),
              pair("Nationality", holder?.nationality ? countryName(holder.nationality) : null),
              pair("Tax residency", application?.entity?.taxResidency ? countryName(application.entity.taxResidency) : null),
              pair("Email", client.email), pair("Mobile", formatMobileNumber(client.phone)), pair("Address", oneLine(client.address)),
            ] },
            { ...empty, title: "Asset allocation", place: "MIDDLE",
              bars: (overview?.byAssetClass ?? []).map((one) => ({ label: one.name, share: one.share, amount: `${ccy} ${short(one.value)}` })) },
            { ...empty, title: "Key relationships", place: "MIDDLE", pairs: [
              pair("Relationship mgr", advisors.map((one) => one.advisor.fullName).join(", ") || "Nobody yet"),
              pair("Portfolio mgr", portfolioManagers.map((one) => one.manager.fullName).join(", ") || "Nobody yet"),
              pair("Operations", "Operations team"),
            ] },
            { ...empty, title: "Onboarding & compliance", place: "RIGHT", pairs: [
              pair("Onboarding", onboardingWords(onboarding).label, toneOf(onboardingWords(onboarding).tone)),
              pair("KYC", kycStatusLabels[client.kycStatus], toneOf(kycStatusTones[client.kycStatus])),
              pair("AML", amlStanding?.bandName ?? null, amlStanding ? "GOOD" : "MUTED"),
              pair("Risk profile", riskProfile ? (PROFILES[riskProfile] ?? riskProfile) : null),
              pair("Profile review", facts.riskReview?.nextReviewOn ? formatDate(facts.riskReview.nextReviewOn) : null,
                facts.riskReview?.standing === "OVERDUE" || facts.riskReview?.standing === "DUE_SOON" ? "PENDING" : "PLAIN"),
              pair("AML review", amlStanding ? formatDate(amlStanding.nextReviewOn) : null),
            ] },
            { ...empty, title: "Family & access", place: "RIGHT", pairs: [
              pair("Family group", familyGroup?.name ?? "None"), pair("Members", String(familyGroup?.members ?? family.length)),
              pair("Access type", accessWords(me)), pair("Linked clients", String(linked.size)),
            ] },
            { ...empty, title: "Bank accounts", place: "BOTTOM", columns: ["Account", "No.", "Ccy", "Status"],
              rows: accounts.map((one) => [`${one.nickname ?? accountTypeLabels[one.accountType]} · ${one.bankName}`, `•••• ${one.lastFour}`, one.currency, bankAccountStatus(one.status).label]) },
            { ...empty, title: "Recent activity", place: "BOTTOM", columns: ["Date", "What happened", "By"],
              rows: activity.slice(0, 6).map((one) => [formatDate(one.occurredAt), one.description, one.byWhom ?? ""]) },
            { ...empty, title: "Important documents", place: "BOTTOM", columns: ["Document", "Type", "Updated"], alignRight: [2],
              rows: documents.slice(0, 40).map((one) => [one.name, one.category, one.on ? formatDate(one.on) : "Not yet"]) },
          ],
        };
        const day = isoDay(today);
        await saveApiPost(getClientOverviewReportUrl(client.id), report, `${client.fullName} — Overview — ${day}.pdf`.replace(/[\\/:*?"<>|]/g, " "));
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The report could not be made. Try again.");
    } finally {
      setBusy(null);
    }
  };
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas [&>svg]:size-4 [&>svg]:text-ink-muted";

  return (
    <div className="relative flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" aria-expanded={open} disabled={busy !== null || facts.year.isPending} onClick={() => setOpen((was) => !was)}>
        <Download aria-hidden="true" />
        {busy ? "Making the report…" : "Generate report"}
        <ChevronDown aria-hidden="true" />
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} className="top-11 right-0 w-52 p-1.5">
        <button type="button" className={item} onClick={() => void make("PDF")}>
          <FileText aria-hidden="true" />
          PDF
        </button>
        <button type="button" className={item} onClick={() => void make("EXCEL")}>
          <Sheet aria-hidden="true" />
          Excel
        </button>
      </Popover>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** A part of the board that is not a Card: placed and moved the same way. */
function Cell({ children }: { id: string; children: ReactNode }) {
  return <>{children}</>;
}

/** The places on the overview, row by row: the reference layout, then the firm's own panels. */
const ROWS: { ids: string[]; className: string; boxed?: string }[] = [
  { ids: ["kpis"], className: "grid grid-cols-1" },
  { ids: ["profile", "allocation", "access"], className: "grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12" },
  { ids: ["relations", "compliance", "family"], className: "grid grid-cols-1 gap-4 lg:grid-cols-3" },
  { ids: ["banks", "activity", "documents"], className: "grid grid-cols-1 gap-4 lg:grid-cols-3" },
  { ids: ["performance", "proposals"], className: "grid grid-cols-1 items-start gap-4 sm:grid-cols-2", boxed: "h-[20rem]" },
  { ids: ["portfolio"], className: "grid grid-cols-1" },
  { ids: ["application"], className: "grid grid-cols-1" },
];

/** The width a place takes in its row; it belongs to the place, so a card moved there takes it. */
const SPANS: Record<string, string> = {
  profile: "xl:col-span-4",
  allocation: "xl:col-span-4",
  access: "lg:col-span-2 xl:col-span-4",
};

/** Kept in this browser for this person: which card sits in which place, the same on every client. */
function whereKept(userId: string) {
  return `atomprive.client-overview.v2.${userId}`;
}

function readKept(userId: string): Record<string, string> | null {
  try {
    const raw = window.localStorage.getItem(whereKept(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return Object.fromEntries(Object.entries(parsed).filter((pair): pair is [string, string] => typeof pair[1] === "string"));
  } catch {
    return null;
  }
}

function keep(userId: string, placed: Record<string, string> | null) {
  try {
    if (placed) window.localStorage.setItem(whereKept(userId), JSON.stringify(placed));
    else window.localStorage.removeItem(whereKept(userId));
  } catch {
    // Nowhere to keep it: the arrangement lasts until the page is left.
  }
}

/**
 * The overview's cards in their places. Arranging lets a card be dragged onto another, and the two change places;
 * each place keeps its own size, so the page keeps its shape whatever is moved. What was made of it is kept for that
 * person and used on every client.
 */
function OverviewBoard({ children, extra, arranging, onDone }: {
  children: ReactNode;
  extra: { id: string; node: ReactNode }[];
  arranging: boolean;
  onDone: () => void;
}) {
  const user = useStaffUser();
  const [kept, setKept] = useState<Record<string, string> | null>(() => readKept(user.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const pieces = new Map<string, ReactNode>([
    ...Children.toArray(children)
      .filter(isValidElement)
      .map((child): [string, ReactNode] => [(child.props as { id: string }).id, child]),
    ...extra.map((one): [string, ReactNode] => [one.id, one.node]),
  ]);
  // Each place that is on this page, and the card standing in it: the one kept there if it is still on the page and
  // not already placed, otherwise the place's own.
  const places = ROWS.flatMap((one) => one.ids).filter((id) => pieces.has(id));
  const placed: Record<string, string> = {};
  const used = new Set<string>();
  for (const place of places) {
    const wanted = kept?.[place];
    if (wanted && pieces.has(wanted) && !used.has(wanted)) {
      placed[place] = wanted;
      used.add(wanted);
    }
  }
  const left = places.filter((id) => !used.has(id));
  for (const place of places) {
    if (!placed[place]) placed[place] = left.shift() ?? place;
  }

  const swap = (from: string, to: string) => {
    const a = Object.keys(placed).find((place) => placed[place] === from);
    const b = Object.keys(placed).find((place) => placed[place] === to);
    if (!a || !b || a === b) return;
    const next = { ...placed, [a]: to, [b]: from };
    setKept(next);
    keep(user.id, next);
  };

  return (
    <div className="min-w-0 space-y-3">
      {arranging && (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-2.5">
          <p className="mr-auto text-sm text-primary-800">
            Drag a card onto another and the two change places. It is kept for you on every client.
          </p>
          <Button variant="secondary" size="sm" disabled={!kept} onClick={() => { setKept(null); keep(user.id, null); }}>
            Reset layout
          </Button>
          <Button size="sm" onClick={onDone}>Done</Button>
        </div>
      )}
      <div className="space-y-4">
        {ROWS.map((row, at) => {
          const here = row.ids.filter((id) => pieces.has(id));
          if (here.length === 0) return null;
          return (
            <div key={at} className={row.className}>
              {here.map((place) => {
                const card = placed[place];
                return (
                  <div
                    key={place}
                    draggable={arranging}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", card);
                      setDragging(card);
                    }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    onDragOver={(event) => {
                      if (!arranging || !dragging) return;
                      event.preventDefault();
                      if (over !== card) setOver(card);
                    }}
                    onDragLeave={() => setOver((was) => (was === card ? null : was))}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragging) swap(dragging, card);
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      "min-w-0 rounded-2xl",
                      SPANS[place],
                      row.boxed,
                      arranging && "cursor-move [&_*]:cursor-move",
                      arranging && "outline-2 outline-offset-2 outline-dashed outline-primary-200",
                      dragging === card && "opacity-40",
                      over === card && dragging !== card && "outline-primary-600",
                    )}
                  >
                    {pieces.get(card)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
