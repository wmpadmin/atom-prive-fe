import { ApiError } from "@atomprive/api-client";
import { useListDrift, type DriftPage } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router";
import { ListPageHeader, RecordList } from "../../components/record-list";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress } from "../../lib/use-list-address";
import {
  driftLabel,
  driftTones,
  standingLabels,
  standingTones,
  underManagementLabel,
  type DriftStanding,
} from "./portfolio-labels";

/** The one standing worth queueing: a portfolio where the model wants it is not a thing to do. */
const WANDERED: DriftStanding[] = ["BREACHED"];

/**
 * The queue a portfolio manager works down: every client whose portfolio has wandered from its model, the
 * worst breach first.
 *
 * <p>A breach is not a warning — it is past what the model allows, and the portfolio has to be put back. The
 * count of them is of the whole book, so narrowing the list to one standing never hides how many there are.
 */
export function DriftBreachesPage() {
  const navigate = useNavigate();
  // The queue as it is being read, so Back from a portfolio comes to the same page of the same filter.
  const asLeft = encodeURIComponent(useLocation().search);
  const { params, update } = useListAddress();

  const page = Number(params.get("page")) || 0;
  const size = Number(params.get("size")) || PAGE_SIZES[0]!;


  const queue = useListDrift<DriftPage, ApiError>(
    { standing: WANDERED, page, size },
    { query: { placeholderData: keepPreviousData } },
  );

  if (queue.isError) {
    return <Alert tone="danger">{queue.error.message}</Alert>;
  }
  const rows = queue.data?.items ?? [];
  const breached = queue.data?.breached ?? 0;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Drift & breaches"
        lead="Clients whose portfolio has wandered from its model, the worst first."
      />

      {breached > 0 && (
        <Alert tone="danger">
          <span className="font-semibold">
            {breached === 1 ? "1 portfolio is" : `${breached} portfolios are`} past what the model allows.
          </span>{" "}
          Each one needs putting back. Open a client to see which asset class has gone and what it would take
          to close the gap.
        </Alert>
      )}

      <RecordList
        caption="Drift & breaches"
        subtitle="Worst first"
        head={
          <>
            <th scope="col" className="px-5 py-3 text-left font-semibold">
              Client
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Measured against
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              AUM
            </th>
            {/* What that drift is to be read against, in money rather than in points. A drift of twelve
                points says nothing by itself; twelve points of a portfolio against the two and a half
                million it was allowed to wander is a sentence somebody can act on. */}
            <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
              Allowed
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Drift
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Standing
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </>
        }
        columns={7}
        loading={queue.isLoading}
        stale={queue.isPlaceholderData}
        empty={rows.length > 0 ? undefined : "Every portfolio is where its model wants it."}
        page={page}
        size={size}
        total={queue.data?.totalItems ?? 0}
        noun={["portfolio", "portfolios"]}
        onPage={(next) => update({ page: String(next) })}
        onSize={(next) => update({ size: String(next), page: "0" })}
      >
        {rows.map((row) => (
          // The row opens the portfolio, the same as the client's name and Open do. A queue is worked down
          // by clicking the line you are reading, not by finding the small word at the end of it.
          <tr
            key={row.customerId}
            onClick={() => void navigate(`/portfolio-clients/${row.customerId}?from=drift&back=${asLeft}`)}
            className="cursor-pointer border-t border-line hover:bg-slate-50/60"
          >
            <td className="px-5 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={row.clientName} />
                <div>
                  <Link
                    to={`/portfolio-clients/${row.customerId}?from=drift&back=${asLeft}`}
                    className="font-semibold text-ink hover:text-primary-600"
                  >
                    {row.clientName}
                  </Link>
                  <p className="text-xs text-ink-muted">{row.clientCode}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3">{row.modelName}</td>
            <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
              {underManagementLabel(row.underManagement, row.currency)}
            </td>
            <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-ink-soft">
              {row.allowed === null ? (
                <span className="text-ink-muted">—</span>
              ) : (
                <>
                  {/* The range turned into money against this portfolio: a drift is in points of the
                      whole, so the points the plan allows are that share of the whole. */}
                  <span className="block">
                    ±{underManagementLabel(
                      (row.underManagement * Number(row.allowed)) / 100, row.currency)}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    ±{Number(row.allowed).toFixed(1)}% of the portfolio
                  </span>
                </>
              )}
            </td>
            {/* Which side of the target it has gone is kept in the sign — "+6.4pp" against "−6.4pp" — but
                the ink follows the standing. Coloured by side, a breach the wrong way read as good news. */}
            <td
              className={cn(
                "px-4 py-3 text-right font-semibold whitespace-nowrap",
                driftTones[row.standing],
              )}
            >
              {driftLabel(row.drift)}
            </td>
            <td className="px-4 py-3">
              <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                to={`/portfolio-clients/${row.customerId}?from=drift&back=${asLeft}`}
                className="text-sm font-medium text-primary-700 hover:underline"
              >
                Open
              </Link>
            </td>
          </tr>
        ))}
      </RecordList>

    </div>
  );
}
