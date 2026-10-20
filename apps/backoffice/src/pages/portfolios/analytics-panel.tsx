import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useGetClientValuations,
  type PortfolioStanding,
  type ValuationHistory,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Field, FilterMenu, cn } from "@atomprive/ui";
import { useEffect, useRef, useState } from "react";
import { inkFor, nameOf, useAssetClasses } from "./asset-classes";

function money(amount: number) {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * A figure short enough for an axis: 1.2M rather than 1,200,000, which no axis has room for.
 *
 * <p>Short enough to fit and long enough to differ. Rounded to a fixed place, a scale stepping twenty
 * thousand through a fifteen-million book printed "15.2M" on all five of its lines — five gridlines
 * carrying one number, which is a scale that says nothing. The step decides the places: enough of them
 * that one tick and the next cannot come out the same word.
 */
function brief(amount: number, step?: number) {
  const size = Math.abs(amount);
  const places = (big: number) => {
    if (step === undefined || step <= 0) return big >= 1_000_000 ? 1 : 0;
    // How many places it takes for one step to survive the division: a step of 20,000 read in millions
    // is 0.02 and needs two, a step of 10,000 read in thousands is 10 and needs none.
    return Math.min(Math.max(Math.ceil(-Math.log10(step / big)), 0), 3);
  };
  if (size >= 1_000_000) return `${(amount / 1_000_000).toFixed(places(1_000_000))}M`;
  if (size >= 1_000) return `${(amount / 1_000).toFixed(places(1_000))}K`;
  return String(Math.round(amount));
}

/** A day as a sentence names one: 12 Oct 2026. For the heading, where there is room to say it properly. */
function longDay(day: string) {
  const [year, month, date] = day.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(date)} ${months[Number(month) - 1] ?? month} ${year}`;
}

/** A yyyy-mm-dd read as a local day, so the date picker's bounds do not slide with the time zone. */
function asDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/**
 * How far back and forward the calendar opens.
 *
 * <p>Well past the figures either way. A filter is a question, and a question may reasonably name a
 * date nothing was written on — the first of the month, the start of the year, today. Shutting the
 * calendar to the days on file answered that question by refusing it.
 */
function openFrom(firstOnFile: string) {
  const first = asDate(firstOnFile);
  return new Date(first.getFullYear() - 10, 0, 1);
}

function openTo(lastOnFile: string) {
  // Forward as freely as back. Capped at today, the end of the very month the figures sit in was
  // greyed out — and "to the end of October" is a question somebody asks on the 18th of October.
  // Naming a day nothing has been written on yet simply means "to the end of what there is".
  return new Date(asDate(lastOnFile).getFullYear() + 10, 11, 31);
}

/** The day without its year, which an axis has room for and a reader does not need twice. */
function shortly(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/**
 * What the portfolio has done, drawn.
 *
 * <p>Four questions, four shapes, because they are not the same question. What has the book been worth —
 * a line, because that is a thing over time. What is it made of today, against what it should be made of
 * — two rings side by side, because that is a whole divided up and the comparison is the point. How has
 * that mix moved — a stack a day, because the question is about proportions changing rather than any one
 * figure. And how far is each class outside its band — a bar from the middle, because the sign matters as
 * much as the size.
 *
 * <p>Every one of them is drawn from the days on file, which are written when somebody writes the holdings
 * down. The gaps are real and left as gaps: a line drawn straight through a fortnight nobody wrote
 * anything in would be the platform inventing a fortnight.
 */
export function AnalyticsPanel({ customerId }: { customerId: string }) {
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId);
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);
  const classes = useAssetClasses();
  // The stretch of days everything on this panel is drawn from. Two dates and nothing else: the four
  // buttons beside them asked the same question in rounder words, and a reader who wants the last week
  // can say so here as easily as press a button for it.
  //
  // Held twice: what is typed, and what is in force. Applied as they were picked, the charts moved under
  // the hand that was still choosing — a From picked before its To redrew everything against a stretch
  // nobody had asked for, and there was no moment at which a reader could say "now show me".
  const [picked, setPicked] = useState({ from: "", to: "" });
  const [inForce, setInForce] = useState({ from: "", to: "" });
  const { from, to } = inForce;
  /** The one class a reader has asked to follow through all four charts, or null for all of them. */
  const [only, setOnly] = useState<string | null>(null);

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }

  const currency = history.data?.currency ?? "";
  const every = history.data?.points ?? [];
  // Either end on its own works — from a date to the end of what there is, or the start of it to a date.
  // Neither is everything, which is what the panel opens on.
  const points = every.filter((point) =>
    (from === "" || point.valuedOn >= from) && (to === "" || point.valuedOn <= to));
  const bounds = every.length === 0
    ? null
    : { first: every[0]!.valuedOn, last: every[every.length - 1]!.valuedOn };
  const order = classes.inUse;
  const live = standing.data?.classes ?? [];
  // The last day inside the dates, which is what "as at" means for a stretch: the mix a range leaves
  // the client in. Without dates it is today's standing, which is the live figure the page is headed
  // with — a day written down is a day CLOSED, and holdings written since are not in one yet.
  const narrowed = from !== "" || to !== "";
  const asAt = narrowed ? (points[points.length - 1] ?? null) : null;
  // The plan is today's plan either way. What the dates move is what is weighed against it: the model
  // says what a class should be, and the day says what it was.
  // Dates picked and no day inside them is not an invitation to show today. Left to fall back, the
  // rings went on reporting today's mix under a heading saying Today while the two charts beside them
  // said there was nothing there — one panel disagreeing with itself about what it was looking at.
  const byClass: PortfolioStanding["classes"] = !narrowed ? live : asAt === null ? [] : live.map((row) => {
    const worth = asAt.holdings?.[row.assetClass] ?? 0;
    // What the day itself was worth, which is the figure the line above is drawn from. Summing the
    // holdings instead quietly swapped the denominator the server divides by, so a client with money
    // the calculator counts and nobody has written down read at a different share the moment a date
    // was picked — and could cross a band on nothing but the filter being on.
    const whole = asAt.underManagement;
    const actualShare = whole === 0 ? 0 : (worth / whole) * 100;
    return {
      ...row,
      actualValue: worth,
      actualShare,
      targetValue: (row.targetShare / 100) * whole,
      filled: row.targetShare === 0 ? null : (actualShare / row.targetShare) * 100,
      suggestion: (row.targetShare / 100) * whole - worth,
      drift: actualShare - row.targetShare,
      // No verdict, and nothing on this panel asks for one now. Whether a class has breached is the
      // platform's reading, taken from a band that may be written wider one side than the other and
      // deliberately withheld where there is nothing yet to judge — none of it recoverable from a
      // day's holdings and a target. It is read on the portfolio screen, from the server, once.
      standing: null,
    };
  });

  return (
    <div className="space-y-4">
      <WorthOverTime
        points={points}
        everyCount={every.length}
        currency={currency}
        pending={history.isPending}
        picked={picked}
        setPicked={setPicked}
        inForce={inForce}
        apply={() => setInForce(picked)}
        clear={() => {
          setPicked({ from: "", to: "" });
          setInForce({ from: "", to: "" });
        }}
        bounds={bounds}
      />

      {/* One chart a row. Side by side, the mix table had a column a class in half a card and the rings
          had the other half to put two circles in — each cramped by a neighbour it has nothing to do
          with. They answer different questions and are read one after another, not against each other. */}
      <MadeOf byClass={byClass} order={order} names={classes.names} currency={currency}
        asAt={asAt?.valuedOn ?? null} narrowed={narrowed} only={only} setOnly={setOnly} />
      <HowTheMixMoved points={points} order={order} names={classes.names} narrowed={narrowed}
        only={only} setOnly={setOnly} currency={currency} />

      {/* What a class holds against what the plan asks is read on the portfolio screen, where the
          bands, the suggestion and the button that acts on it already live. Drawn here as well it was
          the same comparison in a second place, and the one that could not give a verdict for a day in
          the past. */}
      <p className="px-1 text-xs text-ink-muted">
        Sub-assets are not drawn here. A day does keep what each line inside a class was worth, but a
        portfolio holds many more lines than classes and a chart of all of them reads as noise. Which
        line inside a class moved is read a day at a time under Daily tracker, where a day opens onto it.
      </p>
    </div>
  );
}

/**
 * A scale whose figures are round, and the ticks to write beside it.
 *
 * <p>The scale used to be the data's own edges with a margin bolted on, and its three figures were
 * whatever those edges came to — 46K at the top, 5K at the foot, 25K in between. Numbers nobody chose,
 * which a reader cannot carry in their head or compare against the next client's chart.
 *
 * <p>So the step is rounded to something a person counts in — 1, 2 or 5 of whatever size the range is —
 * and the scale is stretched to land on it at both ends. The line keeps its air at the top and bottom,
 * because the point of this drawing is movement and a line drawn from nought is a flat one.
 */
function niceScale(low: number, high: number) {
  const span = high - low || Math.max(Math.abs(high) * 0.1, 1);
  // Four or five gaps reads as a scale; two reads as an afterthought and eight is a ruler.
  const rough = span * 1.25 / 4;
  const size = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((one) => one * size).find((one) => one >= rough) ?? size * 10;
  const foot = Math.max(Math.floor((low - span * 0.12) / step) * step, 0);
  const top = Math.ceil((high + span * 0.12) / step) * step;
  const ticks: number[] = [];
  for (let at = foot; at <= top + step / 2; at += step) ticks.push(Math.round(at * 100) / 100);
  return { foot, top: ticks[ticks.length - 1] ?? top, ticks, step };
}

/** The card's width in real pixels, so the drawing is made at the size it is shown at. */
function useWidth() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const card = box.current;
    if (!card) return;
    const watching = new ResizeObserver(([seen]) => {
      if (seen) setWidth(seen.contentRect.width);
    });
    watching.observe(card);
    return () => watching.disconnect();
  }, []);
  return [box, Math.max(width, 280)] as const;
}

/** What the book has been worth, as a line with the ground under it filled in. */
function WorthOverTime({ points, everyCount, currency, pending, picked, setPicked, inForce, apply,
    clear, bounds }: {
  points: ValuationHistory["points"];
  everyCount: number;
  currency: string;
  pending: boolean;
  /** What is typed into the two boxes, which is not yet what anything is drawn from. */
  picked: { from: string; to: string };
  setPicked: (dates: { from: string; to: string }) => void;
  /** What the charts are actually drawn from. */
  inForce: { from: string; to: string };
  apply: () => void;
  clear: () => void;
  bounds: { first: string; last: string } | null;
}) {
  const { from, to } = inForce;
  const [box, width] = useWidth();
  const [over, setOver] = useState<number | null>(null);
  const chosen = from !== "" || to !== "";
  const backwards = from !== "" && to !== "" && from > to;
  // Something typed that is not yet drawn. The button says so, because a filter whose effect is
  // invisible until it happens leaves a reader pressing dates and wondering whether it took.
  const waiting = picked.from !== from || picked.to !== to;

  const worths = points.map((point) => point.underManagement);
  // Against its own range, never against nought: a book that moved from 15.2m to 15.3m drawn from zero
  // is a flat line, and seeing that it moved is the whole reason for drawing it.
  const { foot, top, ticks, step } = niceScale(
    worths.length === 0 ? 0 : Math.min(...worths),
    worths.length === 0 ? 1 : Math.max(...worths));
  // Drawn in real pixels rather than a box stretched to fit. Stretched, every circle came out an oval
  // and the figures beside the scale drifted off the lines they belonged to.
  const HEIGHT = 230;
  const PAD = { top: 14, right: 18, bottom: 26, left: 60 };
  const plotWidth = Math.max(width - PAD.left - PAD.right, 10);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const span = top - foot || 1;
  const x = (at: number) => PAD.left + (plotWidth * at) / Math.max(points.length - 1, 1);
  const y = (worth: number) => PAD.top + plotHeight - (plotHeight * (worth - foot)) / span;

  const first = points[0]?.underManagement ?? 0;
  const last = points[points.length - 1]?.underManagement ?? 0;
  const moved = points.length < 2 ? null : last - first;
  const movedShare = (moved === null || first === 0) ? null : (moved / first) * 100;
  // Every day where there is room for every day, and otherwise a handful evenly spaced — the first and
  // the last always among them, because they are the two the figures above are measured between.
  const everyNth = Math.max(1, Math.ceil(points.length / 8));
  const shows = (at: number) => at === 0 || at === points.length - 1 || at % everyNth === 0;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What it has been worth
          </h2>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {/* A dash where there is no day to read, not nought. Nought is a figure, and a portfolio
                reading "0 USD" because somebody picked a fortnight nobody wrote in says the client has
                nothing — which is the one thing it must never say by accident. */}
            <span className="text-3xl font-bold tabular-nums text-ink">
              {points.length === 0 ? "—" : money(last)}{" "}
              {points.length > 0 && <span className="text-base font-normal text-ink-muted">{currency}</span>}
            </span>
            {moved !== null && (
              <span className={cn("text-sm font-semibold tabular-nums",
                moved > 0 ? "text-emerald-700" : moved < 0 ? "text-red-600" : "text-ink-muted")}>
                {moved > 0 ? "▲" : moved < 0 ? "▼" : ""} {money(Math.abs(moved))}
                {movedShare !== null && ` (${movedShare > 0 ? "+" : ""}${movedShare.toFixed(1)}%)`}
              </span>
            )}
          </div>
          {/* The days it is measured between, said outright. "over 7 days" counted the days written
              down, which is not the stretch they cover and reads as a contradiction beside Everything. */}
          {points.length > 0 && (
            <p className="mt-1 text-xs text-ink-muted">
              {longDay(points[0]!.valuedOn)} to {longDay(points[points.length - 1]!.valuedOn)} ·{" "}
              {points.length} {points.length === 1 ? "day" : "days"} written down
            </p>
          )}
        </div>

        {/* Beside the figures rather than under them, where the four buttons it replaced used to sit:
            a filter belongs at the edge a reader reaches for, not across the middle of the card. The
            three controls are one height and one width, because they are one row of one thing. */}
        {bounds && (
          <div className={cn("flex flex-wrap gap-2 rounded-xl border px-3 py-2.5",
            waiting ? "border-primary-600/40 bg-primary-50/50" : "border-line bg-slate-50/60")}>
            <Field id="worth-from" label="From" className="w-40">
              <DateInput
                id="worth-from"
                name="worth-from"
                value={picked.from}
                clearable
                min={openFrom(bounds.first)}
                max={openTo(bounds.last)}
                onChange={(value) => setPicked({ ...picked, from: value })}
              />
            </Field>
            <Field id="worth-to" label="To" className="w-40">
              <DateInput
                id="worth-to"
                name="worth-to"
                value={picked.to}
                clearable
                min={openFrom(bounds.first)}
                max={openTo(bounds.last)}
                onChange={(value) => setPicked({ ...picked, to: value })}
              />
            </Field>
            {/* Pressed, not watched. Nothing below moves until it is, so a reader picking the second
                of two dates is not redrawing the panel against the first one on its own. */}
            {/* The buttons carry a label line of their own, empty. Bottom-aligning them against the
                boxes instead left them a few pixels low — the boxes sit under a label and the buttons
                sat under nothing, so the row had no shared line to align on. Given the same two-part
                shape, all three stand on one. */}
            <div className="w-40 shrink-0 space-y-1.5">
              <span aria-hidden="true" className="block text-2xs font-semibold uppercase">&nbsp;</span>
              <Button className="w-full" disabled={!waiting} onClick={apply}>
                {waiting ? "Apply" : "Applied"}
              </Button>
            </div>
            {(chosen || picked.from !== "" || picked.to !== "") && (
              <div className="w-40 shrink-0 space-y-1.5">
                <span aria-hidden="true" className="block text-2xs font-semibold uppercase">&nbsp;</span>
                <Button variant="secondary" className="w-full" onClick={clear}>
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Under the row it is about, and only where it has something to add. Beside the boxes it pushed
          the three of them out of line with each other, which is the whole of what was asked for. */}
      {bounds && (waiting || backwards || !chosen) && (
        <p className="mt-2 text-xs text-ink-muted md:text-right">
          {waiting
            ? "Press Apply to draw the panel against these dates."
            : backwards
              ? `From is after To. Figures are on file from ${longDay(bounds.first)} to ${longDay(bounds.last)}.`
              : `Figures are on file from ${longDay(bounds.first)} to ${longDay(bounds.last)}.`
                + " Leave both empty for all of them."}
        </p>
      )}

      {/* Any date, not only the days that happen to hold a figure. Bounded to those, the calendar greyed
          out all but the handful written down — so a reader could not ask for "the start of October", which
          is the ordinary way to ask, and a filter that refuses the question reads as broken. Asking for a
          stretch wider than the figures is a sound question with a short answer. */}
      {/* The width is measured off this, which is drawn whether or not there is a line to put in it.
          Measured off the figure instead, the observer had nothing to attach to on the first render —
          the days had not arrived — and never attached at all, so the drawing stayed at its narrowest
          in a card four times the width. */}
      <div ref={box}>
      {pending ? (
        <p className="py-16 text-center text-sm text-ink-muted">Reading the days…</p>
      ) : points.length < 2 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line py-16 text-center text-sm text-ink-muted">
          {everyCount === 0
            ? "No day has been written down yet."
            : backwards
              ? "From is after To, so there is nothing between them."
              : chosen
                ? "No two days on file between those dates. A line needs two."
                : "One day on file. A line needs two."}
        </p>
      ) : (
        <figure className="relative mt-5">
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={`What the portfolio was worth on each of ${points.length} days, in ${currency}`}
            className="w-full text-primary-600"
            onMouseLeave={() => setOver(null)}
            onMouseMove={(event) => {
              const seen = event.currentTarget.getBoundingClientRect();
              // The point nearest the pointer, not the one under it: a line is read by its height at a
              // date, and a reader aiming at a dot two pixels wide would mostly hit nothing.
              const at = ((event.clientX - seen.left) * (width / seen.width) - PAD.left) / plotWidth;
              const which = Math.round(at * Math.max(points.length - 1, 1));
              setOver(Math.min(Math.max(which, 0), points.length - 1));
            }}
          >
            <defs>
              <linearGradient id="worth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* One line per figure beside it, so a height on the drawing and a figure in the margin are
                the same thing rather than two things that nearly line up. */}
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} y1={y(tick)} x2={width - PAD.right} y2={y(tick)}
                  className="stroke-line" strokeWidth="1" />
                <text x={PAD.left - 10} y={y(tick)} dominantBaseline="middle" textAnchor="end"
                  className="fill-ink-muted text-[11px] tabular-nums">
                  {brief(tick, step)}
                </text>
              </g>
            ))}
            <polygon
              fill="url(#worth-fill)"
              points={`${x(0)},${y(foot)} ${points.map((p, i) => `${x(i)},${y(p.underManagement)}`).join(" ")} ${x(points.length - 1)},${y(foot)}`}
            />
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.map((p, i) => `${x(i)},${y(p.underManagement)}`).join(" ")}
            />
            {/* A dot a day where the days are few enough to tell apart; otherwise the line carries it
                and the two ends are marked, which are the figures the heading is measured between. */}
            {points.map((point, i) => (
              (points.length <= 31 || i === 0 || i === points.length - 1 || i === over) && (
                <circle key={point.valuedOn} cx={x(i)} cy={y(point.underManagement)}
                  r={i === over ? 5 : 4} fill="currentColor"
                  className="stroke-white" strokeWidth="2" />
              )
            ))}
            {/* Where the pointer is, read down to the day it belongs to. */}
            {over !== null && points[over] && (
              <line x1={x(over)} y1={PAD.top} x2={x(over)} y2={PAD.top + plotHeight}
                className="stroke-ink/25" strokeWidth="1" />
            )}
            {points.map((point, i) => shows(i) && (
              <text key={`day-${point.valuedOn}`} x={x(i)} y={HEIGHT - 8} textAnchor="middle"
                className="fill-ink-muted text-[11px] tabular-nums">
                {shortly(point.valuedOn)}
              </text>
            ))}
          </svg>
          {/* Read off the drawing rather than hunted for in a tooltip the browser takes a second to
              offer. A figure a reader has to hover and wait for is a figure they do without. */}
          {over !== null && points[over] && (
            <div
              className="pointer-events-none absolute top-0 rounded-lg border border-line bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg"
              style={{
                left: `${(x(over) / width) * 100}%`,
                // Anchored by which edge it is near rather than always from its middle: centred on a
                // point at the end of the line, half of it hung outside the card and the words inside
                // it wrapped to three lines trying to fit.
                transform: x(over) / width < 0.14
                  ? "translateX(-8px)"
                  : x(over) / width > 0.86 ? "translateX(calc(-100% + 8px))" : "translateX(-50%)",
              }}
            >
              <p className="font-semibold tabular-nums text-ink">
                {money(points[over]!.underManagement)} {currency}
              </p>
              <p className="mt-0.5 text-ink-muted">{longDay(points[over]!.valuedOn)}</p>
            </div>
          )}
          <figcaption className="sr-only">
            What the portfolio was worth on each day written down, in {currency}.
          </figcaption>
        </figure>
      )}
      </div>
    </section>
  );
}

/** What the book is made of today, against what the plan asks it to be made of. */
function MadeOf({ byClass, order, names, currency, asAt, narrowed, only, setOnly }: {
  byClass: PortfolioStanding["classes"];
  order: { code: string }[];
  names: Record<string, string>;
  currency: string;
  /** The day these figures are read from, or null where they are today's. */
  asAt: string | null;
  narrowed: boolean;
  /** The one class being followed through the panel, or null for all of them. */
  only: string | null;
  setOnly: (code: string | null) => void;
}) {
  const held = byClass.filter((row) => row.actualValue > 0);
  const written = held.reduce((sum, row) => sum + row.actualValue, 0);
  // What the platform divides by, which is now simply what is written down. There used to be a second
  // figure — what the firm had been told the client had in all — and this card had to work it back out
  // of the server's own shares or it would put a class at sixty per cent while the card under it put the
  // same class at thirty, on one screen, at one instant. Nobody tells the firm a total any more.
  const whole = written;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        What it is made of
      </h2>
      {/* Which day, said outright. A ring that quietly changed under a date somebody picked, still
          headed "Today", is the screen telling them the wrong thing in its own words. */}
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <span>
          {asAt !== null
            ? `As at ${longDay(asAt)}`
            : narrowed ? "For the dates picked" : "Today"}, against what the plan asks for.
        </span>
        {only !== null && (
          <button type="button" onClick={() => setOnly(null)}
            className="rounded-md bg-primary-50 px-2 py-0.5 font-semibold text-primary-700 hover:bg-primary-100">
            showing {nameOf(only, names)} · clear
          </button>
        )}
      </p>

      {whole === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line py-12 text-center text-sm text-ink-muted">
          {/* Three different states, which were all one sentence. A day with nothing in it is not a day
              that is missing, and a client on no plan is neither. */}
          {asAt !== null
            ? `Nothing was held on ${longDay(asAt)}.`
            : narrowed ? "No day on file between those dates." : "Nothing is written down yet."}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Ring
              title="Held"
              slices={[
                ...held.map((row) => ({
                  code: row.assetClass,
                  share: (row.actualValue / whole) * 100,
                  ink: inkFor(row.assetClass, order),
                })),
              ]}
              middle={brief(whole)}
              under={currency}
              only={only}
              setOnly={setOnly}
              names={names}
            />
            <Ring
              title="Asked for"
              slices={byClass.filter((row) => row.targetShare > 0).map((row) => ({
                code: row.assetClass,
                share: row.targetShare,
                ink: inkFor(row.assetClass, order),
              }))}
              middle="100"
              under="%"
              only={only}
              setOnly={setOnly}
              names={names}
            />
          </div>

          {/* Named beside the rings rather than under them, because the card is the width of the page
              now and a list of four names below two circles leaves most of it empty. */}
          {/* Beside the rings and close to them. Given the whole of what was left over it sat against
              the far edge of a card the width of the page, with a hand's breadth of nothing between it
              and the circles it names. */}
          <ul className="min-w-64 flex-1 basis-64 md:max-w-md">
            {byClass
              .filter((row) => row.actualValue > 0 || row.targetShare > 0)
              .map((row) => {
                const actual = whole === 0 ? 0 : (row.actualValue / whole) * 100;
                const dimmed = only !== null && only !== row.assetClass;
                return (
                  <li key={row.assetClass}>
                    {/* The names are the other half of the ring and are hit far more easily than an
                        arc, so they pick the same class the slices do. */}
                    <button
                      type="button"
                      onClick={() => setOnly(only === row.assetClass ? null : row.assetClass)}
                      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-px text-left text-sm leading-6",
                        only === row.assetClass ? "bg-primary-50" : "hover:bg-slate-50",
                        dimmed && "opacity-45")}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: inkFor(row.assetClass, order) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {row.assetClassName || nameOf(row.assetClass, names)}
                      </span>
                      <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-ink">
                        {actual.toFixed(1)}%
                      </span>
                      <span className="w-20 shrink-0 text-right text-2xs tabular-nums text-ink-muted">
                        of {row.targetShare.toFixed(0)}%
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
          </div>
        </>
      )}
    </section>
  );
}

/** One ring. Slices are drawn as a dashed circle, which needs no arc arithmetic and never rounds wrong. */
function Ring({ title, slices, middle, under, only, setOnly, names }: {
  title: string;
  slices: { code: string; share: number; ink: string }[];
  middle: string;
  under: string;
  only: string | null;
  setOnly: (code: string | null) => void;
  names: Record<string, string>;
}) {
  const R = 15.9155;
  const circumference = 100;
  // Where each slice starts, worked out up front rather than carried along as the list is drawn: a
  // running total mutated inside a map is a total that is wrong the second time React draws it.
  const starts = slices.reduce<number[]>((walked, slice) =>
    [...walked, (walked[walked.length - 1] ?? 0) + slice.share], [0]);
  return (
    <figure className="text-center">
      {/* Big enough that a slice worth a few per cent is an arc and not a hairline — at nine rem it was
          two pixels, which is neither readable nor a thing anybody can hit with a pointer. */}
      <svg viewBox="0 0 42 42" className="size-72" role="img" aria-label={`${title}, by asset class`}>
        <circle cx="21" cy="21" r={R} fill="none" stroke="currentColor" strokeWidth="5"
          className="text-slate-100" />
        {slices.map((slice, at) => {
          const dash = `${slice.share} ${circumference - slice.share}`;
          const offset = circumference / 4 - starts[at];
          const dimmed = only !== null && only !== slice.code;
          return (
            <circle
              key={slice.code}
              cx="21" cy="21" r={R}
              fill="none"
              stroke={slice.ink}
              strokeWidth={only === slice.code ? 7 : 5}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              opacity={dimmed ? 0.22 : 1}
              className="cursor-pointer transition-[opacity,stroke-width]"
              onClick={() => setOnly(only === slice.code ? null : slice.code)}
            >
              <title>{nameOf(slice.code, names)}: {slice.share.toFixed(1)}%</title>
            </circle>
          );
        })}
        <text x="21" y="20.5" textAnchor="middle" className="fill-ink text-[5px] font-bold">{middle}</text>
        <text x="21" y="25" textAnchor="middle" className="fill-ink-muted text-[3px]">{under}</text>
      </svg>
      <figcaption className="mt-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        {title}
      </figcaption>
    </figure>
  );
}

/**
 * What each class has been worth, day by day, with one of them picked out.
 *
 * <p>It has been a stack and then a table, and neither answered the question a reader actually arrives
 * with: did THIS go up or down, and by how much. A stack says a share without a figure; a table says
 * every figure at once and leaves the shape to be assembled in the head. A line says it directly.
 *
 * <p>Every class is drawn, so the one picked is read against the others rather than alone. Picking one
 * scales the drawing to it — a class worth a fortieth of the book is a flat line against the book's own
 * range, and whether that fortieth doubled is exactly what somebody picking it wants to know.
 */
function HowTheMixMoved({ points, order, names, narrowed, only, setOnly, currency }: {
  points: ValuationHistory["points"];
  order: { code: string }[];
  names: Record<string, string>;
  narrowed: boolean;
  only: string | null;
  setOnly: (code: string | null) => void;
  currency: string;
}) {
  const [box, width] = useWidth();
  const [over, setOver] = useState<number | null>(null);
  // Every class any day names, not only the ones still in use: a holding under a class the firm has
  // retired is still money, and dropping it quietly inflated every class beside it.
  const codes = [
    ...order.map((one) => one.code).filter((code) => points.some((p) => (p.holdings?.[code] ?? 0) > 0)),
    ...[...new Set(points.flatMap((p) => Object.keys(p.holdings ?? {})))]
      .filter((code) => !order.some((one) => one.code === code))
      .filter((code) => points.some((p) => (p.holdings?.[code] ?? 0) > 0)),
  ];
  const drawn = only !== null && codes.includes(only) ? [only] : codes;
  const worthOn = (point: ValuationHistory["points"][number], code: string) => point.holdings?.[code] ?? 0;

  const everyWorth = points.flatMap((point) => drawn.map((code) => worthOn(point, code)));
  const { foot, top, ticks, step } = niceScale(
    everyWorth.length === 0 ? 0 : Math.min(...everyWorth),
    everyWorth.length === 0 ? 1 : Math.max(...everyWorth));

  const HEIGHT = 240;
  const PAD = { top: 14, right: 18, bottom: 26, left: 62 };
  const plotWidth = Math.max(width - PAD.left - PAD.right, 10);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const span = top - foot || 1;
  const x = (at: number) => PAD.left + (plotWidth * at) / Math.max(points.length - 1, 1);
  const y = (worth: number) => PAD.top + plotHeight - (plotHeight * (worth - foot)) / span;
  const everyNth = Math.max(1, Math.ceil(points.length / 8));

  const firstDay = points[0];
  const lastDay = points[points.length - 1];
  const movedBy = (code: string) =>
    (firstDay && lastDay) ? worthOn(lastDay, code) - worthOn(firstDay, code) : 0;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What each class has been worth
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {only !== null && codes.includes(only)
              ? `${nameOf(only, names)} on its own, drawn against its own range.`
              : "Every class, day by day. Pick one to follow it."}
          </p>
        </div>
        {/* The filter asked for, and the same picking the rings do: one class, followed everywhere. One
            control rather than a chip a class: the row grew with the book, wrapped onto a second line
            beside the heading, and left the reader to hunt for which of seven was lit. The colour each
            chip carried is still against its class in the legend under the chart.

            Set to a class no day inside the dates holds anything of, it says Every class — which is what
            the drawing below does with it, and a control disagreeing with the chart beside it is worse
            than one that cannot say what was picked elsewhere. */}
        {codes.length > 0 && (
          <div className="w-fit">
            <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Follow
            </span>
            <FilterMenu
              label="Classes"
              value={only !== null && codes.includes(only) ? only : "all"}
              options={[
                { id: "all", label: "Every class" },
                ...codes.map((code) => ({ id: code, label: nameOf(code, names) })),
              ]}
              onChange={(code) => setOnly(code === "all" ? null : code)}
              align="right"
            />
          </div>
        )}
      </div>

      <div ref={box}>
        {points.length < 2 || codes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line py-12 text-center text-sm text-ink-muted">
            {narrowed ? "No two days on file between those dates. A line needs two."
              : points.length === 1 ? "One day on file. A line needs two."
                : "No day has been written down yet."}
          </p>
        ) : (
          <figure className="relative mt-4">
            <svg
              width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img"
              aria-label={`What each asset class was worth on each of ${points.length} days, in ${currency}`}
              className="w-full"
              onMouseLeave={() => setOver(null)}
              onMouseMove={(event) => {
                const seen = event.currentTarget.getBoundingClientRect();
                const at = ((event.clientX - seen.left) * (width / seen.width) - PAD.left) / plotWidth;
                const which = Math.round(at * Math.max(points.length - 1, 1));
                setOver(Math.min(Math.max(which, 0), points.length - 1));
              }}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={PAD.left} y1={y(tick)} x2={width - PAD.right} y2={y(tick)}
                    className="stroke-line" strokeWidth="1" />
                  <text x={PAD.left - 10} y={y(tick)} dominantBaseline="middle" textAnchor="end"
                    className="fill-ink-muted text-[11px] tabular-nums">{brief(tick, step)}</text>
                </g>
              ))}
              {/* The ground filled in only under a class picked on its own, where there is one line and
                  the fill reads as its weight. Under six it would be six washes over each other. */}
              {drawn.length === 1 && drawn[0] && (
                <polygon
                  fill={inkFor(drawn[0], order)} opacity="0.12"
                  points={`${x(0)},${y(foot)} ${points.map((p, i) => `${x(i)},${y(worthOn(p, drawn[0]!))}`).join(" ")} ${x(points.length - 1)},${y(foot)}`}
                />
              )}
              {drawn.map((code) => (
                <polyline
                  key={code} fill="none" stroke={inkFor(code, order)}
                  strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                  points={points.map((p, i) => `${x(i)},${y(worthOn(p, code))}`).join(" ")}
                />
              ))}
              {drawn.map((code) => points.map((point, i) => (
                (points.length <= 31 || i === 0 || i === points.length - 1 || i === over) && (
                  <circle key={`${code}-${point.valuedOn}`} cx={x(i)} cy={y(worthOn(point, code))}
                    r={i === over ? 5 : 3.5} fill={inkFor(code, order)}
                    className="stroke-white" strokeWidth="2" />
                )
              )))}
              {over !== null && points[over] && (
                <line x1={x(over)} y1={PAD.top} x2={x(over)} y2={PAD.top + plotHeight}
                  className="stroke-ink/25" strokeWidth="1" />
              )}
              {points.map((point, i) => (i === 0 || i === points.length - 1 || i % everyNth === 0) && (
                <text key={`day-${point.valuedOn}`} x={x(i)} y={HEIGHT - 8} textAnchor="middle"
                  className="fill-ink-muted text-[11px] tabular-nums">{shortly(point.valuedOn)}</text>
              ))}
            </svg>
            {over !== null && points[over] && (
              <div
                className="pointer-events-none absolute top-0 rounded-lg border border-line bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg"
                style={{
                  left: `${(x(over) / width) * 100}%`,
                  transform: x(over) / width < 0.14 ? "translateX(-8px)"
                    : x(over) / width > 0.86 ? "translateX(calc(-100% + 8px))" : "translateX(-50%)",
                }}
              >
                <p className="font-semibold text-ink">{longDay(points[over]!.valuedOn)}</p>
                <ul className="mt-1 space-y-0.5">
                  {drawn.map((code) => (
                    <li key={code} className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-2 rounded-full"
                        style={{ background: inkFor(code, order) }} />
                      <span className="flex-1 text-ink-muted">{nameOf(code, names)}</span>
                      <span className="tabular-nums text-ink">{money(worthOn(points[over]!, code))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <figcaption className="sr-only">
              What each asset class was worth on each day written down, in {currency}.
            </figcaption>
          </figure>
        )}
      </div>

      {/* What it came to across the stretch, which is the question in the panel's own words. */}
      {points.length > 1 && firstDay && lastDay && codes.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line pt-3">
          {drawn.map((code) => {
            const moved = movedBy(code);
            return (
              <li key={code} className="flex items-center gap-2 text-xs">
                <span aria-hidden="true" className="size-2 rounded-full"
                  style={{ background: inkFor(code, order) }} />
                <span className="text-ink-muted">{nameOf(code, names)}</span>
                <span className={cn("font-semibold tabular-nums",
                  Math.abs(moved) < 0.005 ? "text-ink-muted"
                    : moved > 0 ? "text-emerald-700" : "text-red-600")}>
                  {Math.abs(moved) < 0.005 ? "no change"
                    : `${moved > 0 ? "▲" : "▼"} ${money(Math.abs(moved))} ${currency}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

