import { ApiError } from "@atomprive/api-client";
import {
  getMySecurityQueryKey,
  useChangeMyPassword,
  useEmailMyNewPhoneCode,
  useFinishMyNewPhone,
  useMySecurity,
  useSignOutMyDevice,
  useSignOutMyOtherDevices,
  useStartMyNewPhone,
  type NewPhone,
  type SecurityView,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog, Field, isStrongPassword, PasswordChecklist, PasswordInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { day } from "./figures";

/**
 * The client's own Security page (S19, S7): their password, their authenticator, everywhere they are signed in,
 * and what has happened lately. Every change asks for what proves it is them first.
 */
export function SecurityPage() {
  const queryClient = useQueryClient();
  const security = useMySecurity<SecurityView, ApiError>();
  const [open, setOpen] = useState<"password" | "phone" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: getMySecurityQueryKey() });
  const signOutOne = useSignOutMyDevice<ApiError>({ mutation: { onSuccess: refresh } });
  const signOutOthers = useSignOutMyOtherDevices<ApiError>({
    mutation: { onSuccess: () => { refresh(); setNotice("Every other device is signed out."); } },
  });

  if (security.isError) return <Alert tone="danger">{security.error.message}</Alert>;
  const data = security.data;
  const others = (data?.signedIn ?? []).filter((one) => !one.current).length;

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance text-ink">Security</h1>
        <p className="mt-1 text-sm text-ink-muted">Your password, your authenticator, and everywhere you're signed in.</p>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {(signOutOne.error ?? signOutOthers.error) && <Alert tone="danger">{(signOutOne.error ?? signOutOthers.error)?.message}</Alert>}

      {!data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          <Panel>
            <Row
              title="Password"
              lead={`Last changed ${day(data.passwordChangedAt)}`}
              action={<Button variant="secondary" onClick={() => setOpen("password")}>Change password</Button>}
            />
          </Panel>

          <Panel>
            <Row
              title={
                <span className="flex items-center gap-2">
                  Authenticator app
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${data.authenticatorOn ? "bg-access-full-soft text-access-full-ink" : "bg-access-view-soft text-access-view-ink"}`}>
                    {data.authenticatorOn ? "On" : "Not set up"}
                  </span>
                </span>
              }
              lead={data.authenticatorOn
                ? `Asked for every time you sign in.${data.authenticatorSince ? ` Set up on ${day(data.authenticatorSince)}.` : ""}`
                : "You set it up the next time you sign in."}
              action={data.authenticatorOn && <Button variant="secondary" onClick={() => setOpen("phone")}>Move to a new phone</Button>}
            />
            <div className="border-t border-line px-5 py-4">
              <p className="text-sm font-semibold text-ink">If you lose your phone</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                At sign-in, choose “Email me a code instead” and we send a one-time code to {data.email}.
              </p>
            </div>
          </Panel>

          <Panel>
            <Row
              title="Where you're signed in"
              lead="Sign out of anything you don't recognise, then change your password."
              action={others > 0 && (
                <Button variant="danger-soft" disabled={signOutOthers.isPending} onClick={() => signOutOthers.mutate()}>
                  Sign out everywhere else
                </Button>
              )}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    <th className="px-5 py-2.5">Device</th>
                    <th className="px-5 py-2.5">Where</th>
                    <th className="px-5 py-2.5">Signed in</th>
                    <th className="px-5 py-2.5">Last active</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.signedIn.map((one) => (
                    <tr key={one.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3">
                        <span className="font-semibold">{one.device}</span>
                        {one.current && (
                          <span className="ml-2 rounded-full bg-access-full-soft px-2 py-0.5 text-xs font-bold text-access-full-ink">This device</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{[one.place, one.address].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{when(one.signedInAt)}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{one.current ? "Now" : when(one.lastActiveAt)}</td>
                      <td className="px-5 py-3 text-right">
                        {!one.current && (
                          <Button size="sm" variant="secondary" disabled={signOutOne.isPending}
                            onClick={() => signOutOne.mutate({ sessionId: one.id })}>
                            Sign out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <Row title="Recent security activity" lead="The last sign-ins and changes on your account." />
            {data.history.length === 0 ? (
              <p className="border-t border-line px-5 py-4 text-sm text-ink-muted">Nothing yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.history.map((line, index) => (
                    <tr key={index} className="border-t border-line">
                      <td className={`px-5 py-3 ${line.ok ? "" : "text-access-none-ink"}`}>{line.what}</td>
                      <td className="px-5 py-3 text-ink-muted">{line.place ?? ""}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">{when(line.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      {open === "password" && (
        <ChangePasswordDialog
          onClose={() => setOpen(null)}
          onChanged={() => { setOpen(null); refresh(); setNotice("Your password is changed. Every other device is signed out."); }}
        />
      )}
      {open === "phone" && data && (
        <NewPhoneDialog
          email={data.email}
          onClose={() => setOpen(null)}
          onMoved={() => { setOpen(null); refresh(); setNotice("Your authenticator is on your new phone. The old one no longer works."); }}
        />
      )}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-line bg-white">{children}</section>;
}

function Row({ title, lead, action }: { title: ReactNode; lead: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{lead}</p>
      </div>
      {action}
    </div>
  );
}

function when(at: string) {
  return new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Current password first; a new one that meets the rules, typed twice; every other device signed out after. */
function ChangePasswordDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const change = useChangeMyPassword<ApiError>({ mutation: { onSuccess: onChanged } });
  const fields = change.error?.problem?.errors ?? {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (!current || !isStrongPassword(password) || password !== again) return;
    change.mutate({ data: { currentPassword: current, newPassword: password } });
  }

  return (
    <Dialog open title="Change your password" description="You stay signed in here; every other device is signed out." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {change.error && !fields.currentPassword && !fields.newPassword && <Alert tone="danger">{change.error.message}</Alert>}
        <Field id="current-password" label="Current password"
          error={fields.currentPassword ?? (tried && !current ? "Enter your current password." : undefined)}>
          <PasswordInput id="current-password" value={current} autoComplete="current-password" onChange={(event) => setCurrent(event.target.value)} />
        </Field>
        <Field id="new-password" label="New password" error={fields.newPassword}>
          <PasswordInput id="new-password" value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <PasswordChecklist id="new-password-rules" password={password} showMissing={tried} />
        <Field id="again-password" label="Confirm new password"
          error={tried && again !== password ? "The two passwords are not the same." : undefined}>
          <PasswordInput id="again-password" value={again} autoComplete="new-password" onChange={(event) => setAgain(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={change.isPending}>{change.isPending ? "Changing…" : "Change password"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Three steps: prove it is them (password, and a code from the old phone or by email), scan the new QR code, and
 * enter the new phone's code. The old phone keeps working until the last step.
 */
function NewPhoneDialog({ email, onClose, onMoved }: { email: string; onClose: () => void; onMoved: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [byEmail, setByEmail] = useState(false);
  const [setup, setSetup] = useState<NewPhone | null>(null);
  const [newCode, setNewCode] = useState("");
  const start = useStartMyNewPhone<ApiError>({ mutation: { onSuccess: (fresh) => setSetup(fresh) } });
  const sendCode = useEmailMyNewPhoneCode<ApiError>({ mutation: { onSuccess: () => setByEmail(true) } });
  const finish = useFinishMyNewPhone<ApiError>({ mutation: { onSuccess: onMoved } });
  const error = start.error ?? sendCode.error ?? finish.error;
  const fields = error?.problem?.errors ?? {};
  const step = setup ? 2 : 1;

  return (
    <Dialog open title="Move your authenticator to a new phone"
      description={step === 1 ? "Step 1 of 3 — show it's you." : "Step 2 of 3 — scan this with the authenticator app on your new phone."}
      onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((one) => <span key={one} className={`h-1 flex-1 rounded-full ${one <= step ? "bg-primary-600" : "bg-line"}`} />)}
        </div>
        {error && !Object.keys(fields).length && <Alert tone="danger">{error.message}</Alert>}
        {!setup ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              start.mutate({ data: byEmail ? { password, code: null, emailedCode: code } : { password, code, emailedCode: null } });
            }}
          >
            <Field id="phone-password" label="Your password" error={fields.password}>
              <PasswordInput id="phone-password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Field id="phone-code" label={byEmail ? "Code we emailed you" : "Code from your old phone"}
              error={fields.code ?? fields.emailedCode}>
              <input id="phone-code" value={code} inputMode="numeric" autoComplete="one-time-code"
                onChange={(event) => setCode(event.target.value.replaceAll(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-center font-mono text-xl tracking-[0.4em]" />
            </Field>
            {byEmail && <p className="text-sm text-ink-muted">Sent to {email}. It works for 10 minutes.</p>}
            {!byEmail && (
              <p className="text-sm text-ink-muted">
                Old phone gone?{" "}
                <button type="button" disabled={sendCode.isPending} onClick={() => sendCode.mutate()}
                  className="font-semibold text-primary-700 underline underline-offset-2">
                  Email me a code instead
                </button>
              </p>
            )}
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={!password || code.length < 6 || start.isPending}>Next</Button>
            </div>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); finish.mutate({ data: { code: newCode } }); }}>
            <div dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
              className="mx-auto size-44 rounded-xl border border-line bg-white p-2 [&>svg]:size-full" />
            <p className="text-center text-xs text-ink-muted">
              Can't scan? Enter this key: <span className="font-mono font-bold text-ink">{(setup.secret.match(/.{1,4}/g) ?? []).join(" ")}</span>
            </p>
            <Field id="new-phone-code" label="Then enter the code your new phone shows" error={fields.code}>
              <input id="new-phone-code" value={newCode} inputMode="numeric" autoComplete="one-time-code"
                onChange={(event) => setNewCode(event.target.value.replaceAll(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-center font-mono text-xl tracking-[0.4em]" />
            </Field>
            <p className="text-xs text-ink-muted">Your old phone stops working once this is done.</p>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setSetup(null)}>Back</Button>
              <Button type="submit" disabled={newCode.length < 6 || finish.isPending}>Finish</Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
