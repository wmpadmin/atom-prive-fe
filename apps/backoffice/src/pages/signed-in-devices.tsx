import { ApiError } from "@atomprive/api-client";
import { useEndSession, useMySessions, type SignedInDevice } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Laptop } from "lucide-react";
import { getMySessionsQueryKey } from "@atomprive/api-client/backoffice";
import { useSession } from "../auth/session";
import { formatDateTime, formatRelative } from "../lib/labels";

/**
 * Everywhere this person is signed in, and the way to shut one.
 *
 * <p>The point of the screen is a device somebody no longer has. A session lasts days, so a laptop left at
 * an airport is signed in until somebody ends it, and until now the only way was to change the password —
 * which ends every session including the one being read on, and tells a colleague nothing about why.
 *
 * <p>The device is named from what the browser said about itself. It is rough on purpose: enough for
 * somebody to recognise their own, and not a fingerprint.
 */
export function SignedInDevices() {
  const devices = useMySessions<SignedInDevice[], ApiError>();
  const queries = useQueryClient();
  const { signOut } = useSession();

  const end = useEndSession<ApiError>({
    mutation: {
      onSuccess: (_answer, variables) => {
        // Ending the one being read on signs them out here too, which is what somebody on a borrowed
        // machine means by it. Anything else just refreshes the list.
        if (variables.id === devices.data?.find((one) => one.thisDevice)?.id) {
          void signOut();
          return;
        }
        void queries.invalidateQueries({ queryKey: getMySessionsQueryKey() });
      },
    },
  });

  if (devices.isError) {
    return <Alert tone="danger">{devices.error.message}</Alert>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Everywhere you are signed in. Ending one signs that device out at once; it does not change your
        password.
      </p>
      {devices.isPending && <p className="text-sm text-ink-muted">Reading your devices…</p>}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {(devices.data ?? []).map((device) => (
          <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Laptop aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {device.device}
                {device.thisDevice && <Badge tone="info">This device</Badge>}
              </p>
              <p className="text-xs text-ink-muted">
                {device.ipAddress ?? "Address not recorded"} · last used {formatRelative(device.lastActiveAt)}
                {" · signed in "}
                {formatDateTime(device.signedInAt)}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={end.isPending}
              onClick={() => end.mutate({ id: device.id })}
            >
              {device.thisDevice ? "Sign out here" : "End"}
            </Button>
          </li>
        ))}
      </ul>
      {end.isError && <Alert tone="danger">{end.error.message}</Alert>}
    </div>
  );
}
