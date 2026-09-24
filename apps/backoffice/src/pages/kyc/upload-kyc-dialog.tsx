import { ApiError } from "@atomprive/api-client";
import {
  getGetClientKycFileQueryKey,
  getListKycDocumentsQueryKey,
  useUploadKycDocument,
  type KycDocumentRowKind,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, Field, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

/** What the firm asks a client for, in the order it usually asks. */
const KINDS: { value: KycDocumentRowKind; label: string }[] = [
  { value: "PASSPORT", label: "Passport" },
  { value: "NATIONAL_ID", label: "National ID" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
  { value: "SOURCE_OF_FUNDS", label: "Source of funds" },
  { value: "SOURCE_OF_WEALTH", label: "Source of wealth" },
  { value: "OTHER", label: "Other" },
];

function yearsFromToday(years: number) {
  const now = new Date();
  return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
}

/**
 * Puts one of a client's papers on file. Compliance upload on the client's behalf until the customer portal is
 * built and they can hand it over themselves.
 */
export function UploadKycDialog({
  customerId,
  clientName,
  open,
  onClose,
}: {
  customerId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const upload = useUploadKycDocument<ApiError>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<KycDocumentRowKind>("PASSPORT");
  const [reference, setReference] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [problem, setProblem] = useState<string>();

  function send(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setProblem("Choose the file to put on file.");
      return;
    }
    upload.mutate(
      {
        customerId,
        data: { file },
        params: {
          kind,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(expiresOn ? { expiresOn } : {}),
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetClientKycFileQueryKey(customerId) });
          void queryClient.invalidateQueries({ queryKey: getListKycDocumentsQueryKey() });
          setReference("");
          setExpiresOn("");
          if (fileRef.current) fileRef.current.value = "";
          onClose();
        },
        onError: (caught) => setProblem(caught.message),
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Add a document for ${clientName}`}>
      <form onSubmit={send} className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}

        <Field id="kyc-kind" label="What it is" required>
          <SelectInput
            id="kyc-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as KycDocumentRowKind)}
          >
            {KINDS.map((one) => (
              <option key={one.value} value={one.value}>
                {one.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field id="kyc-reference" label="Reference" hint="The number the document itself carries, where it has one.">
          <TextInput
            id="kyc-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="K1234567A"
          />
        </Field>

        <Field id="kyc-expires" label="Expires" hint="Leave blank where the document doesn't run out.">
          <DateInput
            id="kyc-expires"
            name="expiresOn"
            value={expiresOn}
            clearable
            min={yearsFromToday(0)}
            max={yearsFromToday(20)}
            onChange={setExpiresOn}
          />
        </Field>

        <Field id="kyc-file" label="The file" required hint="A PDF, JPEG or PNG, up to 10 MB.">
          <input
            ref={fileRef}
            id="kyc-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:bg-slate-50"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Put on file"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
