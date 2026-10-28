import { ApiError } from "@atomprive/api-client";
import {
  getGetOnboardingCaseQueryKey,
  getListOnboardingCasesQueryKey,
  useGetOnboardingCase,
  useGivePortalAccess,
  useListRelationshipManagers,
  type CaseDetail,
  type Given,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Button, StaffAvatar } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { hasAnyAuthority, hasAuthority, NAMES_ANY_RELATIONSHIP_MANAGER, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { TemporaryPassword } from "../clients/temporary-password";
import { newApplication, toForm } from "./application";
import { ApplicationSummary } from "./application-summary";
import type { SentForSignOff } from "@atomprive/api-client/backoffice";
import { CaseSignOff, SignOffNotice } from "./case-sign-off";
import { caseSubtitle, listHref } from "./case-labels";
import { CaseStatusBadge, ProgressMeter } from "./case-parts";
import { OnboardingWizard } from "./onboarding-wizard";

/** /onboarding/new starts a case; /onboarding/:caseId continues a draft, or shows a submitted case. */
export function OnboardingCasePage() {
  const { caseId = "new" } = useParams();
  const isNew = caseId === "new";
  const user = useStaffUser();
  // Entering the client's details is the relationship manager's too, for their own clients; filling in
  // the client's forms stays Operations' work, so the two are asked separately.
  // A relationship manager reads every case now, but works only on the ones they manage. A case of
  // somebody else's is read here and edited nowhere: the API refuses it, so the screen does not offer it
  // either.
  const mayWorkOnAnyCase = hasAuthority(user, "ONBOARD_CLIENTS:CHANGE");
  const canOnboard = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const saved = useGetOnboardingCase<CaseDetail, ApiError>(caseId, { query: { enabled: !isNew } });
  const detail = isNew ? undefined : saved.data;
  const mine = mayWorkOnAnyCase || isNew || detail?.summary.relationshipManager?.id === user.id;
  const editing = canOnboard && mine && (isNew || detail?.summary.submitted === false);
  const managers = useListRelationshipManagers<StaffMember[], ApiError>({ query: { enabled: editing } });
  // A relationship manager onboards their own clients, so the only one they may name is themselves —
  // the API refuses anyone else. Offering the whole list let them choose a colleague and be turned back at
  // submit, so the list holds whoever they are actually allowed to name.
  const namesAnyone = hasAnyAuthority(user, ...NAMES_ANY_RELATIONSHIP_MANAGER);
  const choosable = useMemo(() => {
    if (namesAnyone) return managers.data;
    if (!managers.data) return undefined;
    const them = managers.data.find((person) => person.id === user.id);
    // The signed-in user standing in for themselves, with their own face on it.
    return [them ?? { id: user.id, fullName: user.fullName, photo: user.photo }];
  }, [namesAnyone, managers.data, user.id, user.fullName, user.photo]);
  const initial = useMemo(() => {
    if (detail) return toForm(detail.application);
    const fresh = newApplication();
    // One name to choose from is not a choice; filling it in saves asking a question with a single answer.
    return namesAnyone ? fresh : { ...fresh, relationshipManagerId: user.id };
  }, [detail, namesAnyone, user.id]);
  // The list's search and page, remembered when the case was opened, so going back returns to them.
  const list = (location.state as { list?: string } | null)?.list;
  // The same case is read from two screens, and only one of them is everybody's: Compliance work the KYC
  // review queue and have no Client onboarding to go back to. The link says where it goes.
  const fromKyc = location.pathname.startsWith("/kyc");
  const backTo = fromKyc ? "/kyc" : listHref();
  const backLabel = fromKyc ? "KYC review queue" : "Client onboarding";

  function handleSaved(result: CaseDetail, submitted: boolean) {
    const id = result.summary.id;
    queryClient.setQueryData(getGetOnboardingCaseQueryKey(id), result);
    void queryClient.invalidateQueries({ queryKey: getListOnboardingCasesQueryKey() });
    // The form stays on screen when a new case gets its address, so nothing typed since is lost.
    if (isNew || submitted) {
      void navigate(`/onboarding/${id}`, { replace: true, state: { list, submitted: submitted || undefined } });
    }
  }

  if (isNew && !canOnboard) {
    return <Navigate to={backTo} replace />;
  }
  if (editing) {
    return (
      <OnboardingWizard caseId={detail?.summary.id ?? null} initial={initial} managers={choosable} listHref={backTo} onSaved={handleSaved} />
    );
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <BackLink to={backTo} label={backLabel} />
        {saved.isError ? (
          <Alert tone="danger">{saved.error.status === 404 ? "This onboarding case doesn't exist." : saved.error.message}</Alert>
        ) : (
          <p className="text-sm text-ink-muted">Loading the application…</p>
        )}
      </div>
    );
  }
  const justSubmitted = (location.state as { submitted?: boolean } | null)?.submitted === true;
  return (
    <CaseOverview
      detail={detail}
      justSubmitted={justSubmitted}
      canOnboard={canOnboard}
      backTo={backTo}
      backLabel={backLabel}
    />
  );
}

/**
 * Offering the new clients a way into the portal, at the only moment it is easy to hand one over.
 *
 * <p>Here because this is where the desk is standing when the client becomes a client: they have just
 * finished typing their details and are usually still on the telephone to them. A password handed over
 * then is read out and used; the same password found on a list a fortnight later is a password nobody
 * remembers asking for.
 *
 * <p>Offered rather than done. Not every firm gives every client a login on day one, and a platform that
 * minted one regardless would be making that decision for them.
 */
function PortalAccessOffer({ caseId }: { caseId: string }) {
  const [given, setGiven] = useState<Given[]>();
  const give = useGivePortalAccess<ApiError>({ mutation: { onSuccess: (done) => setGiven(done.given) } });

  if (given) {
    const setUp = given.filter((one) => one.temporaryPassword);
    return (
      <section className="space-y-4 rounded-2xl border border-line bg-white px-5 py-5">
        <h2 className="text-sm font-bold">
          {setUp.length === 0 ? "Nobody could be set up" : "Read these out before you close this page"}
        </h2>
        {given.map((one) => (
          <div key={one.customerId}>
            <p className="text-xs font-semibold text-ink-soft">{one.fullName}</p>
            {one.temporaryPassword && one.email ? (
              <div className="mt-1.5">
                <TemporaryPassword password={one.temporaryPassword} />
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">{one.why ?? "No password was made."}</p>
            )}
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4">
      <div>
        <h2 className="text-sm font-bold">Give them a way into the client portal?</h2>
        <p className="mt-0.5 max-w-[70ch] text-xs text-ink-muted">
          Each client on this application gets a temporary password, shown once on this page, which they
          replace the first time they sign in. You can also do this later from their file.
        </p>
        {give.isError && <p className="mt-1 text-xs text-red-600">{give.error.message}</p>}
      </div>
      <Button disabled={give.isPending} onClick={() => give.mutate({ id: caseId })}>
        {give.isPending ? "Setting them up…" : "Create temporary passwords"}
      </Button>
    </section>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

/** A case as it stands, for submitted cases and for people who can only view onboarding. */
function CaseOverview({
  detail,
  justSubmitted,
  canOnboard,
  backTo,
  backLabel,
}: {
  detail: CaseDetail;
  justSubmitted: boolean;
  canOnboard: boolean;
  backTo: string;
  backLabel: string;
}) {
  const { summary } = detail;
  const manager = summary.relationshipManager;
  /** What came of writing to Compliance, known only just after the case is sent to them. */
  const [told, setTold] = useState<SentForSignOff>();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink to={backTo} label={backLabel} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={summary.clientName} photo={summary.clientPhoto} className="size-12 text-sm" />
            <div>
              <h1 className="text-[1.625rem] leading-tight font-bold">{summary.clientName}</h1>
              <p className="mt-0.5 text-sm text-ink-muted">{caseSubtitle(summary)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CaseStatusBadge status={summary.status} />
            <CaseSignOff detail={detail} canChange={canOnboard} onSent={setTold} />
          </div>
        </div>
      </header>

      <SignOffNotice detail={detail} told={told} />


      {justSubmitted && summary.submitted && (
        <>
          <Alert tone="success">Details submitted. The next stage is collecting the client's forms.</Alert>
          {canOnboard && <PortalAccessOffer caseId={summary.id} />}
        </>
      )}
      {!summary.submitted && (
        <Alert tone="info">
          {canOnboard
            ? "This application is still a draft."
            : "This application is still a draft. Operations fills in and submits the client's details."}
        </Alert>
      )}

      {/* The card the client file's own Onboarding tile wears, so the same four facts are not laid out
          two different ways on two screens. Four cells with rules between them read as a table of a
          single line — the start of a list that never comes — and put a band of columns across the page
          to say four short things. Down one side, then down the other, instead. */}
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <h2 className="text-base font-bold">Where it stands</h2>
        <dl className="mt-4 grid grid-flow-col grid-rows-2 gap-x-5 gap-y-5">
          {/* The case's own, not the client's. A draft has no client on the book yet to read a desk off,
              and this is the manager the application was filled in under. The client file reads who looks
              after them now, which is a different question and is asked there. */}
          <Fact label="Relationship manager">
            {manager ? (
              <span className="flex items-center gap-2">
                <StaffAvatar name={manager.fullName} photo={manager.photo} className="size-6 text-3xs" />
                {manager.fullName}
              </span>
            ) : (
              "Not chosen yet"
            )}
          </Fact>
          <Fact label="Started">{formatDate(summary.startedAt)}</Fact>
          <Fact label="Submitted">{detail.submittedAt ? formatDate(detail.submittedAt) : "Not yet"}</Fact>
          <Fact label="Current stage">
            <span className="block">{summary.currentStage}</span>
            <ProgressMeter done={summary.completedSteps} total={summary.totalSteps} className="mt-2" inWords />
          </Fact>
        </dl>
      </section>

      {/* Read what Operations submitted, then decide on each signed form, before the KYC is signed off. */}

      <section aria-labelledby="application-title" className="space-y-4 rounded-2xl border border-line bg-white px-6 py-6">
        <div>
          <h2 id="application-title" className="text-base font-bold">
            Application
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {summary.submitted ? "The details as submitted. They can't be changed." : "The details entered so far."}
          </p>
        </div>
        <ApplicationSummary application={toForm(detail.application)} managers={manager ? [manager] : []} />
      </section>
    </div>
  );
}

/** One fact, label above value, the way the client file's tile reads them. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}
