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
- Choosing a new password at first sign-in, with a live checklist of the password rules (#2, #74)
- Choosing a workspace after sign-in for staff holding several roles, and switching later from the user menu (#14)
- Manage staff users and the staff detail view, as designed in Figma; adding or editing a staff member needs every field, and mobile numbers follow the chosen country's rules (#74)
- Permission matrix, as designed in Figma (#75)
- Audit log with search, role, result and date filters, and CSV export, as designed in Figma (#82)
- Config data, as designed in Figma: supported banks, per-bank field mapping with unmapped-field alerts, FX rates and the email template editor; off-boarding approvals arrive with client accounts (#98, #100–#102, N3)
- Client onboarding: the list of cases as designed in Figma, with search by client or relationship manager (suggestions appear as you type) and page numbers, and a step-by-step onboarding form in its own design, with drafts, joint accounts of up to four holders, entity clients and a review step before submitting
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
