import { ApiError } from "@atomprive/api-client";
import {
  getStaffSessionsQueryKey,
  useSignStaffOut,
  useStaffSessions,
  type SignedInDevice,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { roleLabels, type StaffRole } from "../../lib/labels";
import { formatRelative } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { ConfirmDialog } from "../config/confirm-dialog";

/** The day named, because "Mon 27 Oct" answers "when was this?" in a way "27/10" does not. */
const dayAndDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const clockTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

/** The loopback addresses, which every sign-in on the same machine as the server comes from. */
const THIS_MACHINE = new Set(["::1", "0:0:0:0:0:0:0:1", "127.0.0.1", "0:0:0:0:0:0:0:1%0"]);

/**
 * Whether a session came from the machine the platform is running on.
 *
 * <p>In development everything is on one machine, so every sign-in is from the loopback address and no
 * lookup can say anything about it. Said as "This machine" rather than left as "Unknown place", which
 * would read as a lookup that failed.
 */
function isThisMachine(ipAddress: string) {
  return THIS_MACHINE.has(ipAddress);
}

function when(at: string) {
  const on = new Date(at);
  return { day: dayAndDate.format(on), time: clockTime.format(on) };
}

/**
 * Where a member of staff is signed in, and the way an Admin ends it.
 *
 * <p>Live sessions only. One that has ended is not a device somebody is using, and a list that kept them
 * would be a list nobody could read at a glance — what became of them is on the audit log, with who ended
 * it and why.
 *
 * <p>The session the Admin is reading this in is never offered an end. Signing yourself out of the window
 * you are working in is not something anybody means to press, and their own Settings is there for when it is.
 */
export function StaffSessions({ userId, name }: { userId: string; name: string }) {
  const queryClient = useQueryClient();
  const mayEnd = hasAuthority(useStaffUser(), "MANAGE_USERS_AND_ROLES:CHANGE");
  const sessions = useStaffSessions<SignedInDevice[], ApiError>(userId);
  const [ending, setEnding] = useState<"all" | null>(null);
  const [wrong, setWrong] = useState<string>();

  const signOut = useSignStaffOut<ApiError>({
    mutation: {
      onSuccess: async () => {
        setWrong(undefined);
        setEnding(null);
        await queryClient.invalidateQueries({ queryKey: getStaffSessionsQueryKey(userId) });
      },
      onError: (caught) => {
        setWrong(caught.message);
        setEnding(null);
      },
    },
  });

  if (sessions.isPending) return <p className="text-sm text-ink-muted">Reading their sessions…</p>;
  if (sessions.isError) return <Alert tone="danger">{sessions.error.message}</Alert>;

  const live = sessions.data;
  if (live.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center text-sm text-ink-muted">
        {name} is not signed in anywhere.
      </p>
    );
  }
  // Their own window does not count towards what can be ended, so the button does not offer to end nothing.
  const endable = live.filter((device) => !device.thisDevice).length;

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-base font-bold">Where {name} is signed in</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Live sessions only. Ending one signs that device out at once.
          </p>
        </div>
        {mayEnd && endable > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setEnding("all")}>
            Sign out everywhere
          </Button>
        )}
      </div>

      {wrong && (
        <div className="px-5 pt-4">
          <Alert tone="danger">{wrong}</Alert>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th className="px-5 py-2.5">Device</th>
              <th className="px-4 py-2.5">Where from</th>
              <th className="px-4 py-2.5">Signed in</th>
              <th className="px-4 py-2.5">Last active</th>
              <th className="px-4 py-2.5">Working as</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {live.map((device) => {
              const started = when(device.signedInAt);
              const seen = when(device.lastActiveAt);
              return (
                <tr key={device.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {/* "Unknown device" means the browser named nothing, which is what a sign-in made by
                          something other than a browser looks like. Said as that rather than as a name. */}
                      {device.device === "Unknown device" ? (
                        <span className="text-ink-muted italic">Not a browser</span>
                      ) : (
                        device.device
                      )}
                      {device.thisDevice && <Badge tone="success">This device</Badge>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {device.ipAddress === null ? (
                      <span className="text-ink-muted italic">Not recorded</span>
                    ) : (
                      <>
                        {/* The place first, because that is what somebody is actually asking; the address
                            under it, because it is the thing that identifies the session. */}
                        <span className="block font-semibold text-ink">
                          {device.location ?? (isThisMachine(device.ipAddress) ? "This machine" : "Unknown place")}
                        </span>
                        <span className="block font-mono text-ink-muted">{device.ipAddress}</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="block font-semibold">{started.day}</span>
                    <span className="block text-xs text-ink-muted">{started.time}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="block font-semibold">{formatRelative(device.lastActiveAt, "—")}</span>
                    <span className="block text-xs text-ink-muted">
                      {seen.day}, {seen.time}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {device.workingAs ? roleLabels[device.workingAs as StaffRole] : "Not chosen"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {mayEnd && !device.thisDevice && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={signOut.isPending}
                        onClick={() => signOut.mutate({ id: userId, params: { sessionId: device.id } })}
                      >
                        Sign out
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">
        {live.length} live {live.length === 1 ? "session" : "sessions"}. Last active is read from the token
        refresh, so it is accurate to about a quarter of an hour. Ended sessions stay on the audit log.
        A session that names no browser and no address was not made from one — an API client signs in
        without either. Where a sign-in came from is worked out when the session starts and kept as it was.
      </p>

      <ConfirmDialog
        open={ending === "all"}
        title={`Sign ${name} out everywhere?`}
        description={`${endable} ${endable === 1 ? "device is" : "devices are"} signed in. They will have to sign in again.`}
        confirmLabel="Sign them out"
        tone="danger"
        onConfirm={() => signOut.mutate({ id: userId, params: {} })}
        onClose={() => setEnding(null)}
      />
    </section>
  );
}
