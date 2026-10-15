import { cn } from "@atomprive/ui";
import { Link } from "react-router";

/**
 * The three things a portfolio has to be told before it can be read against anything: what the client
 * holds, what they own that nobody manages, and what they owe.
 *
 * <p>Each is its own screen and its own address, because each is a long enough list to leave and come back
 * to and because the last two can be nothing at all. Set out as steps so somebody part way through can see
 * how much of it is left, rather than being handed three screens that happen to follow one another.
 */
const STEPS = [
  { at: 1, name: "What they hold", path: "allocation" },
  { at: 2, name: "What they own", path: "non-financial" },
  { at: 3, name: "What they owe", path: "loans" },
] as const;

export function SetUpSteps({
  step,
  customerId,
  heading,
  lead,
}: {
  step: 1 | 2 | 3;
  customerId: string;
  /** This step's own title, which is what the screen is about rather than what the three of them are. */
  heading: string;
  lead: React.ReactNode;
}) {
  return (
    <div>
      <Link to="/portfolio-clients" className="text-xs font-semibold text-primary-700 hover:underline">
        ← Back to the clients
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-xl font-bold text-ink">Set the portfolio up</h1>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase tabular-nums">
          Step {step} of {STEPS.length}
        </p>
      </div>

      {/* One bar a step, filled behind where somebody is. A step already done is a link back to it, because
          it is the only way to correct what was written there without starting again. */}
      <ol className="mt-2 flex items-center gap-2">
        {STEPS.map((one) => {
          const done = one.at < step;
          const bar = (
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors",
                one.at <= step ? "bg-primary-600" : "bg-slate-200",
              )}
            />
          );
          return (
            <li key={one.at} className="min-w-0 flex-1">
              {done ? (
                <Link
                  to={`/portfolio-clients/${customerId}/${one.path}`}
                  aria-label={`Back to step ${one.at}, ${one.name.toLowerCase()}`}
                  className="block"
                >
                  {bar}
                </Link>
              ) : (
                bar
              )}
              <span
                className={cn(
                  "mt-1.5 block truncate text-2xs",
                  one.at === step ? "font-semibold text-ink" : "text-ink-muted",
                )}
              >
                {one.name}
              </span>
            </li>
          );
        })}
      </ol>

      <h2 className="mt-5 font-semibold text-ink">{heading}</h2>
      <p className="mt-0.5 max-w-prose text-sm text-ink-muted">{lead}</p>
    </div>
  );
}
