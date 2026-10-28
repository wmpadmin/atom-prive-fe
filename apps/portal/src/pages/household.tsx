/**
 * Two people, drawn rather than fetched.
 *
 * <p>Inline, so the one decorative thing on the page cannot be the one thing that fails to load — this
 * page is opened once, by somebody who has never seen the firm's software, and a broken image in the
 * middle of it is the worst possible first impression of a private bank.
 */
export function Household({ className = "mx-auto h-24 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 104"
      role="img"
      aria-label="Two members of a family"
      className={className}
    >
      <ellipse cx="80" cy="95" rx="54" ry="7" fill="#dbeafe" />
      <circle cx="118" cy="40" r="26" fill="#eff6ff" />
      {/* The taller of the two, behind. */}
      <path d="M44 104c0-20 9-31 22-31s22 11 22 31z" fill="#1d4ed8" />
      <circle cx="66" cy="57" r="14" fill="#f8c9a8" />
      <path d="M52 55a14 14 0 0 1 28 0c0-11-5-16-14-16s-14 5-14 16z" fill="#3f2a1d" />
      <path d="M44 104c0-13 4-22 11-27l11 13 11-13c7 5 11 14 11 27z" fill="#2563eb" />
      {/* The younger, in front. */}
      <path d="M86 104c0-15 7-23 16-23s16 8 16 23z" fill="#93c5fd" />
      <circle cx="102" cy="68" r="11" fill="#f8c9a8" />
      <path d="M91 66a11 11 0 0 1 22 0c0-9-4-13-11-13s-11 4-11 13z" fill="#5b3a26" />
      <path d="M86 104c0-10 3-16 8-20l8 9 8-9c5 4 8 10 8 20z" fill="#bfdbfe" />
    </svg>
  );
}

