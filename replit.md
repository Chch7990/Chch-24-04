# IL Digital Portal

A unified web portal for **PD (IL Digital Product Portal)** and **LUC (Loan Use
Check)** behind a single OTP login + portal hub.

The portal was originally a thin React+Vite shell that loaded two large
single-page HTML apps via iframe with `localStorage` state. It has been
**fully rewritten as a React + TypeScript application backed by Postgres**
so that all PD/LUC data persists across logout/relogin and across devices.

## Stack

Pnpm workspace with three artifacts:

| Artifact | Path | Role |
|---|---|---|
| `artifacts/il-portal` | `/` | React + Vite + wouter + TanStack Query frontend |
| `artifacts/api-server` | `/api` | Express + Drizzle ORM backend |
| `artifacts/mockup-sandbox` | `/__mockup` | Scaffolded; unused for this app |

Shared packages: `lib/db` (Drizzle schema + client).

## Routes (frontend)

- `/login` — Email + OTP login (User or Admin tab)
- `/` — Portal Hub (PD / LUC / Users cards)
- `/users` — User Management (admin only)
- `/pd/*` — PD app
  - User: 12-section application flow with autosave
  - Admin: Dashboard, Master Upload, Other-Loans Upload, Date-wise Download
- `/luc/*` — LUC app
  - User: Field Visit (search client, fill visit, upload photos, submit)
  - Admin: Dashboard, All Data, Add Client, Bulk Upload, Pending,
    Completed, Approvals

Session state lives in `sessionStorage` under `ilPortalSession.v1`. Every
API request carries `x-portal-uid`, `x-portal-name`, `x-portal-branch`,
`x-portal-role` headers; admin-only endpoints additionally require an
`Authorization: Bearer <admin token>`.

## Database (`lib/db`)

Drizzle Postgres tables:

- `users` — managed users that can log in as User role
- `pd_master_clients` — admin-uploaded master roster (one row per Client ID)
- `pd_other_loans` — admin-uploaded existing loans per Client ID
- `pd_applications` — submitted PD applications (owner_uid, status, JSON payload, photos)
- `pd_application_drafts` — one autosave draft per user (PUT debounced from client)
- `luc_clients` — admin-managed LUC client list
- `luc_visits` — field visit records (one per client) with photos JSON, status, approval

Run `pnpm --filter @workspace/db run db:push` to apply schema changes.

## Backend (`artifacts/api-server`)

- `src/lib/auth.ts` — `requireAnyCaller` / `requireAdminCaller` middleware
  that reads the portal headers and (for admin) verifies the bearer token.
- `src/routes/otp.ts` — `POST /api/otp/send`, `POST /api/otp/verify` (User
  emails must be in the managed list; admin emails are open).
- `src/routes/users.ts` — admin-only CRUD + bulk + public lookup.
- `src/routes/pd.ts`
  - `GET/POST /api/pd/master-clients`, `DELETE …/:id`
  - `GET/POST /api/pd/other-loans`
  - `GET/PUT/DELETE /api/pd/draft` — per-user autosave
  - `GET/POST /api/pd/applications`, `GET …/:id`,
    `POST …/:id/status` (admin), `GET /api/pd/applications-stats` (admin)
- `src/routes/luc.ts`
  - `GET/POST/DELETE /api/luc/clients`, `POST …/bulk`,
    `GET …/:clientId` (returns client + existing visit if any)
  - `GET /api/luc/all-data` (joined client + visit)
  - `GET/POST/PATCH /api/luc/visits`, `POST …/approve-all` (admin)
  - `GET /api/luc/stats` (admin)

OTP storage and admin sessions remain in-memory; everything else is in
Postgres. The OTP code is returned in the response (`devCode`) since no
email service is configured.

## Frontend (`artifacts/il-portal`)

- `src/main.tsx` — sets up the QueryClient and wouter Router
- `src/App.tsx` — top-level route gating (redirect to `/login` if no session)
- `src/lib/session.ts`, `src/lib/api.ts`, `src/lib/csv.ts` — shared helpers
- `src/components/{Logo,Shell,Toast}.tsx` — small UI primitives
- `src/pages/Login.tsx`, `src/pages/Hub.tsx`, `src/pages/UserMgmt.tsx`
- `src/pages/luc/*` — LUC layout + 8 page components
- `src/pages/pd/*` — PD layout + admin pages + single multi-section
  `PdUserApp.tsx` that handles all 12 sections with debounced autosave,
  master-client lookup, eligibility live calc, photo upload, and submit.

### PD User Flow

The PD user form is a single component with a sidebar of 12 sections.
Every keystroke schedules a 1-second debounced `PUT /api/pd/draft`. On
mount the draft is loaded; on submit the draft is auto-cleared by the
backend. Master-client lookup pre-fills applicant fields and pulls any
admin-uploaded other-loan rows. Eligibility (FOIR, EMI, eligible loan)
is computed live in `eligibility.ts`.

### LUC User Flow

The LUC user view searches for a client by ID, displays the master
record, and allows submitting (or re-submitting) the visit. Visit data
includes loan-used-in, observation, remark, up to 5 photos, with
admin approval queue.

### Photos

Photos are stored as base64 data URLs inside JSON columns. PD photos use
`{label, data}[]` (max 5); LUC photos use `string[]` (max 5). If size
becomes a concern this can be migrated to object storage.

## Login Flow

- **User Login:** registered email → OTP → Hub.
- **Admin Login:** any email → OTP → Hub with the User Management card.

## User Management (admin only)

From the Portal Hub via the purple **Users** card. Admins can:

- Create individual users (User ID, Name, Email, Branch)
- Bulk upload from CSV (`uid, name, email, branch`) with append/replace
- Download a CSV template
- View, refresh, and delete users

## Development

- Workflows: `api-server` (port 8080) and `il-portal` (port 19360)
- `pnpm --filter @workspace/il-portal exec tsc --noEmit` — type-check the SPA
- `pnpm --filter @workspace/api-server run build` — build the API bundle

## Notes

- Admin sessions and OTPs reset on API server restart; users and PD/LUC
  data persist in Postgres.
- The original `public/pd-app.html` and `public/luc-app.html` iframe
  wrappers have been removed — everything is React now.
