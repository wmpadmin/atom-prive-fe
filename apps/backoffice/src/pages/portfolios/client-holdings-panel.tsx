import { ApiError } from "@atomprive/api-client";
import { useListClientHoldings, type ClassPositions, type ClientHoldings } from "@atomprive/api-client/backoffice";
import { Alert, Badge, TextInput } from "@atomprive/ui";
import { anchorFor, standingLabels, standingTones, underManagementLabel } from "./portfolio-labels";
import { useAssetClasses } from "./asset-classes";

/**
 * What a client holds, a figure to the asset class.
 *
 * <p>Written down by hand, because no custodian feed delivers them. Each class is one figure: the firm does
 * not keep a client's portfolio instrument by instrument, so there is nothing under a class to open.
 */
export function ClientHoldingsPanel({
  customerId,
  figures,
  onFigure,
  offer,
  against = null,
  readOnly = false,
}: {
  customerId: string;
  /**
   * What each class is worth, where this panel is the place those figures are written rather than only read.
   */
  figures?: Record<string, string>;
  onFigure?: (assetClass: string, said: string) => void;
  /**
   * Every class to list, in the firm's own order, so a class holding nothing still has a row to start it
   * in. Without it the list can only show what is already there, and a client holding nothing shows nothing.
   */
  offer?: string[];
  /** A model picked on screen but not saved, whose targets these figures should be read against. */
  against?: string | null;
  /** Read somewhere other than the portfolio screen, where writing them down is not the job. */
  readOnly?: boolean;
}) {
  // Read against the model picked on screen where one is, rather than the one on file: somebody setting a
  // client up picks the model and then writes the figures against it, and the targets have to be the ones
  // they are looking at.
  const held = useListClientHoldings<ClientHoldings, ApiError>(
    customerId,
    against ? { against } : undefined,
  );
  const written = held.data?.classes ?? [];
  const currency = held.data?.currency ?? "USD";
  const catalogue = useAssetClasses();

  // A client with nothing written down yet is an ordinary state, not a failure. Shown as one, it put a
  // red banner across the portfolio page of every client whose holdings nobody had typed in.
  if (held.isError && held.error.status !== 404) {
    return <Alert tone="danger">{held.error.message}</Alert>;
  }

  // Every class the page offers gets a row, whether or not anything is in it: a class holding nothing is
  // exactly the one somebody is about to write the first figure into, and a list of only what is already
  // there has nowhere to put it. Where no list is handed in, the panel shows what is written and no more.
  const classes: ClassPositions[] = offer
    ? [
        ...offer.map(
          (code) =>
            written.find((one) => one.assetClass === code) ?? {
              assetClass: code,
              assetClassName: catalogue.names[code] ?? code,
              valueAmount: 0,
              heldAsPositions: false,
              // Nothing is held and nothing has been read, so there is nothing to say about where it stands.
              targetShare: null,
              shareOfPortfolio: null,
              drift: null,
              standing: null,
              suggestion: null,
              subClasses: [],
            },
        ),
        ...written.filter((one) => !offer.includes(one.assetClass)),
      ]
    : written;

  return (
    <section className="space-y-3">
      {held.isPending ? (
        <p className="py-6 text-center text-sm text-ink-muted">Reading what the client holds…</p>
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-ink-muted">
          Nothing is written down yet.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {classes.map((one) => {
            // Written here rather than only read: the page hands in the figures and takes them back.
            const typing = !readOnly && figures !== undefined && onFigure !== undefined;
            return (
              // Named so the table above can send somebody straight here, and given room above it so the
              // row does not land flush against the top of the window when they arrive.
              <li
                key={one.assetClass}
                id={anchorFor(one.assetClass)}
                className="flex scroll-mt-20 items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="flex flex-1 items-center gap-2">
                  {/* Named by the API from the firm's own list; the code stands in for one it has since taken off. */}
                  <span className="font-semibold">{one.assetClassName || one.assetClass}</span>
                  {one.standing && one.standing !== "WITHIN_BAND" && (
                    <Badge tone={standingTones[one.standing]}>{standingLabels[one.standing]}</Badge>
                  )}
                </span>
                <span className="w-32 shrink-0 text-right">
                  {typing ? (
                    <TextInput
                      id={`holding-${one.assetClass}`}
                      aria-label={`What they hold in ${one.assetClassName || one.assetClass}`}
                      inputMode="decimal"
                      className="h-9 text-right"
                      value={figures?.[one.assetClass] ?? ""}
                      onChange={(event) => onFigure?.(one.assetClass, event.target.value)}
                    />
                  ) : (
                    <span className="tabular-nums">{underManagementLabel(one.valueAmount, currency)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
