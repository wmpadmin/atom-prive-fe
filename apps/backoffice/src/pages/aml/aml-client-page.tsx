import { ApiError } from "@atomprive/api-client";
import {
  useGetAmlClientSheet,
  useRateAmlRisk,
  type ClientSheet,
  type FactorRow,
  type LineForClient,
  type RatingRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Field, TextArea, TextInput, cn } from "@atomprive/ui";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDate, formatDateTime } from "../../lib/labels";
import { hasAnyAuthority, RATES_AML_RISK, READS_AML_MATRIX } from "../../lib/permissions";
import { bandTone } from "./aml-labels";
import { SheetNotReady } from "./sheet-not-ready";

/**
 * One client, scored against the firm's sheet.
 *
 * <p>Every line has to be answered before it can be saved. A line left blank would score nothing, and
 * nothing reads as low risk — which is the one way a risk matrix can be actively worse than no matrix.
 */
export function AmlClientPage() {
  const { customerId } = useParams();
  const user = useStaffUser();
  const mayRate = hasAnyAuthority(user, ...RATES_AML_RISK);
  const mayReadSheet = hasAnyAuthority(user, ...READS_AML_MATRIX);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  // Why somebody set the record's own answer aside, by line. Required for each one they did.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [justRated, setJustRated] = useState<RatingRow | null>(null);

  const client = useGetAmlClientSheet<ClientSheet, ApiError>(customerId ?? "");
  const rate = useRateAmlRisk<ApiError>({
    mutation: {
      onSuccess: (rated) => {
        setErrors(noErrors);
        setJustRated(rated);
        setChosen({});
        setOverrides({});
        setNote("");
        void client.refetch();
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });

  if (!client.data) {
    return client.isError ? (
      <Alert tone="danger">
        {client.error.status === 404 ? "There's no such client." : client.error.message}
      </Alert>
    ) : (
      <p className="text-sm text-ink-muted">Loading the client…</p>
    );
  }

  const { sheet, standing, history, fromTheRecord } = client.data;
  const live = sheet.factors.filter((factor) => factor.retiredAt === null);
  // What the client's own record already answers, so nobody retypes what onboarding entered.
  const record = new Map(fromTheRecord.map((line) => [line.factorId, line]));
  const answerOf = (factorId: string) => chosen[factorId] ?? record.get(factorId)?.answers ?? undefined;
  const unanswered = live.filter((factor) => !answerOf(factor.id));
  // Setting the record aside is allowed, and has to say why — so an unexplained one is not savable.
  const unexplained = live.filter((factor) => {
    const said = record.get(factor.id)?.answers;
    return said != null && chosen[factor.id] != null && chosen[factor.id] !== said
      && (overrides[factor.id] ?? "").trim() === "";
  });
  // Said before the button is pressed rather than after: the server refuses it either way, but a person
  // part-way down a long sheet should be able to see what is left.
  const canSave = sheet.complete && unanswered.length === 0 && unexplained.length === 0 && !rate.isPending;

  return (
    <div className="space-y-6">
      <Link to="/aml-risk" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        AML risk
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">{client.data.clientName}</h1>
          <p className="mt-1 font-mono text-sm text-ink-muted">{client.data.clientCode}</p>
        </div>
        {standing ? (
          <div className="text-right">
            <Badge tone={bandTone(standing.bandFrom)}>
              {standing.bandName} · {standing.score}
            </Badge>
            <p className="mt-1 text-xs text-ink-muted">
              {standing.dueDiligenceTitle} due diligence · due again {formatDate(standing.nextReviewOn)}
            </p>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-danger-700">
            <ShieldAlert className="size-4" aria-hidden="true" />
            Never rated
          </span>
        )}
      </header>

      {justRated && (
        <Alert tone="success">
          Rated {justRated.score} out of 100 — {justRated.bandName}, {justRated.dueDiligenceTitle.toLowerCase()}{" "}
          due diligence, due again {formatDate(justRated.nextReviewOn)}.
          {justRated.forcedBy && ` Settled by ${justRated.forcedBy} rather than by the score.`}
        </Alert>
      )}

      {/*
        Nothing can be scored against a sheet that is not finished. It says what is missing, who puts it
        right and how to get there — a person told only that something is missing is left with nothing to do
        about it.
      */}
      {!sheet.complete && <SheetNotReady faults={sheet.faults} mayRead={mayReadSheet} />}

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      {errors.fields.chosen && <Alert tone="danger">{errors.fields.chosen}</Alert>}

      {mayRate && sheet.complete && (
        <section className="rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Score this client</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Every line is answered before it can be saved. Scoring again writes a new rating; the one
                before it stays on the record.
              </p>
            </div>
            <Button
              disabled={!canSave}
              onClick={() =>
                rate.mutate({
                  customerId: customerId!,
                  data: { chosen, overrides, note: note.trim() || null },
                })
              }
            >
              {rate.isPending
                ? "Saving…"
                : unanswered.length > 0
                  ? `${unanswered.length} line${unanswered.length === 1 ? "" : "s"} to answer`
                  : unexplained.length > 0
                    ? `Say why on ${unexplained.length} line${unexplained.length === 1 ? "" : "s"}`
                    : "Save the rating"}
            </Button>
          </div>

          <div className="divide-y divide-line">
            {live.map((factor) => (
              <Line
                key={factor.id}
                factor={factor}
                chosen={answerOf(factor.id)}
                onFile={record.get(factor.id)}
                why={overrides[factor.id] ?? ""}
                onWhy={(said) => setOverrides({ ...overrides, [factor.id]: said })}
                onChoose={(optionId) => setChosen({ ...chosen, [factor.id]: optionId })}
              />
            ))}
          </div>

          <div className="border-t border-line px-5 py-4">
            <Field id="aml-note" label="Anything worth saying" hint="Kept with the rating, not on the client's file.">
              <TextArea id="aml-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">What this client has been rated</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Newest first, each with what it was worked out from at the time.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {history.map((rating) => (
              <Rated key={rating.id} rating={rating} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One line of the sheet, with the answers the firm allows under it. */
function Line({
  factor,
  chosen,
  onFile,
  why,
  onWhy,
  onChoose,
}: {
  factor: FactorRow;
  chosen: string | undefined;
  onFile: LineForClient | undefined;
  why: string;
  onWhy: (said: string) => void;
  onChoose: (optionId: string) => void;
}) {
  const options = factor.options.filter((option) => option.retiredAt === null);
  // Whether this is still the answer the client's own record came to, or somebody has changed it.
  const theRecords = onFile?.answers;
  const changed = theRecords != null && chosen != null && chosen !== theRecords;
  return (
    <div className="grid gap-3 px-5 py-4 lg:grid-cols-[18rem_1fr]">
      <div>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{factor.groupTitle}</p>
        <p className="mt-0.5 text-sm font-semibold">
          {factor.name}
          {factor.weight > 1 && (
            <span className="ml-2 font-normal text-ink-muted">counts {factor.weight}&times;</span>
          )}
        </p>
        {factor.guidance && <p className="mt-1 text-xs text-ink-soft">{factor.guidance}</p>}
        {/* What onboarding entered, so nobody looks it up and a wrong record is visible rather than copied. */}
        {onFile?.onFile && (
          <p className="mt-1 text-xs font-medium text-primary-700">
            On file: <span className="font-mono">{onFile.onFile}</span>
            {onFile.byFallback && (
              <span className="block font-normal text-amber-700">
                Nothing on the sheet covers that, so it falls to the answer you set aside for anything else.
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={chosen === option.id}
            onClick={() => onChoose(option.id)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              chosen === option.id
                ? "border-primary-600 bg-primary-50 font-semibold text-ink"
                : "border-line bg-white text-ink-soft hover:border-ink-muted hover:text-ink",
            )}
          >
            {option.label}
            <span className="mt-0.5 block text-xs font-normal text-ink-muted">
              {option.score}
              {/* An answer the firm says ends the matter is marked where it is picked, not afterwards. */}
              {option.forcesHighest && " · highest risk on its own"}
            </span>
          </button>
        ))}
        {/* Changing what the record says is allowed, and the reason goes on the rating. */}
        {changed && (
          <div className="w-full">
            <Field id={`why-${factor.id}`} label="Why are you setting the record aside?" required>
              <TextInput
                id={`why-${factor.id}`}
                value={why}
                placeholder="Held through a company since March."
                onChange={(event) => onWhy(event.target.value)}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

/** A rating as it was given, with the sheet it was given on. */
function Rated({ rating }: { rating: RatingRow }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone={bandTone(rating.bandFrom)}>
            {rating.bandName} · {rating.score}
          </Badge>
          <div>
            <p className="text-sm">
              {rating.dueDiligenceTitle} due diligence, due again {formatDate(rating.nextReviewOn)}
            </p>
            <p className="text-xs text-ink-muted">
              {rating.ratedByName} · {formatDateTime(rating.ratedAt)}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "What it was scored on"}
        </Button>
      </div>
      {rating.forcedBy && (
        <p className="mt-2 text-sm text-amber-700">Settled by {rating.forcedBy}, not by the score.</p>
      )}
      {rating.note && <p className="mt-2 text-sm text-ink-soft">{rating.note}</p>}
      {open && (
        <table className="mt-3 min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-4">Line</th>
              <th scope="col" className="px-4 py-2">Answered</th>
              <th scope="col" className="px-4 py-2 text-right">Score</th>
              <th scope="col" className="py-2 pl-4 text-right">Counts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rating.lines.map((line, at) => (
              <tr key={`${line.factorName}-${at}`}>
                <td className="py-2 pr-4">
                  <span className="block">{line.factorName}</span>
                  <span className="block text-xs text-ink-muted">{line.groupTitle}</span>
                </td>
                <td className="px-4 py-2 text-ink-soft">
                  {line.optionLabel}
                  {/* Where the answer came from, which is the thing an inspector asks about. */}
                  {line.fromTheRecord && (
                    <span className="block text-xs text-ink-muted">
                      From the record: <span className="font-mono">{line.whatTheRecordSaid}</span>
                    </span>
                  )}
                  {line.overriddenBecause && (
                    <span className="block text-xs text-amber-700">
                      Set aside{line.whatTheRecordSaid && <> what the record said ({line.whatTheRecordSaid})</>}:{" "}
                      {line.overriddenBecause}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{line.score}</td>
                <td className="py-2 pl-4 text-right tabular-nums text-ink-muted">{line.weight}&times;</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
