import { ApiError } from "@atomprive/api-client";
import {
  getGetOnboardingCaseQueryKey,
  getListOnboardingCasesQueryKey,
  useGetOnboardingCase,
  useListRelationshipManagers,
  type CaseDetail,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { hasAnyAuthority, ONBOARDS_CLIENTS_CHANGE } from "../../lib/permissions";
import { newApplication, toForm } from "./application";
import { ApplicationSummary } from "./application-summary";
import type { SentForSignOff } from "@atomprive/api-client/backoffice";
import { CaseSignOff, SignOffNotice } from "./case-sign-off";
import { caseSubtitle, listHref } from "./case-labels";
import { CaseStatusBadge, ClientMark, ProgressMeter } from "./case-parts";
import { OnboardingWizard } from "./onboarding-wizard";

/** /onboarding/new starts a case; /onboarding/:caseId continues a draft, or shows a submitted case. */
export function OnboardingCasePage() {
  const { caseId = "new" } = useParams();
  const isNew = caseId === "new";
  const user = useStaffUser();
  // Entering the client's details is the advisor's too, for their own clients; filling in the client's forms
  // stays Operations' work, so the two are asked separately.
  const canOnboard = hasAnyAuthority(user, ...ONBOARDS_CLIENTS_CHANGE);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const saved = useGetOnboardingCase<CaseDetail, ApiError>(caseId, { query: { enabled: !isNew } });
  const detail = isNew ? undefined : saved.data;
  const editing = canOnboard && (isNew || detail?.summary.submitted === false);
  const managers = useListRelationshipManagers<StaffMember[], ApiError>({ query: { enabled: editing } });
  const initial = useMemo(() => (detail ? toForm(detail.application) : newApplication()), [detail]);
  // The list's search and page, remembered when the case was opened, so going back returns to them.
  const list = (location.state as { list?: string } | null)?.list;
  const fromKyc = location.pathname.startsWith("/kyc");
  const backTo = fromKyc ? "/kyc" : listHref(location.state);

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
      <OnboardingWizard caseId={detail?.summary.id ?? null} initial={initial} managers={managers.data} listHref={backTo} onSaved={handleSaved} />
    );
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <BackLink to={backTo} />
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
    />
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      Client onboarding
    </Link>
  );
}

/** A case as it stands, for submitted cases and for people who can only view onboarding. */
function CaseOverview({
  detail,
  justSubmitted,
  canOnboard,
  backTo,
}: {
  detail: CaseDetail;
  justSubmitted: boolean;
  canOnboard: boolean;
  backTo: string;
}) {
  const { summary } = detail;
  const manager = summary.relationshipManager;
  /** What came of writing to Compliance, known only just after the case is sent to them. */
  const [told, setTold] = useState<SentForSignOff>();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink to={backTo} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ClientMark name={summary.clientName} className="size-12 rounded-xl text-sm" />
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
        <Alert tone="success">Details submitted. The next stage is collecting the client's documents.</Alert>
      )}
      {!summary.submitted && (
        <Alert tone="info">
          {canOnboard
            ? "This application is still a draft."
            : "This application is still a draft. Operations fills in and submits the client's details."}
        </Alert>
      )}

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Relationship manager">
          {manager ? (
            <span className="flex items-center gap-2">
              <Avatar name={manager.fullName} className="size-6 text-3xs" />
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
          <ProgressMeter done={summary.completedSteps} total={summary.totalSteps} className="mt-2" />
        </Fact>
      </dl>

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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}
