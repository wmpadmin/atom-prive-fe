import { ApiError } from "@atomprive/api-client";
import {
  getMeQueryKey,
  getNotificationsQueryKey,
  getPreferencesQueryKey,
  useChooseNotifications,
  useChoosePreferences,
  useFamily,
  useMe,
  useMySecurity,
  useNotifications,
  useParticulars,
  usePreferences,
  useRemoveMyPhoto,
  useUploadMyPhoto,
  type Me,
  type MyFamily,
  type MyNotifications,
  type MyParticulars,
  type MyPreferences,
  type SecurityView,
} from "@atomprive/api-client/portal";
import { Alert, SelectInput, Switch } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Camera,
  CalendarDays,
  Clock,
  Coins,
  IdCard,
  KeyRound,
  Languages,
  Laptop,
  Lock,
  PencilLine,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { initialsOf } from "../lib/money";
import { day } from "./figures";

/**
 * The client's own Settings in the new look: who the firm has them down as, what they are told about, how their
 * screens are written, and a summary of their security and family with the way into each.
 *
 * <p>Most of it is read-only on purpose. Their name, email, date of birth and address are the identity the firm
 * has verified, and changing them is a desk's job with a reason and an audit entry behind it — so the screen
 * offers "Ask to change", which reaches their relationship manager, rather than a box to type in. What is theirs
 * to change here is their photograph, what they are told about and how figures and dates are shown to them.
 */
export function SettingsPage() {
  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Your details, your preferences and what we tell you about.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Profile />
        <Notifications />
        <Particulars />
        <Preferences />
        <Security />
        <Family />
      </div>
    </div>
  );
}

function Panel({ icon: Icon, title, lead, action, children, className = "" }: {
  icon: LucideIcon;
  title: string;
  lead: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-48 flex-1">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One line of a panel: an icon, what it is, a note under it, and a control or a value at the right. */
function Line({ icon: Icon, title, note, children }: { icon: LucideIcon; title: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
      <Icon aria-hidden="true" className="size-4.5 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {note && <span className="block text-xs text-ink-muted">{note}</span>}
      </span>
      {children}
    </li>
  );
}

function Loading() {
  return <div className="h-32 animate-pulse rounded-xl bg-canvas" />;
}

const askToChange = (
  <Link
    to="/new/support"
    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-canvas"
  >
    <PencilLine aria-hidden="true" className="size-3.5" /> Ask to change
  </Link>
);

/** Who they are, their face, and who looks after them. The photograph is the one thing here that is theirs. */
function Profile() {
  const queryClient = useQueryClient();
  const me = useMe<Me, ApiError>();
  const particulars = useParticulars<MyParticulars, ApiError>();
  const file = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const done = {
    mutation: {
      onSuccess: () => {
        setProblem(null);
        void queryClient.invalidateQueries({ queryKey: getMeQueryKey() });
      },
      onError: (failed: ApiError) => setProblem(failed.message),
    },
  };
  const upload = useUploadMyPhoto<ApiError>(done);
  const remove = useRemoveMyPhoto<ApiError>(done);
  const busy = upload.isPending || remove.isPending;
  const data = me.data;
  const kind = particulars.data?.kind === "ENTITY" ? "Entity" : "Individual";

  return (
    <Panel
      icon={UserRound}
      title="Profile information"
      lead="Held by the firm. Your relationship manager changes it for you."
      action={askToChange}
      className="bg-linear-to-br from-primary-50/60 to-white"
    >
      {me.isError && <Alert tone="danger">{me.error.message}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-6 px-1 pb-2">
            <div className="relative shrink-0">
              {data.photo ? (
                <img src={data.photo} alt="" className="size-24 rounded-full object-cover" />
              ) : (
                <span className="flex size-24 items-center justify-center rounded-full bg-brand-900 text-2xl font-bold text-on-fill">
                  {initialsOf(data.fullName)}
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => file.current?.click()}
                aria-label={data.photo ? "Choose a new photo" : "Upload a photo"}
                className="absolute right-0 bottom-1 flex size-8 items-center justify-center rounded-full bg-white text-ink-soft shadow-md hover:text-ink disabled:opacity-60"
              >
                <Camera aria-hidden="true" className="size-4" />
              </button>
              {/* The browser's own file control cannot be styled; the camera stands in for it. */}
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = "";
                  if (chosen) upload.mutate({ data: { file: chosen } });
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-ink">{data.fullName}</p>
              <p className="mt-1 truncate text-sm text-ink-soft">{data.email ?? "No email on file"}</p>
              <p className="mt-1.5 text-xs text-ink-muted">
                <span className="tabular-nums">{data.code}</span> · {kind} · client since {day(data.joinedOn)}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Relationship manager: {particulars.data?.relationshipManager ?? "not assigned yet"}
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span>{upload.isPending ? "Uploading…" : remove.isPending ? "Removing…" : "Your photo: JPEG, PNG or WebP, up to 5 MB."}</span>
            {data.photo && !busy && (
              <button type="button" onClick={() => remove.mutate()} className="font-semibold text-red-700 hover:underline">
                Remove photo
              </button>
            )}
          </div>
          {problem && <p role="alert" className="mt-2 text-xs text-red-700">{problem}</p>}
        </>
      )}
    </Panel>
  );
}

const SWITCHES = [
  ["accessRequests", KeyRound, "Access requests", "Somebody asks to see one of your accounts."],
  ["accessDecisions", Bell, "Answers to what you asked", "A family member approves or refuses your request."],
  ["familyChanges", Users, "Family group changes", "Somebody joins or leaves, or asks to be called something else."],
  ["accountActivity", Laptop, "Account access activity", "A family member reads an account you have shared."],
] as const;

/**
 * What they want to be told about, saved the moment a switch is pressed.
 *
 * <p>All four every time, never one: a payload carrying a single switch would read as "leave the rest alone" here
 * and as "turn the rest off" to the server. Not drawn until the server has answered, because four switches drawn
 * off would tell the client they had asked to be told nothing.
 */
function Notifications() {
  const queryClient = useQueryClient();
  const held = useNotifications<MyNotifications, ApiError>();
  const choose = useChooseNotifications<ApiError>({
    mutation: { onSuccess: (saved) => queryClient.setQueryData(getNotificationsQueryKey(), saved) },
  });
  const shown = held.data;

  return (
    <Panel icon={Bell} title="Notifications" lead="Choose what we tell you about. Nothing is sent out of the platform yet; your choices are kept for when it is.">
      {held.isError && <Alert tone="danger">{held.error.message}</Alert>}
      {choose.isError && <Alert tone="danger">{choose.error.message}</Alert>}
      {!shown ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {SWITCHES.map(([key, icon, title, note]) => (
            <Line key={key} icon={icon} title={title} note={note}>
              <Switch
                on={shown[key]}
                label={title}
                busy={choose.isPending}
                onChange={(on) => choose.mutate({ data: { ...shown, [key]: on } })}
              />
            </Line>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const countries = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string | null) {
  if (!code) return null;
  try {
    return countries.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The person — or for an entity, the organisation — the firm has on file. Read-only; see the class note. */
function Particulars() {
  const me = useMe<Me, ApiError>();
  const particulars = useParticulars<MyParticulars, ApiError>();
  const data = particulars.data;
  const entity = data?.kind === "ENTITY";
  const rows: [string, string | null][] = !data
    ? []
    : entity
      ? [
          ["Organisation", data.organisation],
          ["Country of incorporation", countryName(data.countryOfIncorporation)],
          ["Incorporated on", data.incorporatedOn ? day(data.incorporatedOn) : null],
          ["Registration number", data.registrationNumber],
          ["Mobile", me.data?.mobile ?? null],
          ["Registered address", data.address],
        ]
      : [
          ["Date of birth", data.dateOfBirth ? day(data.dateOfBirth) : null],
          ["Nationality", countryName(data.nationality)],
          ["Mobile", me.data?.mobile ?? null],
          ["Residential address", data.address],
        ];

  return (
    <Panel
      icon={IdCard}
      title={entity ? "Organisation details" : "Personal details"}
      lead="From your client file. To change any of it, ask your relationship manager."
    >
      {particulars.isError && <Alert tone="danger">{particulars.error.message}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-semibold break-words text-ink">{value ?? "Not on file"}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

const DATE_FORMATS = [
  ["DAY_MONTH_YEAR", "5 Nov 2026 (the firm's)"],
  ["DD_MM_YYYY", "DD/MM/YYYY"],
  ["MM_DD_YYYY", "MM/DD/YYYY"],
  ["YYYY_MM_DD", "YYYY-MM-DD"],
] as const;

/** The zones the firm's clients mostly live in. One they chose that is not here is offered too. */
const ZONES = [
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Zurich",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

/** "(GMT+04:00) Dubai", worked out for today so summer time reads right. */
function zoneLabel(zone: string) {
  const offset =
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const city = zone === "UTC" ? "Coordinated Universal Time" : (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  return `(${offset === "GMT" ? "GMT+00:00" : offset}) ${city}`;
}

/**
 * How figures and dates are shown to them, saved the moment one is picked.
 *
 * <p>Every change sends all four answers, for the same reason the switches do. Saving draws the portal again in
 * the new way, which is the confirmation; there is nothing else to press.
 */
function Preferences() {
  const queryClient = useQueryClient();
  const held = usePreferences<MyPreferences, ApiError>();
  const choose = useChoosePreferences<ApiError>({
    mutation: { onSuccess: (saved) => queryClient.setQueryData(getPreferencesQueryKey(), saved) },
  });
  const data = held.data;
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = data?.timeZone && !ZONES.includes(data.timeZone) ? [data.timeZone, ...ZONES] : ZONES;

  const save = (change: Partial<{ reportingCurrency: string | null; dateFormat: string; timeZone: string | null }>) => {
    if (!data) return;
    choose.mutate({
      data: {
        reportingCurrency: data.reportingCurrency,
        dateFormat: data.dateFormat,
        timeZone: data.timeZone,
        language: data.language,
        ...change,
      },
    });
  };
  const box = "w-full sm:w-60";

  return (
    <Panel icon={SlidersHorizontal} title="Preferences" lead="How figures and dates are shown to you. Your statements and the firm's records do not change.">
      {held.isError && <Alert tone="danger">{held.error.message}</Alert>}
      {choose.isError && <Alert tone="danger">{choose.error.message}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          <Line
            icon={Coins}
            title="Reporting currency"
            note={data.reportingCurrency ? "Your portfolio's figures, restated at today's rate." : "Figures are shown in the currency your portfolio is held in."}
          >
            <SelectInput
              aria-label="Reporting currency"
              className={box}
              disabled={choose.isPending}
              value={data.reportingCurrency ?? ""}
              onChange={(event) => save({ reportingCurrency: event.target.value || null })}
            >
              <option value="">Your portfolio's own</option>
              {data.currencies.map((one) => (
                <option key={one.code} value={one.code}>
                  {one.code} — {one.name}
                </option>
              ))}
            </SelectInput>
          </Line>
          <Line icon={CalendarDays} title="Date format">
            <SelectInput
              aria-label="Date format"
              className={box}
              disabled={choose.isPending}
              value={data.dateFormat}
              onChange={(event) => save({ dateFormat: event.target.value })}
            >
              {DATE_FORMATS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </Line>
          <Line icon={Clock} title="Time zone" note="Times in your activity and logs are read against this clock.">
            <SelectInput
              aria-label="Time zone"
              className={box}
              disabled={choose.isPending}
              value={data.timeZone ?? ""}
              onChange={(event) => save({ timeZone: event.target.value || null })}
            >
              <option value="">This device's ({deviceZone.replace(/_/g, " ")})</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zoneLabel(zone)}
                </option>
              ))}
            </SelectInput>
          </Line>
          <Line icon={Languages} title="Language" note="English is the only language today.">
            <SelectInput aria-label="Language" className={box} disabled value="en" onChange={() => undefined}>
              <option value="en">English</option>
            </SelectInput>
          </Line>
        </ul>
      )}
    </Panel>
  );
}

/** A summary of their security, with the way to the page that changes it. */
function Security() {
  const security = useMySecurity<SecurityView, ApiError>();
  const data = security.data;
  const sessions = data?.signedIn.length ?? 0;
  const go = "shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-canvas";

  return (
    <Panel icon={Lock} title="Security" lead="Keep your account secure.">
      {security.isError && <Alert tone="danger">{security.error.message}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          <Line icon={KeyRound} title="Password" note={`Last changed ${day(data.passwordChangedAt)}`}>
            <Link to="/new/security" className={go}>
              Change password
            </Link>
          </Line>
          <Line
            icon={ShieldCheck}
            title="Two-factor authentication (authenticator app)"
            note={data.authenticatorOn ? "Required by the firm, so it cannot be turned off." : "You set it up the next time you sign in."}
          >
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${data.authenticatorOn ? "bg-access-full-soft text-access-full-ink" : "bg-access-view-soft text-access-view-ink"}`}
            >
              {data.authenticatorOn ? "On" : "Not set up"}
            </span>
          </Line>
          <Line icon={Laptop} title="Where you're signed in" note={`${sessions} active ${sessions === 1 ? "session" : "sessions"}`}>
            <Link to="/new/security" className={go}>
              Manage
            </Link>
          </Line>
        </ul>
      )}
    </Panel>
  );
}

/** Who is in their family group, with the way to Family & Access where it is managed. */
function Family() {
  const family = useFamily<MyFamily, ApiError>();
  const people = family.data?.people ?? [];

  return (
    <Panel
      icon={Users}
      title="Family members"
      lead="Your family group, and who can see what."
      action={
        <Link
          to="/new/family-access"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-canvas"
        >
          <Users aria-hidden="true" className="size-3.5" /> Manage family
        </Link>
      }
    >
      {family.isError && <Alert tone="danger">{family.error.message}</Alert>}
      {!family.data ? (
        <Loading />
      ) : people.length === 0 ? (
        <p className="text-sm text-ink-muted">You are not in a family group.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {people.map((one) => (
            <li key={one.id} className="flex items-center gap-3 py-2.5">
              {one.photo ? (
                <img src={one.photo} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-canvas text-xs font-bold text-ink-soft">
                  {initialsOf(one.fullName)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {one.fullName}
                {one.you && <span className="font-normal text-ink-muted"> (you)</span>}
              </span>
              <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                {one.primaryHolder ? "Primary holder" : (one.relationshipToPrimary ?? one.relationship ?? "Family member")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
