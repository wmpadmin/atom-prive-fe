# Atom Privé web apps

Frontend for the Atom Privé wealth management platform: a React 19 and TypeScript pnpm workspace. The API is in the separate `atom-prive-be` project.

| Folder | What's in it |
| --- | --- |
| `apps/backoffice` | Back-office for Admin, Advisor, Compliance, Operations and Portfolio Manager staff, on http://localhost:5174 |
| `apps/portal` | Customer portal, on http://localhost:5173 (a starting shell for now) |
| `packages/ui` | Shared components and design tokens (Tailwind CSS 4, Plus Jakarta Sans) |
| `packages/api-client` | Typed TanStack Query hooks, generated from the API's OpenAPI documents with Orval |

## Built so far

- Back-office sign-in; the access token stays in memory and a refresh cookie restores the session after a reload (#8)
- "Continue with Google" on the sign-in page (#74), shown only when an Admin has set a Google client ID on the API. It replaces the password step and still leads to the authenticator code
- Authenticator app as the second step of every sign-in (#74): a QR code to scan the first time, with the key to type in by hand as well, then the 6-digit code on each sign-in. Wrong codes say how many tries are left, and five of them lock sign-in for an hour
- Choosing a new password at first sign-in, with a live checklist of the password rules (#2, #74)
- "Forgot your password?" (#2), **switched off for now** and shown only when the API says it is on: ask for a link by email, then choose a new password on the page it opens, with the same rules checklist. A link that has been used or has run out says so and offers a new one
- Choosing a workspace after sign-in for staff holding several roles, and switching later from the user menu (#14)
- Manage staff users and the staff detail view, as designed in Figma; adding or editing a staff member needs every field, and mobile numbers follow the chosen country's rules (#74)
- Permission matrix, as designed in Figma (#75)
- Audit log with search, role, result and date filters, and CSV export, as designed in Figma (#82)
- Config data, as designed in Figma: supported banks, per-bank field mapping with unmapped-field alerts, FX rates and the email template editor; off-boarding approvals arrive with client accounts (#98, #100–#102, N3)
- Forms: every form in the client pack as one list — the form, the categories it is used by, and a way to move it between them. Forms themselves are asked for on a client's onboarding case, under Client documents. A form opens as a step-by-step wizard grouped by the sections of the paper document, with that section's own instructions shown before it is filled in, details we already hold filled in for you, drafts that save as you go, a review step, and then Send to the client, which asks when their signed copy is expected back. A form that has gone out is read-only — opening it shows what was sent — with Edit to open it again — which asks first, then clears everything typed into it and the old due date, leaving only what the client's own record already gave, so the form is completed and sent afresh. Nothing is marked by hand: a form is Pending until it is sent, then Waiting on client with View beside it, Overdue once its date passes, and Done only when the client's signed copy comes in — which no one here can set by hand.
- An onboarding case has two tabs: Client view, the application as submitted, and Client documents, the onboarding checklist, which fills itself with everything that category of client needs — forms to fill in and send, and agreements to send out as they stand — each form with when it was asked for, when it's due ("in 11d", "9d overdue"), whether it's pending, out with the client or complete, and Fill, View or Chase beside it. Operations submit the case for KYC sign-off from the header; Compliance sign it off or send it back with a reason
- Client onboarding: the list of cases as designed in Figma, with search by client or relationship manager (suggestions appear as you type) and page numbers, and a step-by-step onboarding form in its own design, with drafts, joint accounts of up to four holders, entity clients and a review step before submitting
- Admin dashboard (#76), where Admins land: figures counted from what is recorded, the newest audit entries and system health
- Bank syncs (#50, #79, #81) and the Notification log (#99): filterable tables of every bank pull and every email sent
- Family access and proposal trails (#73, #94): the audit log narrowed to those events
- Advisor screens (#77, #86, #87): My clients — only those assigned to them — and Proposals, with tabs for drafts, with the manager, with the client, expiring soon, approved, rejected and expired. Writing a proposal picks from their own clients; a sent one is read-only, and an expired one offers to be sent again
- Client file (#78): tabs for profile, family group, bank accounts, holdings, transactions, proposals, documents and activity. The ones with data are filled in; the rest say what they are waiting for rather than showing an empty box. Read-only unless you can change every client, when an Edit client dialog corrects the name, email and KYC status
- All clients (#77), for Admins: paginated list with avatar, name, email, client code, registration date, KYC status, advisor and last login; search with suggestions, KYC status, advisor and registration date filters. Linked banks fill in with the bank work
- Client page and advisor assignment (#80): advisor chips on All clients ("Default" until someone is assigned), Assign advisor on a row or for several ticked clients, and a client page where advisors are added and taken off. The Portfolio download waits for bank data, and a Columns button chooses which columns to show
- Menu items and screens only shown to people allowed to use them (#85)

## Prerequisites

- Node.js 24 and pnpm 12 (`npm install -g pnpm@12`)
- The API from `atom-prive-be` running on http://localhost:8080 (see its README). In development, Vite forwards every `/api` request to it.

## Run it locally

```bash
pnpm install
pnpm dev:backoffice
```

Open http://localhost:5174 and sign in with a back-office account.

## Everyday commands

| Task | Command |
| --- | --- |
| Back-office dev server | `pnpm dev:backoffice` |
| Customer portal dev server | `pnpm dev:portal` |
| Lint, types, build | `pnpm lint && pnpm typecheck && pnpm build` |
| Regenerate the API client after an endpoint changes | start the API, then `pnpm api:generate` |

`pnpm api:generate` reads the API at http://localhost:8080; for one elsewhere, run `API_URL=http://host:port pnpm api:generate`. The generated client in `packages/api-client/src/generated` is committed, so the apps build without a running API.

The API address used by the dev servers is the `server.proxy` setting in each app's `vite.config.ts`.

## Screen sizes

The Figma screens are drawn on a 1920 × 1080 frame. The back-office ties its root font size to the window width (`apps/backoffice/src/index.css`), so a laptop shows the same layout Figma shows when it fits the frame to the screen, and small text stops shrinking at a readable size. Size new screens with Tailwind's rem-based classes such as `text-sm`, `p-6` or `text-2xs`, not fixed pixels like `text-[13px]`, which wouldn't scale.
