import { Alert, Button, Dialog, Field, TextInput, cn } from "@atomprive/ui";
import { useState } from "react";
import { useStaffUser } from "../auth/session";
import { SignaturePad } from "../pages/to-sign/signature-pad";
import type { MadeSignature } from "../pages/forms/made-signature";

const WAYS = [
  { value: "TYPED", label: "Type it" },
  { value: "DRAWN", label: "Draw it" },
] as const;

/**
 * Signing one place on a document. Nothing here is required of anybody: a document can be sent, kept or
 * printed with its signature places still empty, and a signature already made can be changed or taken off.
 *
 * Operations sign for a client often enough that it is the way this opens — the paper then says, under the
 * signature, who actually made it and who it was made for, rather than passing it off as the client's own hand.
 */
export function SignHereDialog({
  spot,
  who,
  forName,
  made,
  onClose,
  onSigned,
}: {
  /** The place on the paper being signed, or null when nothing is being signed. */
  spot: string | null;
  /** Whose signature the paper asks for here, in its own words: "the client", "the firm". */
  who: string;
  /** Who that is by name, where we know it: the client this document is for. */
  forName?: string;
  /** The signature already in this place, which this reopens to be changed or taken off. */
  made: MadeSignature | null;
  onClose: () => void;
  /** Called with the signature, or with null to take one off. */
  onSigned: (signature: MadeSignature | null) => void;
}) {
  return (
    <Dialog open={spot !== null} title={made ? "Change this signature" : "Sign here"} onClose={onClose}>
      {/* Keyed by the place, so opening another one starts it as that place was left. */}
      {spot && (
        <Signing key={spot} who={who} forName={forName} made={made} onClose={onClose} onSigned={onSigned} />
      )}
    </Dialog>
  );
}

function Signing({
  who,
  forName,
  made,
  onClose,
  onSigned,
}: {
  who: string;
  forName?: string;
  made: MadeSignature | null;
  onClose: () => void;
  onSigned: (signature: MadeSignature | null) => void;
}) {
  const user = useStaffUser();
  const [how, setHow] = useState<"TYPED" | "DRAWN">(made?.kind ?? "TYPED");
  const [typed, setTyped] = useState(made?.kind === "TYPED" ? made.signature : "");
  const [drawn, setDrawn] = useState(made?.kind === "DRAWN" ? made.signature : "");
  // Every signature made here is made for somebody — the client, or the firm — and saying so is what allows
  // it to be made at all. Nothing is ever recorded as if the signer were that person.
  const [onTheirBehalf, setOnTheirBehalf] = useState(Boolean(made?.forWhom));
  const [wrong, setWrong] = useState("");

  function sign() {
    const signature = how === "TYPED" ? typed.trim() : drawn;
    if (!signature) {
      setWrong(how === "TYPED" ? "Type the name to sign with." : "Draw the signature before signing.");
      return;
    }
    if (!onTheirBehalf) {
      setWrong(`Say that you are signing on behalf of ${who} before signing.`);
      return;
    }
    onSigned({
      kind: how,
      signature,
      signerName: user.fullName,
      forWhom: who,
      at: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-4">
        {wrong && <Alert tone="danger">{wrong}</Alert>}

        <p className="text-sm text-ink-muted">
          The paper asks for the signature of <span className="font-semibold text-ink">{who}</span>
          {forName ? <> — {forName}</> : null}. Nothing has to be signed here: this can be left empty.
        </p>

        <div className="flex gap-2">
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
          <Field id="signature-name" label="The name to sign with">
            <TextInput
              id="signature-name"
              value={typed}
              placeholder={forName ?? user.fullName}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
        ) : (
          <SignaturePad onChange={(drawing) => setDrawn(drawing ?? "")} />
        )}

        <label
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
            onTheirBehalf ? "border-line bg-canvas" : "border-primary-600 bg-primary-50",
          )}
        >
          <input
            type="checkbox"
            checked={onTheirBehalf}
            onChange={(event) => {
              setOnTheirBehalf(event.target.checked);
              setWrong("");
            }}
            className="mt-0.5 size-4 rounded border-line text-primary-600"
          />
          <span>
            I am signing on behalf of {who}
            <span className="block text-xs text-ink-muted">
              {onTheirBehalf
                ? `The document records it as signed by ${user.fullName} for ${who}.`
                : `This has to be said before the document can be signed.`}
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          {made && (
            <Button variant="ghost" onClick={() => onSigned(null)}>
              Take it off
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={sign} disabled={!onTheirBehalf}>
            {made ? "Change it" : "Sign"}
          </Button>
      </div>
    </div>
  );
}
