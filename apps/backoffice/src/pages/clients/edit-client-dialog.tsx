import type { ApiError } from "@atomprive/api-client";
import {
  getGetClientKycFileQueryKey,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useUpdateClient,
  type CustomerDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, describedBy, Dialog, Field, Note, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { CountrySelect } from "../../components/country-select";
import { MobileNumberInput } from "../../components/mobile-number-input";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDate } from "../../lib/labels";
import { mobileNumberMessage } from "../../lib/mobile-numbers";
import { clientKindLabels, kycStatusLabels } from "./client-labels";

type Client = CustomerDetail["client"];

interface EditClientDialogProps {
  client: Client | null;
  onClose: () => void;
  onSaved: (saved: CustomerDetail, moved: boolean) => void;
}

/**
 * Puts a client's details right: what the firm calls them, how it reaches them, and where they live. Operations
 * only — Operations entered the client, so Operations correct what they entered.
 *
 * <p>One dialog, because to whoever opens it there is one question: are these details right? What separates the
 * changes inside it is evidence. A name, an email or a number is corrected on the strength of the timeline
 * alone. A changed address is a move — it is part of the client's KYC — so the new proof of address is asked
 * for the moment the address is touched, and the two are sent and recorded together.
 *
 * <p>The rest of the record is here too, shown as it stands rather than hidden, so whoever opens this can see
 * the whole file and see which parts of it a correction does not touch. Those are not details somebody typed
 * in: they are what the firm concluded from the client's papers, and what the documents already signed, the
 * timeline and the regulator all read back.
 */
export function EditClientDialog({ client, onClose, onSaved }: EditClientDialogProps) {
  return (
    <Dialog
      open={client !== null}
      onClose={onClose}
      // Wide, because the whole of a client's details is a long form in a narrow column: the address alone is
      // six boxes, and a form that has to be scrolled to be read is a form whose end nobody reads.
      size="lg"
      title="Edit client"
      description="Changes are recorded on the client's timeline with your name."
    >
      {/* Keyed on the client so every field starts from the file that was opened, rather than keeping what was
          typed into the last one. */}
      {client && <Details key={client.id} client={client} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function Details({ client, onClose, onSaved }: { client: Client } & Omit<EditClientDialogProps, "client">) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  // The number is kept with its country code, the way it is stored and sent: +919876543210.
  const [phone, setPhone] = useState(client.phone ?? "");
  const [address, setAddress] = useState(() => ({
    line1: client.address.line1 ?? "",
    line2: client.address.line2 ?? "",
    city: client.address.city ?? "",
    state: client.address.state ?? "",
    postalCode: client.address.postalCode ?? "",
    country: client.address.country ?? "",
  }));
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  // Touching the address is somebody saying the client has moved, and a move is the one change here that the
  // firm has to see a paper for. So the question appears the moment it is true, and not before.
  const moved = (Object.keys(address) as (keyof typeof address)[]).some(
    (part) => address[part] !== (client.address[part] ?? ""),
  );

  const save = useUpdateClient<ApiError>({
    mutation: {
      onSuccess: async (saved) => {
        queryClient.setQueryData(getGetCustomerQueryKey(saved.client.id), saved);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() }),
          // A move puts a new paper on their file, so what their papers say has changed too.
          queryClient.invalidateQueries({ queryKey: getGetClientKycFileQueryKey(saved.client.id) }),
        ]);
        setErrors(noErrors);
        onSaved(saved, moved);
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const badNumber = phone ? mobileNumberMessage(phone) : undefined;
    const proofOfAddress = fileRef.current?.files?.[0];
    const problems: Record<string, string> = {};
    if (badNumber) problems.phone = badNumber;
    if (moved && !proofOfAddress) {
      problems.proofOfAddress = "Attach the new proof of address. A change of address is recorded with it.";
    }
    if (Object.keys(problems).length > 0) {
      setErrors({ fields: problems });
      return;
    }
    setErrors(noErrors);
    save.mutate({
      id: client.id,
      data: {
        fullName: String(form.get("fullName")),
        email: String(form.get("email")).trim() || null,
        phone: phone || null,
        line1: address.line1 || null,
        line2: address.line2 || null,
        city: address.city || null,
        state: address.state || null,
        postalCode: address.postalCode || null,
        country: address.country || null,
        // Only a move carries one; the API asks for it only when the address has actually changed.
        proofOfAddress: proofOfAddress ?? null,
      },
    });
  }

  const set = (patch: Partial<typeof address>) => setAddress((was) => ({ ...was, ...patch }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fullName" label="Full name" error={errors.fields.fullName} className="sm:col-span-2">
          <TextInput {...describedBy("fullName", errors.fields.fullName)} name="fullName" defaultValue={client.fullName} required autoFocus />
        </Field>
        <Field id="email" label="Email" error={errors.fields.email} hint="How the client signs in to the portal.">
          <TextInput {...describedBy("email", errors.fields.email)} name="email" type="email" defaultValue={client.email ?? ""} />
        </Field>
        <Field id="phone" label="Mobile" error={errors.fields.phone} hint="How the firm reaches the client.">
          <MobileNumberInput
            {...describedBy("phone", errors.fields.phone)}
            id="phone"
            value={phone}
            onChange={setPhone}
            onBlur={() => setErrors((was) => ({ ...was, fields: withOne(was.fields, "phone", phone && mobileNumberMessage(phone)) }))}
          />
        </Field>
      </div>

      <section className="space-y-3 border-t border-line pt-4">
        <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Where they live</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Line id="line1" label="Address Line 1" placeholder="House or flat number and street" value={address.line1} onChange={(line1) => set({ line1 })} error={errors.fields.line1} wide />
          <Line id="line2" label="Address Line 2" placeholder="Building, area or district" value={address.line2} onChange={(line2) => set({ line2 })} error={errors.fields.line2} />
          <Line id="city" label="City" value={address.city} onChange={(city) => set({ city })} error={errors.fields.city} />
          <Line id="state" label="State" value={address.state} onChange={(state) => set({ state })} error={errors.fields.state} />
          <Line id="postalCode" label="Postal Code" value={address.postalCode} onChange={(postalCode) => set({ postalCode })} error={errors.fields.postalCode} />
          <Field id="country" label="Country" error={errors.fields.country}>
            <CountrySelect {...describedBy("country", errors.fields.country)} id="country" value={address.country} onChange={(country) => set({ country })} />
          </Field>
        </div>
        {moved && (
          <div className="grid gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:grid-cols-2 sm:items-start">
            <Field id="proofOfAddress" label="New proof of address" required error={errors.fields.proofOfAddress}>
              <input
                ref={fileRef}
                id="proofOfAddress"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:bg-slate-50"
              />
            </Field>
            {/* Where a client lives is part of their KYC, so the firm's proof of it is a document Compliance
                approved. Replacing it is not a quiet correction, and the screen says so before it happens. */}
            <Note>
              A move is recorded against a fresh proof of address — PDF, JPEG or PNG, up to 10 MB. Saving puts it
              on their file and sends them back to Compliance. Forms filled in from here on carry the new address.
            </Note>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-line bg-canvas px-4 py-3">
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <Fixed label="Client code">
            <span className="font-mono text-xs">{client.code}</span>
          </Fixed>
          <Fixed label="Account held">{clientKindLabels[client.clientType]}</Fixed>
          <Fixed label="Registered">{formatDate(client.registeredAt)}</Fixed>
          <Fixed label="KYC documents">{kycStatusLabels[client.kycStatus]}</Fixed>
        </dl>
        {/* None of this was typed in. The codes are quoted on every document already on file; the
            application settled what kind of account it is; the KYC moves when Compliance decide on one. */}
        <Note className="mt-2">
          Fixed on this file: these came off the client's application and their papers, so nothing here reaches
          them. KYC moves when Compliance decide on one.
        </Note>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/** The field messages with one of them either added or, once it reads properly, taken away again. */
function withOne(fields: FormErrors["fields"], name: string, message: string | undefined | "") {
  const { [name]: _was, ...rest } = fields;
  return message ? { ...rest, [name]: message } : rest;
}

/** One line of the address, starting from what the file says today so only what moved has to be retyped. */
function Line({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  wide,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <Field id={id} label={label} error={error} className={wide ? "sm:col-span-2" : undefined}>
      <TextInput {...describedBy(id, error)} id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </Field>
  );
}

/** One detail of the file that nothing on this form reaches, read as it stands. */
function Fixed({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-ink-muted">{label}:</dt>
      <dd className="text-xs font-semibold text-ink-soft">{children}</dd>
    </div>
  );
}
