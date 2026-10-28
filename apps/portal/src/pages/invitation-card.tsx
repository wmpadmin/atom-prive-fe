import { when } from "../lib/dates";

/**
 * The invitation itself, as the person being asked reads it.
 *
 * <p>One component for both ways of arriving. Somebody the firm already banks with answers this from their
 * notifications; somebody who has never heard of the firm answers it from a link in their inbox. The two
 * have different front doors and no account between them, but the thing they are being asked is identical,
 * and drawing it twice is how the two come to say different things about the same decision.
 */
export function InvitationCard({
  clientName,
  clientPhoto,
  familyName,
  relationship,
  invitedAt,
  personalMessage,
  children,
}: {
  clientName: string;
  clientPhoto?: string | null;
  /** Null where the asker is still on their own account: the firm has not named a family of one. */
  familyName?: string | null;
  relationship: string;
  invitedAt: string;
  personalMessage?: string | null;
  /** The two answers, which differ by where this is being read. */
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6">
      <div className="flex items-center gap-4">
        <Face name={clientName} photo={clientPhoto} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{clientName}</p>
          <p className="text-sm text-slate-500">has invited you to join their family group</p>
        </div>
      </div>

      <dl className="mt-6 space-y-3.5">
        {/* Said rather than left out. A row with nothing in it reads as a fault; "not named yet" is true. */}
        <Fact icon={<GroupMark />} label="Family group">
          {familyName ?? "Not named yet"}
        </Fact>
        <Fact icon={<PersonMark />} label="Your relationship">
          {relationship}
        </Fact>
        <Fact icon={<DayMark />} label="Invited on">
          {when(invitedAt)}
        </Fact>
      </dl>

      {personalMessage && (
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Message</p>
          <blockquote className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 italic">
            &ldquo;{personalMessage}&rdquo;
          </blockquote>
        </div>
      )}

      {/* Before they answer, not after. Joining a family account is not being given sight of it, and
          somebody pressing Accept will assume otherwise unless they are told here. */}
      <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
        Accepting puts you in the family group. It does not give you sight of {clientName}&rsquo;s money —
        the firm shares that separately, if at all.
      </p>

      {children}
    </div>
  );
}

/**
 * Somebody's face, or their initials.
 *
 * <p>Initials off a name the firm holds rather than off an email address: this is a person the one reading
 * it is meant to recognise, and two letters of their actual name help where two of their inbox do not.
 */
export function Face({
  name,
  photo,
  small,
  size,
}: {
  name: string;
  photo?: string | null;
  small?: boolean;
  /** A size of its own, for a caller that has to fit the face to a row it did not choose. */
  size?: string;
}) {
  const box = size ?? (small ? "size-10 text-xs" : "size-14 text-base");
  if (photo) {
    return <img src={photo} alt="" className={`${box} shrink-0 rounded-full object-cover`} />;
  }
  const parts = name.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`${box} grid shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700`}
    >
      {initials}
    </span>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2.5 text-sm text-slate-500">
        <span aria-hidden="true" className="text-slate-400 [&_svg]:size-4">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="text-sm font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

/**
 * The three small marks beside the facts, drawn here.
 *
 * <p>Inline rather than from an icon package. This app carries no icon dependency and three shapes are not
 * a reason to take one on — the same reasoning that drew the family on the setting-up page.
 */
function GroupMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 5.6M18 20a6.5 6.5 0 0 0-2-4.7" />
    </svg>
  );
}

function PersonMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function DayMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

/**
 * What just happened, said once and plainly.
 *
 * <p>One way on rather than two. The design this follows offers a dashboard as well, and there is no
 * dashboard — the family group is the whole of this portal today, so sending somebody to a page that does
 * not exist to celebrate joining one would be a poor first minute.
 */
export function Joined({
  familyName,
  relationship,
  children,
}: {
  familyName: string;
  relationship: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid size-16 place-items-center rounded-full bg-green-100 text-3xl text-green-600"
      >
        ✓
      </span>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">You&rsquo;ve joined {familyName}</h1>
      <p className="mt-2 text-sm text-slate-600">
        You are now a member of <b>{familyName}</b> as a <b>{relationship.toLowerCase()}</b>.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Everything you do in this family is recorded in your own name.
      </p>
      <div className="mt-6 space-y-2">{children}</div>
    </div>
  );
}
