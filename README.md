# Atom Privé web apps

Frontend for the Atom Privé wealth management platform: a React 19 and TypeScript pnpm workspace. The API is in the separate `atom-prive-be` project.

| Folder | What's in it |
| --- | --- |
| `apps/backoffice` | Back-office for Admin, Advisor, Compliance and Operations staff, on http://localhost:5174 |
| `apps/portal` | Customer portal, on http://localhost:5173 (a starting shell for now) |
| `packages/ui` | Shared components and design tokens (Tailwind CSS 4, Plus Jakarta Sans) |
| `packages/api-client` | Typed TanStack Query hooks, generated from the API's OpenAPI documents with Orval |

## Built so far

- Back-office sign-in; the access token stays in memory and a refresh cookie restores the session after a reload (#8)
- Choosing a new password at first sign-in, with a live checklist of the password rules (#2, #74)
- Manage staff users and the user detail page, as designed in Figma (#74)
- Permission matrix, as designed in Figma (#75)
- Audit log with search, role, result and date filters, and CSV export, as designed in Figma (#82)
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
