import { ApiError } from "@atomprive/api-client";
import {
  getGetPackQueryKey,
  getListPacksToSignQueryKey,
  useSignForm,
  type PackFormRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { SignaturePad } from "./signature-pad";

/** The two ways to sign: type your name, or draw it. Either counts; the record says which was used. */
const WAYS = [
  { value: "TYPED", label: "Type it" },
  { value: "DRAWN", label: "Draw it" },
] as const;

/**
 * Signing one form of a pack. The signature is kept with the signer's name, the moment and where they signed
 * from, which is what an electronic signature rests on afterwards.
 */
export function SignFormDialog({
  packId,
  form,
  open,
  onClose,
}: {
  packId: string;
  form: PackFormRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const user = useStaffUser();
  const queryClient = useQueryClient();
  const sign = useSignForm<ApiError>();
  const [how, setHow] = useState<"TYPED" | "DRAWN">("TYPED");
  const [typed, setTyped] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);

  const signature = how === "TYPED" ? typed.trim() : (drawn ?? "");
  const ready = signature.length > 0;

  function close() {
    setTyped("");
    setDrawn(null);
    setHow("TYPED");
    sign.reset();
    onClose();
  }

  function submit() {
    if (!form || !ready) return;
    sign.mutate(
      { packId, formId: form.formId, data: { signatureKind: how, signature } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPackQueryKey(packId) });
          queryClient.invalidateQueries({ queryKey: getListPacksToSignQueryKey() });
          close();
        },
      },
    );
  }

  return (
    <Dialog open={open && form !== null} onClose={close} title={form ? `Sign ${form.formTitle}` : "Sign"}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          You are signing <span className="font-semibold text-ink">{form?.formTitle}</span> ({form?.reference}) as
          the client's relationship advisor.
        </p>

        {sign.isError && <Alert tone="danger">{sign.error.message}</Alert>}

        <div role="group" aria-label="How to sign" className="flex gap-2">
          {WAYS.map((way) => (
            <button
              key={way.value}
              type="button"
              onClick={() => setHow(way.value)}
              className={cn(
                "h-9 rounded-lg border px-4 text-sm font-semibold transition-colors",
                how === way.value
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-line bg-white text-ink hover:border-primary-600",
              )}
            >
              {way.label}
            </button>
          ))}
        </div>

        {how === "TYPED" ? (
          <Field id="typed-signature" label="Type your full name" required>
            <TextInput
              id="typed-signature"
              value={typed}
              placeholder={user.fullName}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
        ) : (
          <SignaturePad onChange={setDrawn} />
        )}

        <p className="text-xs text-ink-muted">
          Signing as {user.fullName}. The date, the time and the address you sign from are kept with it.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready || sign.isPending}>
            {sign.isPending ? "Signing…" : "Sign"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
