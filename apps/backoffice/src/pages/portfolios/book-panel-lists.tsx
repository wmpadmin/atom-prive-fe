import { ApiError } from "@atomprive/api-client";
import {
  useGetBookOverview,
  useListDrift,
  useListPortfolioStandings,
  useListRebalancing,
  type BookOverview,
  type BulkRebalancing,
  type DriftPage,
  type ListDriftStandingItem,
  type StandingsPage,
} from "@atomprive/api-client/backoffice";
import { FigureBody } from "../client-workspace/figure-panel";
import { money } from "../dashboard/dashboard-kit";

/**
 * The lists a book-level figure's side panel reads when it opens: the clients behind a model, an asset class, the
 * book or a drift standing. Each is read with the screen's generated hook, so nothing here is worked out by hand.
 */

/** Where a client's line opens, or null where the reader may not open it. */
export type ClientLink = (customerId: string) => string | null;

function standingLabel(standing: string | null | undefined) {
  if (standing === "WITHIN_BAND") return "Within band";
  if (standing === "BREACHED") return "Outside band";
  return "—";
}

function drift(value: number | null | undefined) {
  return value == null ? "—" : `${Number(value).toFixed(2)}%`;
}

function Quiet({ children }: { children: string }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

/** Everyone on one model, biggest first: what each holds, how far from the plan, and whether past its band. */
export function ModelClients({ modelId, linkFor }: { modelId: string; linkFor: ClientLink }) {
  const read = useListRebalancing<BulkRebalancing, ApiError>(modelId);
  if (read.isError) return <Quiet>{`The clients on this model could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the clients on this model…</Quiet>;
  const clients = [...read.data.clients].sort((a, b) => b.underManagement - a.underManagement);
  if (clients.length === 0) return <Quiet>No client of yours is on this model.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: "Each client's value is in their portfolio's own currency.",
      table: {
        title: `Clients on ${read.data.modelName}`,
        columns: ["Client", "AUM", "Drift", "Standing"],
        rows: clients.map((one) => [one.clientName, money(one.underManagement, one.currency), drift(one.drift), standingLabel(one.standing)]),
        links: clients.map((one) => linkFor(one.customerId)),
      },
    }} />
  );
}

/** The book's clients, biggest first, as the book overview reads them. */
export function BookClients({ currency, linkFor }: { currency: string; linkFor: ClientLink }) {
  const read = useGetBookOverview<BookOverview, ApiError>({ currency });
  if (read.isError) return <Quiet>{`Your clients could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading your clients…</Quiet>;
  const clients = [...read.data.clients].sort((a, b) => (b.aum ?? 0) - (a.aum ?? 0));
  if (clients.length === 0) return <Quiet>You have no clients yet.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      table: {
        title: "Clients behind it, by AUM",
        columns: ["Client", `AUM (${read.data.currency})`, "Share", "Largest deviation"],
        rows: clients.map((one) => [
          one.name,
          one.aum == null ? null : money(one.aum, read.data.currency),
          one.sharePercent == null ? null : `${one.sharePercent}%`,
          drift(one.maxDeviation),
        ]),
        links: clients.map((one) => linkFor(one.customerId)),
      },
    }} />
  );
}

/**
 * What each of the book's clients holds in one asset class, read from each client's own standing. The class
 * split is per client and in each client's own currency; where the standings cannot be read, the book's clients
 * by AUM are listed instead.
 */
export function ClassClients({ code, name, currency, linkFor }: { code: string; name: string; currency: string; linkFor: ClientLink }) {
  const book = useGetBookOverview<BookOverview, ApiError>({ currency });
  const ids = (book.data?.clients ?? []).map((one) => one.customerId);
  const standings = useListPortfolioStandings<StandingsPage, ApiError>({ customerIds: ids }, { query: { enabled: ids.length > 0 } });
  if (book.isError) return <Quiet>{`Your clients could not be read: ${book.error.message}`}</Quiet>;
  if (!book.data) return <Quiet>Reading your clients…</Quiet>;
  if (ids.length === 0) return <Quiet>You have no clients yet.</Quiet>;
  if (standings.isError) return <BookClients currency={currency} linkFor={linkFor} />;
  if (!standings.data) return <Quiet>Reading what each client holds…</Quiet>;
  const names = new Map(book.data.clients.map((one) => [one.customerId, one.name]));
  const holding = standings.data.items
    .map((one) => ({ one, amount: Number(one.holdings[code] ?? 0), share: one.shares[code] }))
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (holding.length === 0) return <Quiet>{`None of your clients' standings shows a holding in ${name}.`}</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: "Each client's figure is in their portfolio's own currency.",
      table: {
        title: `Clients holding ${name}`,
        columns: ["Client", `In ${name}`, "Of their portfolio", "AUM"],
        rows: holding.map(({ one, amount, share }) => [
          names.get(one.customerId) ?? one.customerId,
          money(amount, one.currency),
          share == null ? null : `${Number(share).toFixed(1)}%`,
          money(one.underManagement, one.currency),
        ]),
        links: holding.map(({ one }) => linkFor(one.customerId)),
      },
    }} />
  );
}

/** Portfolios on a model, worst first, as the drift queue lists them; narrowed to one standing where asked. */
export function DriftClients({ standing, linkFor }: { standing?: ListDriftStandingItem; linkFor: ClientLink }) {
  const read = useListDrift<DriftPage, ApiError>({ standing: standing ? [standing] : undefined, size: 100 });
  if (read.isError) return <Quiet>{`The drift list could not be read: ${read.error.message}`}</Quiet>;
  if (!read.data) return <Quiet>Reading the drift list…</Quiet>;
  const rows = read.data.items;
  if (rows.length === 0) return <Quiet>No portfolio of yours is listed here.</Quiet>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      note: read.data.totalItems > rows.length
        ? `The first ${rows.length} of ${read.data.totalItems}, worst first. Each value is in the client's own currency.`
        : "Worst first. Each value is in the client's own currency.",
      table: {
        title: "Clients behind it",
        columns: ["Client", "Model", "AUM", "Drift", "Allowed", "Standing"],
        rows: rows.map((one) => [
          one.clientName, one.modelName, money(one.underManagement, one.currency), drift(one.drift),
          one.allowed == null ? null : drift(one.allowed), standingLabel(one.standing),
        ]),
        links: rows.map((one) => linkFor(one.customerId)),
      },
    }} />
  );
}
