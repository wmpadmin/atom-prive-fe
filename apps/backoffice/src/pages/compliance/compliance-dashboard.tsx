import { ApiError } from "@atomprive/api-client";
import {
  useListAmlRatedClients,
  useListClientsForReview,
  useListMine,
  useListOnboardingCases,
  type CasePage,
  type MyDeclarationRow,
  type RatedClientsPage,
  type ReviewQueue,
} from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";

/**
 * A compliance officer's own day.
 *
 * <p>They were shown the relationship manager's dashboard, which is written about clients somebody looks
 * after and advice they wrote — a compliance officer looks after none and writes none. So "Assigned
 * customers" read 0 for ever, the proposal figures counted work they may not answer, and "Waiting on your
 * signature" read "Couldn't be counted" permanently, because signing a client's forms is a permission they
 * do not hold and the count behind it was refused. Three tiles out of six were noise and one of them was a
 * link to a screen that would turn them away.
 *
 * <p>What is here instead is the work that is actually theirs and actually waiting: the KYC decisions, the
 * papers about to lapse, the clients nobody has scored for money-laundering risk, and the declarations they
 * owe the firm themselves. Every figure is a link to the screen it was counted from, and every one of those
 * screens is on their own menu.
 */
export function ComplianceDashboard() {
  const user = useStaffUser();

  const review = useListClientsForReview<ReviewQueue, ApiError>(
    { page: 0, size: 1 },
    { query: { refetchOnWindowFocus: true } },
  );
  // Asked for one row, because only the count is wanted here. The screens behind these tiles are where the
  // rows themselves are read.
  const signing = useListOnboardingCases<CasePage, ApiError>(
    { signOff: "AWAITING", page: 0, size: 1 },
    { query: { refetchOnWindowFocus: true } },
  );
  const risk = useListAmlRatedClients<RatedClientsPage, ApiError>(
    { page: 0, size: 1 },
    { query: { refetchOnWindowFocus: true } },
  );
  const declarations = useListMine<MyDeclarationRow[], ApiError>();
  const owed = (declarations.data ?? []).filter((one) => !one.signed).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Good to see you, {user.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          What compliance has waiting. Every figure is counted across the firm's whole book, and opens the
          screen it came from.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* The two that are somebody waiting on a decision only this reader can give, so they stand out. */}
        <Tile
          label="Awaiting your KYC sign-off"
          value={signing.data?.totalItems}
          failed={signing.isError}
          to="/kyc"
          urgent={(signing.data?.totalItems ?? 0) > 0}
          hint="Every paper in and approved; the signature activates the client"
        />
        <Tile
          label="Ready for your decision"
          value={review.data?.readyForDecision}
          failed={review.isError}
          to="/kyc"
          urgent={(review.data?.readyForDecision ?? 0) > 0}
          hint="Checklists complete, waiting on approve or reject"
        />
        <Tile
          label="KYC in review"
          value={review.data?.pendingReview}
          failed={review.isError}
          to="/kyc"
          hint="Still collecting or checking papers"
        />
        {/* Clients, not papers: the figure counts a client once however many of their papers are
            lapsing, which is what the service that answers it says in its own words. Labelled "Papers",
            a client with four lapsing documents read as one document.

            It also counts only clients whose KYC is still pending, because the queue it is drawn from
            holds nobody else — so an approved client whose passport runs out next week is not in it.
            That is a gap in what the firm is warned about rather than a wrong label, and widening it is
            the firm's call, not a quiet change to a compliance figure. */}
        <Tile
          label="Clients with a paper expiring"
          value={review.data?.expiring}
          failed={review.isError}
          to="/kyc-documents"
          urgent={(review.data?.expiring ?? 0) > 0}
          hint="Awaiting review, with a document lapsing within 30 days"
        />
        <Tile
          label="Never scored for AML"
          value={risk.data?.counts.neverRated}
          failed={risk.isError}
          to="/aml-risk"
          hint="No money-laundering rating on file at all"
        />
        <Tile
          label="AML ratings due again"
          value={risk.data?.counts.overdue}
          failed={risk.isError}
          to="/aml-risk"
          urgent={(risk.data?.counts.overdue ?? 0) > 0}
          hint="Past the date their band obliges"
        />
      </div>

      {/* What they owe the firm themselves, which is the same nine everybody signs. Said as a line rather
          than a tile: it is not the firm's compliance, it is their own, and it belongs underneath. */}
      <section className="rounded-2xl border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Your own declarations</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {declarations.isError
                ? "These couldn't be read just now."
                : owed === 0
                  ? "All signed. Nothing is outstanding."
                  : owed === 1
                    ? "One is outstanding."
                    : `${owed} are outstanding.`}
            </p>
          </div>
          <Link
            to="/my-declarations"
            className="text-sm font-semibold text-primary-700 hover:underline"
          >
            My declarations
          </Link>
        </div>
      </section>

      <p className="text-sm text-ink-muted">
        Everything anybody has done is on the{" "}
        <Link to="/audit-log" className="font-semibold text-primary-700 hover:underline">
          audit log
        </Link>
        , searchable by person, action and date.
      </p>
    </div>
  );
}

/**
 * One figure, and the screen it was counted from.
 *
 * <p>A tile is only drawn where this reader may open what it links to. The one it replaced linked to a
 * screen the reader was refused, so pressing it put them somewhere they had not asked to be — a figure
 * that cannot be acted on is worse than no figure, because it reads as work going unattended.
 */
function Tile({ label, value, failed, to, urgent, hint }: {
  label: string;
  value: number | undefined;
  failed: boolean;
  to: string;
  urgent?: boolean;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "block rounded-2xl border bg-white px-5 py-4 transition-colors hover:border-primary-300",
        urgent ? "border-amber-300" : "border-line",
      )}
    >
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", urgent ? "text-amber-700" : "text-ink")}>
        {failed ? (
          <span className="text-base font-normal text-ink-muted">Couldn't be counted</span>
        ) : value === undefined ? (
          <span className="text-base font-normal text-ink-muted">Counting…</span>
        ) : (
          value
        )}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </Link>
  );
}
