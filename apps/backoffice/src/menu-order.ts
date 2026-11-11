/**
 * The order the sidebar lists its screens in.
 *
 * <p>An order rather than a shape. Which heading a screen sits under in the sidebar is menu-groups.ts's to say;
 * under each heading the screens keep the order written here.
 *
 * <p>The order is the order the work is done in, not the order the entries happen to be declared in:
 * your own first screen, then managing money against a plan, then what is waiting on an answer, then
 * everything that begins with a client and reads forward from one, then the trails those leave, and last
 * the firm's own setup — read when a question is asked rather than worked every morning.
 *
 * <p>One list for every role, including the Admin: their menu is written out by hand elsewhere, but it is
 * still ordered by this file, so a path named here is placed by this file wherever it appears.
 *
 * <p>A name here that no menu entry answers to orders nothing, and is worth deleting rather than
 * leaving: read on its own, this file is the only place that says what the menu holds, and a name it
 * keeps after the entry has gone says the screen is still in the menu when it is reachable by nothing
 * but a typed address. Model risk sat here like that.
 *
 * <p>A screen left out of this list is not hidden. It is drawn after the ones named here, in whatever
 * order it was declared — because a menu built only from a hand-written list loses a screen the day
 * somebody adds one and forgets this file, which has happened here before: two approval queues existed,
 * worked, and could be reached by nothing but a typed address.
 */
export const MENU_ORDER: string[] = [
  "/dashboard",

  // The portfolio desk's own book, in the order the desk works it: the whole book at a glance, who is on a
  // plan, what the plans are, how they are doing, who has wandered off one, and putting them back.
  "/book-overview", "/client-directory", "/book", "/portfolio-clients", "/model-portfolios", "/model-performance", "/drift", "/bulk-rebalancing",
  // What the desk reads back off its book: management information, then the client reports. Reports was further
  // down, after the paper, until the sidebar put the two under one heading on 11 Nov 2026; only the portfolio
  // desk has it, so moving it here moves nobody else's menu.
  "/mis", "/reports",

  // What follows is one order serving three desks at once, written from the firm's own list for each.
  // It works because the three barely overlap: where two of them hold the same screen they want it in
  // the same place, and where they disagree it is over screens only one of them can open at all.
  //
  //   Compliance        KYC review queue, All clients, KYC document review, What KYC asks for,
  //                     Trails, Family access trail, Audit log
  //   Relationship mgr  Assigned customers, Approvals, Client documents, To sign, Trade logs
  //   Operations        Approvals, All clients, Forms, Client documents, Post onboarding notice,
  //                     Ingestion monitoring, Sync errors
  //
  // Each desk's first screen first: the queue Compliance works every morning, the book a relationship
  // manager opens on, and the queue Operations answers.
  "/client-management", "/kyc", "/my-clients", "/approvals",

  // Then the client, and the two reviews that decide whether the firm may act for them at all.
  "/clients", "/kyc-documents", "/kyc-checklist",

  // Then the paper: what is filled in, what is held, what is signed, and what is sent after.
  "/forms", "/client-documents", "/to-sign", "/trade-logs", "/post-onboarding",

  // Then the feeds, which are Operations' own and are watched rather than worked.
  "/ingestion", "/sync-errors", "/holdings-check",

  // Then the reads that come back off all of it — what was traded, who saw what, who did what. Looked
  // at when a question is asked, rather than worked every morning, so they sit under the work.
  "/trails", "/family-access-trail", "/audit-log",

  // Then the rest of the client's file, and what the platform will print.
  "/deactivation-requests", "/archived-clients", "/aml-risk",

  // Then what exists before any client does and would still exist with none: the firm's own setup and
  // the people who run it.
  "/config", "/roles", "/users", "/notifications",
  "/staff-declarations", "/staff-tracker", "/portfolio-settings",

  // A person's own account, which is nobody's work and everybody's last entries.
  "/my-clearances", "/my-declarations", "/assistant", "/settings",
];
