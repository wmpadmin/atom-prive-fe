import { ApiError } from "@atomprive/api-client";
import {
  getGetCustomerQueryKey,
  useAddAccountHolder,
  useGetCustomer,
  type AccountHolder,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Card } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  emptyHolder,
  reviewApplication,
  tidy,
  type FormApplication,
  type FormHolder,
} from "../onboarding/application";
import { ContactStep, OccupationStep, PersonalDetailsStep } from "../onboarding/onboarding-steps";

/** Where the person joining sits in the application being reviewed: never first, because they are joining. */
const JOINING = 1;

/**
 * Adds somebody to an account that is already open — a spouse, a second spouse, a child coming of age.
 *
 * <p>Its own screen rather than a dialog, because it asks for everything the application asked of everyone
 * else on the account: who they are, what they do, and how the firm reaches them. They are a client in their
 * own right from the moment they join, with their own KYC to do from a standing start — holding an account
 * with somebody who has been approved is not being approved.
 *
 * <p>The same three sections the application asks them in, and the same rules, so what is checked here is what
 * the API checks. It is the application they join, which is what puts them in the family group and gives them
 * the same pack of forms as everyone already on it.
 */
export function AddAccountHolderPage() {
  const { clientId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: file } = useGetCustomer(clientId);
  const [joining, setJoining] = useState<FormHolder>(emptyHolder);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [refused, setRefused] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();

  // Reviewed in place: the person joining is read as a holder of this account, which is what makes how they are
  // related to the others a question at all. Only what is wrong with them is shown — the others already gave
  // theirs, and the API answers the same way.
  const review = useMemo(() => {
    const asHolders: FormApplication = {
      clientType: "INDIVIDUAL",
      relationshipManagerId: null,
      holders: [emptyHolder(), joining],
      entity: {} as FormApplication["entity"],
    };
    return reviewApplication(asHolders, undefined);
  }, [joining]);

  const add = useAddAccountHolder<ApiError>();

  const field = (id: string) => {
    const bare = id.startsWith(`holders[${JOINING}].`) ? id.slice(`holders[${JOINING}].`.length) : id;
    return {
      error: touched.has(id) ? (review.problems[id] ?? refused[bare]) : refused[bare],
      onBlur: () => setTouched((seen) => (seen.has(id) ? seen : new Set(seen).add(id))),
    };
  };

  function change(patch: Partial<FormHolder>) {
    setRefused({});
    setProblem(undefined);
    setJoining((current) => ({ ...current, ...patch }));
  }

  function send() {
    const theirs = Object.keys(review.problems).filter((id) => id.startsWith(`holders[${JOINING}].`));
    if (theirs.length > 0) {
      // Everything they have not been to yet is marked seen, so every box that needs attention says so at once.
      setTouched((seen) => new Set([...seen, ...theirs]));
      setProblem("Some details are still needed before they can be added to the account.");
      return;
    }
    const tidied = tidy({
      clientType: "INDIVIDUAL",
      relationshipManagerId: null,
      holders: [emptyHolder(), joining],
      entity: {} as FormApplication["entity"],
    });
    const holder = tidied.holders?.[JOINING] as AccountHolder;
    add.mutate(
      { id: file?.onboarding?.caseId ?? "", data: holder },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(clientId) });
          navigate(`/clients/${clientId}`, {
            state: { notice: `${joining.fullName} now holds this account, and their KYC is with Compliance.` },
          });
        },
        onError: (caught) => {
          const problems = caught instanceof ApiError ? (caught.problem.errors ?? {}) : {};
          setRefused(problems);
          setProblem(Object.keys(problems).length > 0 ? undefined : (caught as Error).message);
        },
      },
    );
  }

  if (!file) return null;

  // An entity holds its own account, and an account nobody applied for has no application to join.
  const canJoin = file.client.type === "INDIVIDUAL" && file.onboarding?.caseId;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          to={`/clients/${clientId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back to {file.client.fullName}
        </Link>
        <div>
          <h1 className="text-[1.625rem] leading-tight font-bold">Add an account holder</h1>
          <p className="mt-1 text-sm text-ink-muted">
            They join the application {file.client.fullName} opened this account on, which puts them in the
            family group and gives them the same forms. They are a client in their own right, with their own
            KYC to do.
          </p>
        </div>
      </header>

      {!canJoin ? (
        <Alert tone="info">
          {file.client.type === "ENTITY"
            ? "An entity holds its own account, so there is nobody to add to it."
            : "This client has no application on file, so there is nothing to join. Onboard them instead."}
        </Alert>
      ) : (
        <>
          {problem && <Alert tone="danger">{problem}</Alert>}
          <Card title="Personal details">
            <PersonalDetailsStep index={JOINING} holder={joining} onChange={change} field={field} />
          </Card>
          <Card title="Occupation">
            <OccupationStep index={JOINING} holder={joining} onChange={change} field={field} />
          </Card>
          <Card title="Contact & address">
            <ContactStep index={JOINING} holder={joining} onChange={change} field={field} />
          </Card>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => navigate(`/clients/${clientId}`)} disabled={add.isPending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={add.isPending}>
              {add.isPending ? "Adding…" : "Add to the account"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
