import type { StaffUserRequest } from "@atomprive/api-client/backoffice";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { noErrors, type FormErrors } from "../../lib/api-errors";
import type { StaffRole } from "../../lib/labels";
import { checkMobileNumber, invalidMobileMessage, mobileCountry } from "../../lib/mobile-numbers";

/**
 * Every detail is required to add or edit a staff member, in the order the form shows them, except who they report to,
 * which Admins don't have. The API sends the same messages.
 */
const requiredMessages = {
  fullName: "Enter their full name.",
  email: "Enter their work email.",
  phone: "Enter their mobile number.",
  nationality: "Choose their nationality.",
  residentialAddress: "Enter their residential address.",
  designation: "Enter their designation.",
  employmentStart: "Choose their employment start date.",
  reportsToId: "Choose who they report to.",
  licenceNumber: "Enter their licence number.",
  roles: "Choose at least one role.",
  nationalId: "Enter their PAN ID or EID.",
  passportNumber: "Enter their passport number.",
} as const;

type ProfileField = keyof typeof requiredMessages;

/** Reads the staff form, with a message for every field that's empty or, for the mobile number, breaks the rules. */
export function readStaffProfile(form: HTMLFormElement, roles: StaffRole[], reportsToId: string) {
  const values = new FormData(form);
  const text = (name: string) => String(values.get(name) ?? "").trim();
  const country = mobileCountry(text("phoneCountry")).code;
  const mobile = checkMobileNumber(country, text("phone"));
  const data: StaffUserRequest = {
    fullName: text("fullName"),
    email: text("email"),
    phone: mobile.number ?? "",
    roles,
    nationality: text("nationality"),
    residentialAddress: text("residentialAddress"),
    designation: text("designation"),
    // The declarations register shows these two; neither is asked for, so a blank one stays blank.
    department: text("department") || null,
    employeeId: text("employeeId") || null,
    employmentStart: text("employmentStart"),
    reportsToId: reportsToId || null,
    licenceNumber: text("licenceNumber"),
    nationalId: text("nationalId"),
    passportNumber: text("passportNumber"),
  };
  const missing: Record<string, string> = {};
  for (const field of Object.keys(requiredMessages) as ProfileField[]) {
    if (field === "phone" && mobile.problem === "invalid") {
      missing.phone = invalidMobileMessage(country);
    } else if (field === "reportsToId" && roles.includes("ADMIN")) {
      // Admins run the firm, so they report to nobody.
    } else if ((data[field] ?? "").length === 0) {
      missing[field] = requiredMessages[field];
    }
  }
  return { data, missing };
}

/**
 * What the server refused, ready to show. Problems about fields the form doesn't show — such as the manager an Admin
 * doesn't have — are said at the top instead, so nothing is refused silently.
 */
export function errorsToShow(form: HTMLFormElement | null, errors: FormErrors): FormErrors {
  const hidden = Object.entries(errors.fields).filter(([name]) => !form?.elements.namedItem(name));
  if (hidden.length === 0) {
    return errors;
  }
  return { ...errors, form: errors.form ?? hidden.map(([, message]) => message).join(" ") };
}

/** Puts the cursor in the first field with a problem, which may be scrolled out of view in a long form. */
export function focusFirstError(form: HTMLFormElement | null, errors: Record<string, string>) {
  const field = form?.elements.namedItem(Object.keys(errors)[0] ?? "");
  // Roles are several checkboxes sharing one name.
  const target = field instanceof RadioNodeList ? field[0] : field;
  if (target instanceof HTMLElement) {
    target.focus();
  }
}

/**
 * What the Add and Edit staff forms share: field errors, and which required fields are still to complete, so the
 * save button can stay off until nothing is.
 */
export function useStaffProfileForm(roles: StaffRole[], reportsToId: string) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [edits, setEdits] = useState(0);
  const [incomplete, setIncomplete] = useState<Record<string, string>>({});

  // Checked after each change has rendered, so it reads what the fields settled on (extra digits in a mobile
  // number, for example, are refused).
  useEffect(() => {
    if (formRef.current) {
      setIncomplete(readStaffProfile(formRef.current, roles, reportsToId).missing);
    }
  }, [edits, roles, reportsToId]);

  function setFieldError(field: string, message: string | undefined) {
    setErrors((current) => {
      if (current.fields[field] === message) return current;
      const fields = { ...current.fields };
      if (message) {
        fields[field] = message;
      } else {
        delete fields[field];
      }
      return { ...current, fields };
    });
  }

  /** A field's old message goes as soon as it's changed. */
  function handleChange(event: FormEvent<HTMLFormElement>) {
    const { name } = event.target as HTMLInputElement;
    setFieldError(name === "phoneCountry" ? "phone" : name, undefined);
    setErrors((current) => (current.form ? { ...current, form: undefined } : current));
    setEdits((count) => count + 1);
  }

  /** For fields that change without a change event, such as the date picker. */
  function fieldChanged(field: string) {
    setFieldError(field, undefined);
    setEdits((count) => count + 1);
  }

  /** Shows the message on every field still to complete and moves to the first of them. */
  function showIncomplete() {
    setErrors({ fields: incomplete });
    focusFirstError(formRef.current, incomplete);
  }

  return { formRef, errors, setErrors, setFieldError, fieldChanged, incomplete, handleChange, showIncomplete };
}
