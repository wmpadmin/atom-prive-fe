import { ApiError, openEventStream } from "@atomprive/api-client";
import {
  getListMyNotificationsQueryKey,
  useListMyNotifications,
  useReadEveryNotification,
  useReadNotification,
  type BellItem,
  type BellPage,
} from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { formatRelative } from "../lib/labels";

/**
 * How often the bell asks anyway, with the live channel open.
 *
 * <p>Long, because it is no longer how anything arrives — it is what catches a nudge that was missed while
 * the connection was down, between the server dropping it and the browser opening another. Left out
 * entirely, a reader whose connection failed quietly would hear nothing until they reloaded.
 */
const ASK_ANYWAY_EVERY = 300_000;

/** How long to wait before opening the connection again after it drops. */
const BEFORE_RECONNECTING = 5_000;

/**
 * The bell (#R84): what this member of staff has been told, newest first, with the unread count on it.
 *
 * <p>What lands here is whatever was worth an email — a case handed to Compliance, a proposal waiting for a
 * sign-off, a feed that has been failing — so the work reaches the person on the screen they are already
 * looking at rather than only in an inbox.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const bell = useListMyNotifications<BellPage, ApiError>(
    { unreadOnly: false },
    { query: { refetchInterval: ASK_ANYWAY_EVERY, refetchOnWindowFocus: true } },
  );

  // Told the moment something arrives, rather than finding out on the next ask. What comes down the wire is
  // a nudge and not the notification itself, so the list is still read the one way it has always been read
  // — which keeps who may see what in a single place.
  useEffect(() => {
    const stopped = new AbortController();
    let reopen: ReturnType<typeof setTimeout> | undefined;
    let listening = true;

    const listen = () => {
      openEventStream("/api/backoffice/bell/stream", (event) => {
        if (event === "bell") {
          void queryClient.invalidateQueries({ queryKey: getListMyNotificationsQueryKey({ unreadOnly: false }) });
        }
      }, stopped.signal)
        .catch(() => {
          // A dropped connection is ordinary: a laptop closing, a proxy timing out, the server restarting.
        })
        .finally(() => {
          // Opened again on a timer rather than at once, so a server that is down is not asked in a loop.
          if (listening) {
            reopen = setTimeout(listen, BEFORE_RECONNECTING);
          }
        });
    };
    listen();

    return () => {
      listening = false;
      clearTimeout(reopen);
      stopped.abort();
    };
  }, [queryClient]);
  const kept = (page: BellPage) => queryClient.setQueryData(bell.queryKey ?? [], page);
  const read = useReadNotification<ApiError>({ mutation: { onSuccess: kept } });
  const readEverything = useReadEveryNotification<ApiError>({ mutation: { onSuccess: kept } });

  // Clicking anywhere else, or pressing Escape, closes it.
  useEffect(() => {
    if (!open) return;
    const elsewhere = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", elsewhere);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", elsewhere);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const unread = bell.data?.unread ?? 0;
  const items = bell.data?.items ?? [];

  function opened(item: BellItem) {
    setOpen(false);
    if (!item.readAt) read.mutate({ id: item.id });
    if (item.link) void navigate(item.link);
  }

  return (
    <div ref={holder} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread === 0 ? "Notifications" : `Notifications, ${unread} unread`}
        onClick={() => setOpen((current) => !current)}
        className="relative grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[0.625rem] font-bold text-on-accent">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-20 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-line bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                disabled={readEverything.isPending}
                onClick={() => readEverything.mutate()}
                className="text-xs font-semibold text-primary-700 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-muted">
                Nothing yet. What needs your attention turns up here.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => opened(item)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left hover:bg-canvas",
                        !item.readAt && "bg-primary-50/60",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          item.readAt ? "bg-transparent" : "bg-primary-600",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm text-ink", !item.readAt && "font-semibold")}>
                          {item.title}
                        </span>
                        {item.body && <span className="mt-0.5 block truncate text-xs text-ink-muted">{item.body}</span>}
                        <span className="mt-0.5 block text-2xs text-ink-muted">{formatRelative(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
