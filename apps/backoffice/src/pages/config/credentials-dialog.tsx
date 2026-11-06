import { ApiError } from "@atomprive/api-client";
import {
  bankCredentials,
  getBankCredentialsQueryKey,
  getListCredentialStandingsQueryKey,
  useSetBankCredentials,
  useTestBankConnection,
  type BankView,
  type CredentialRequestSignIn,
  type CredentialView,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, describedBy, Dialog, Field, PasswordInput, SecretArea, TextInput } from "@atomprive/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDate, formatDateTime } from "../../lib/labels";

/**
 * A bank's credentials (S52), for Admin and IT Admin: where the bank is, who the platform signs in as, and the
 * password, key or secret it signs in with. The secret is never shown back — only that one is set, when and by
 * whom — and saving tries the details at once. A credential that works is replaced only by one that connects.
 */
export function CredentialsDialog({ bank, onClose }: { bank: BankView; onClose: () => void }) {
  // Nothing on file comes back as an empty answer, which is "not set" rather than a failure to read.
  const held = useQuery<CredentialView | null, ApiError>({
    queryKey: getBankCredentialsQueryKey(bank.id),
    queryFn: async ({ signal }) => (await bankCredentials(bank.id, { signal })) ?? null,
  });
  const sftp = bank.connectionType === "SFTP";
  return (
    <Dialog
      open
      size="md"
      title={`${bank.name} · ${sftp ? "SFTP" : "API"} credentials`}
      description={`Kept encrypted. Nobody can read a ${sftp ? "password or key" : "secret"} back, here or anywhere else.`}
      onClose={onClose}
    >
      {held.isPending ? (
        <p className="py-6 text-sm text-ink-muted">Reading what is on file…</p>
      ) : held.isError ? (
        <Alert tone="danger">{held.error.message}</Alert>
      ) : (
        <CredentialsForm bank={bank} held={held.data ?? null} onClose={onClose} />
      )}
    </Dialog>
  );
}

const SFTP_SIGN_INS: { value: CredentialRequestSignIn; label: string }[] = [
  { value: "SSH_KEY", label: "SSH key" },
  { value: "PASSWORD", label: "Password" },
];

const API_SIGN_INS: { value: CredentialRequestSignIn; label: string }[] = [
  { value: "OAUTH_CLIENT", label: "OAuth client credentials" },
  { value: "API_KEY", label: "API key" },
];

const SECRET_LABELS: Record<CredentialRequestSignIn, string> = {
  SSH_KEY: "Private key",
  PASSWORD: "Password",
  OAUTH_CLIENT: "Client secret",
  API_KEY: "API key",
};

function CredentialsForm({ bank, held, onClose }: { bank: BankView; held: CredentialView | null; onClose: () => void }) {
  const sftp = bank.connectionType === "SFTP";
  const queryClient = useQueryClient();
  const [signIn, setSignIn] = useState<CredentialRequestSignIn>(held?.signIn ?? (sftp ? "SSH_KEY" : "OAUTH_CLIENT"));
  const [host, setHost] = useState(held?.host ?? "");
  const [port, setPort] = useState(held?.port ? String(held.port) : "22");
  const [username, setUsername] = useState(held?.username ?? "");
  const [fingerprint, setFingerprint] = useState(held?.hostKeyFingerprint ?? "");
  const [folder, setFolder] = useState(held?.remoteFolder ?? "");
  const [apiBaseUrl, setApiBaseUrl] = useState(held?.apiBaseUrl ?? "");
  const [tokenUrl, setTokenUrl] = useState(held?.tokenUrl ?? "");
  const [clientId, setClientId] = useState(held?.clientId ?? "");
  const [secret, setSecret] = useState("");
  // Typed twice, so a slip of the finger is caught here rather than as a bank refusing the sign-in.
  const [again, setAgain] = useState("");
  // A secret on file is kept unless somebody chooses to replace it; changing how the platform signs in needs a new one.
  const [replacing, setReplacing] = useState(held === null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [shown, setShown] = useState<CredentialView | null>(held);

  const refreshed = (fresh: CredentialView) => {
    setErrors(noErrors);
    setShown(fresh);
    setReplacing(false);
    setSecret("");
    setAgain("");
    setFingerprint(fresh.hostKeyFingerprint ?? "");
    queryClient.setQueryData(getBankCredentialsQueryKey(bank.id), fresh);
    void queryClient.invalidateQueries({ queryKey: getListCredentialStandingsQueryKey() });
  };
  const onError = (error: ApiError) => setErrors(toFormErrors(error));
  const save = useSetBankCredentials<ApiError>({ mutation: { onSuccess: refreshed, onError } });
  const test = useTestBankConnection<ApiError>({ mutation: { onSuccess: refreshed, onError } });
  const busy = save.isPending || test.isPending;
  const needsNewSecret = replacing || signIn !== held?.signIn;

  // Compared as typed but for the spaces round a pasted key, which are not part of it.
  const mismatch = needsNewSecret && again !== "" && again.trim() !== secret.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsNewSecret && again.trim() !== secret.trim()) {
      setErrors({ form: undefined, fields: { again: `The two ${SECRET_LABELS[signIn].toLowerCase()}s are not the same.` } });
      return;
    }
    save.mutate({
      bankId: bank.id,
      data: {
        signIn,
        host: sftp ? host.trim() || null : null,
        port: sftp && port.trim() ? Number(port) : null,
        username: sftp ? username.trim() || null : null,
        hostKeyFingerprint: sftp ? fingerprint.trim() || null : null,
        remoteFolder: sftp ? folder.trim() || null : null,
        apiBaseUrl: sftp ? null : apiBaseUrl.trim() || null,
        tokenUrl: !sftp && signIn === "OAUTH_CLIENT" ? tokenUrl.trim() || null : null,
        clientId: !sftp && signIn === "OAUTH_CLIENT" ? clientId.trim() || null : null,
        secret: needsNewSecret ? secret : null,
      },
    });
  }

  const choices = sftp ? SFTP_SIGN_INS : API_SIGN_INS;
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {shown?.testedAt && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold",
            shown.testOk ? "bg-access-full-soft text-access-full-ink" : "bg-access-none-soft text-access-none-ink",
          )}
        >
          {shown.testOk ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
          <span>
            {shown.testOk ? "Connected" : "Did not connect"} on {formatDateTime(shown.testedAt)} — {shown.testDetail}
          </span>
        </div>
      )}
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        {sftp ? (
          <>
            <Field id="cred-host" label="Host" error={errors.fields.host} className="sm:col-span-2">
              <TextInput {...describedBy("cred-host", errors.fields.host)} id="cred-host" value={host} placeholder="sftp.bank.com"
                onChange={(event) => setHost(event.target.value)} />
            </Field>
            <Field id="cred-port" label="Port" error={errors.fields.port}>
              <TextInput {...describedBy("cred-port", errors.fields.port)} id="cred-port" inputMode="numeric" value={port}
                onChange={(event) => setPort(event.target.value.replace(/[^0-9]/g, ""))} />
            </Field>
            <Field id="cred-user" label="User name" error={errors.fields.username}>
              <TextInput {...describedBy("cred-user", errors.fields.username)} id="cred-user" value={username} autoComplete="off"
                onChange={(event) => setUsername(event.target.value)} />
            </Field>
          </>
        ) : (
          <Field id="cred-base" label="API address" error={errors.fields.apiBaseUrl} className="sm:col-span-2">
            <TextInput {...describedBy("cred-base", errors.fields.apiBaseUrl)} id="cred-base" value={apiBaseUrl}
              placeholder="https://api.bank.com/custody/v2/statements" onChange={(event) => setApiBaseUrl(event.target.value)} />
          </Field>
        )}

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase" id="cred-signin-label">Sign in with</p>
          <div role="radiogroup" aria-labelledby="cred-signin-label" className="inline-flex overflow-hidden rounded-xl border border-line">
            {choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={signIn === choice.value}
                onClick={() => setSignIn(choice.value)}
                className={cn(
                  "px-3 py-2 text-sm font-semibold",
                  signIn === choice.value ? "bg-brand-900 text-on-fill" : "bg-white text-ink-soft hover:bg-slate-50",
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
          {errors.fields.signIn && <p className="mt-1.5 text-xs text-red-600">{errors.fields.signIn}</p>}
        </div>

        {!sftp && signIn === "OAUTH_CLIENT" && (
          <>
            <Field id="cred-token" label="Token address" error={errors.fields.tokenUrl} className="sm:col-span-2">
              <TextInput {...describedBy("cred-token", errors.fields.tokenUrl)} id="cred-token" value={tokenUrl}
                placeholder="https://auth.bank.com/oauth2/token" onChange={(event) => setTokenUrl(event.target.value)} />
            </Field>
            <Field id="cred-client" label="Client ID" error={errors.fields.clientId} className="sm:col-span-2">
              <TextInput {...describedBy("cred-client", errors.fields.clientId)} id="cred-client" value={clientId} autoComplete="off"
                onChange={(event) => setClientId(event.target.value)} />
            </Field>
          </>
        )}

        <Field id="cred-secret" label={SECRET_LABELS[signIn]} error={errors.fields.secret} className="sm:col-span-2">
          {!needsNewSecret && shown ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
              <span className="text-ink-soft">•••••••• set on {formatDate(shown.setAt)} by {shown.setBy}</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => setReplacing(true)}>
                Replace
              </Button>
            </div>
          ) : signIn === "SSH_KEY" ? (
            <SecretArea {...describedBy("cred-secret", errors.fields.secret)} id="cred-secret" rows={5} value={secret}
              what="private key" autoComplete="off" spellCheck={false} className="font-mono text-xs"
              placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n…\n-----END OPENSSH PRIVATE KEY-----"}
              onChange={(event) => setSecret(event.target.value)} />
          ) : (
            <PasswordInput {...describedBy("cred-secret", errors.fields.secret)} id="cred-secret" value={secret}
              what={SECRET_LABELS[signIn].toLowerCase()} autoComplete="new-password"
              placeholder={`Paste the ${SECRET_LABELS[signIn].toLowerCase()}`} onChange={(event) => setSecret(event.target.value)} />
          )}
        </Field>
        {needsNewSecret && (
          <Field id="cred-again" label={`Confirm ${SECRET_LABELS[signIn].toLowerCase()}`}
            error={errors.fields.again ?? (mismatch ? "Not the same as above yet." : undefined)} className="sm:col-span-2">
            {signIn === "SSH_KEY" ? (
              <SecretArea {...describedBy("cred-again", errors.fields.again)} id="cred-again" rows={5} value={again}
                what="private key" autoComplete="off" spellCheck={false} className="font-mono text-xs"
                placeholder="Paste the same key again" onChange={(event) => setAgain(event.target.value)} />
            ) : (
              <PasswordInput {...describedBy("cred-again", errors.fields.again)} id="cred-again" value={again}
                what={SECRET_LABELS[signIn].toLowerCase()} autoComplete="new-password"
                placeholder={`Type the ${SECRET_LABELS[signIn].toLowerCase()} again`} onChange={(event) => setAgain(event.target.value)} />
            )}
          </Field>
        )}

        {sftp && (
          <>
            <Field id="cred-fingerprint" label="Server fingerprint" error={errors.fields.hostKeyFingerprint}
              hint="The platform refuses a server whose fingerprint is not this one. Left empty, it keeps the one it sees first."
              className="sm:col-span-2">
              <TextInput {...describedBy("cred-fingerprint", errors.fields.hostKeyFingerprint)} id="cred-fingerprint" value={fingerprint}
                placeholder="SHA256:…" className="font-mono text-xs" onChange={(event) => setFingerprint(event.target.value)} />
            </Field>
            <Field id="cred-folder" label="Folder the bank puts files in" error={errors.fields.remoteFolder} className="sm:col-span-2">
              <TextInput {...describedBy("cred-folder", errors.fields.remoteFolder)} id="cred-folder" value={folder}
                placeholder="/outgoing" onChange={(event) => setFolder(event.target.value)} />
            </Field>
          </>
        )}
      </div>

      {shown?.testOk && (
        <p className="text-xs text-ink-muted">
          Replacing credentials that work: the new ones are tried first and only take over if they connect; otherwise the old ones stay.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {shown && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => test.mutate({ bankId: bank.id })}>
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
        )}
        <Button type="submit" disabled={busy || mismatch}>
          {save.isPending ? "Saving and testing…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
