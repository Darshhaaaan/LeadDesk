# LeadDesk

A full-stack lead management app built with Express, Prisma, PostgreSQL, React, Tailwind CSS, and Recharts. It includes secure cookie-based authentication, CSRF protection, transactional email, user-scoped lead CRUD, pipeline analytics, and permanent account deletion.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database setup and migrations](#database-setup-and-migrations)
- [Running locally](#running-locally)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [Leads: filtering, sorting, and pagination](#leads-filtering-sorting-and-pagination)
- [Transactional email](#transactional-email)
- [Frontend](#frontend)
- [Testing](#testing)
- [Deployment](#deployment)
- [Account deletion and data retention](#account-deletion-and-data-retention)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

## Features

- **Authentication**: registration, login, logout, session lookup, password reset, password change, and account deletion.
- **Secure sessions**: HTTP-only JWT cookies, bcrypt password hashing, token-version invalidation, rate limiting, and CSRF double-submit validation.
- **Transactional email**: welcome, password-reset, password-changed, and account-deleted emails with responsive HTML, plain-text alternatives, and safe failure handling.
- **Lead management**: authenticated CRUD, strict per-user ownership, search, status/date filters, stable sorting, bounded pagination, activity history, and pipeline statistics.
- **Dashboard**: totals, status breakdown, 30-day creation trend, and upcoming follow-ups rendered with Recharts.
- **Account settings**: password changes and permanent account deletion with current-password confirmation plus a typed confirmation phrase.
- **Accessible UI**: keyboard-friendly dialogs, form validation, loading/empty/error states, and responsive layouts.
- **Automated coverage**: 94 API, email, cookie, ownership, CSRF, and cascade tests.

## Tech stack

| Layer | Technology |
| --- | --- |
| API | Node.js, Express 4, TypeScript |
| Database | PostgreSQL, Prisma 7 |
| Auth | `jsonwebtoken`, `bcryptjs`, HTTP-only cookies |
| Validation | Zod |
| Email | Nodemailer with responsive HTML/plain-text templates |
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4, Recharts 3, lucide-react |
| Tests | Vitest, Supertest |

## Project structure

```text
.
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── components/       # UI kit, shell, dialogs, route guards
│       ├── context/          # AuthProvider and session state
│       ├── lib/              # API client, types, formatting, notices
│       ├── pages/            # Auth, dashboard, leads, detail, settings, 404
│       ├── App.tsx
│       └── main.tsx
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── config/env.ts         # Environment validation
│   ├── emails/               # Layout and email templates
│   ├── lib/                  # Cookies, JWT, errors, response helpers
│   ├── middleware/           # Auth, CSRF, rate limits
│   ├── routes/               # Auth and lead routes
│   ├── services/             # Auth, email, and lead business logic
│   ├── validation/           # Zod schemas
│   ├── app.ts
│   └── server.ts
├── tests/
├── .env.example
├── package.json
└── vitest.config.ts
```

## Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 8)
- npm
- PostgreSQL 14 or newer (local, Neon, Supabase, RDS, etc.)

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `BACKEND_URL` in `.env`. SMTP settings are optional in development.

4. Generate the Prisma client and apply migrations:

   ```bash
   npm run db:generate
   npm run db:deploy
   ```

5. Start the API and frontend in separate terminals:

   ```bash
   npm run dev
   ```

   ```bash
   npm run dev:client
   ```

6. Open <http://localhost:5173>, create an account, and add a lead.

During development, Vite proxies `/api` to `http://localhost:3001`, so the browser sees a same-origin API and cookies work without extra configuration.

## Environment variables

All backend variables are validated at startup by `src/config/env.ts`. Invalid or incomplete values stop the process with a clear error.

### Core

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test`, or `production`. |
| `PORT` | No | `3001` | API port. |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | — | JWT signing secret, at least 32 characters. |
| `JWT_EXPIRES_IN` | No | `15m` | JWT lifetime (`15m`, `1h`, `7d`, etc.). |
| `FRONTEND_URL` | Yes | — | Validated public frontend origin. Used for CORS and every email link. |
| `BACKEND_URL` | Yes | — | Public backend origin. |
| `AUTH_COOKIE_NAME` | No | `auth_token` | HTTP-only auth cookie name. |
| `CSRF_COOKIE_NAME` | No | `csrf_token` | CSRF cookie name. |

### Branding and support

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `APP_NAME` | No | `LeadDesk` | Product name used in email subjects, headers, and footers. |
| `SUPPORT_EMAIL` | Production only | — | Reply-to and support link address. Required in production. |

### SMTP

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SMTP_HOST` | Production only | — | SMTP server hostname. |
| `SMTP_PORT` | No | `587` | SMTP port. |
| `SMTP_SECURE` | No | Port-based | `true` for implicit TLS (usually 465); `false` for STARTTLS (usually 587). |
| `SMTP_USER` | Production only | — | SMTP username. |
| `SMTP_PASS` | Production only | — | SMTP password. |
| `SMTP_FROM` | Production only | — | Verified sender address. |
| `SMTP_REPLY_TO` | No | `SUPPORT_EMAIL` | Optional Reply-To address. |

`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` must be supplied together. Supplying only some of them is a startup error.

### Frontend (Vite)

Vite reads `.env` from the project root (`envDir` is set to the repository root).

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | No | empty | API origin for separately hosted deployments. Leave blank for same-origin requests. |
| `VITE_DEV_API_TARGET` | No | `http://localhost:3001` | Dev proxy target used by `npm run dev:client`. |

> `VITE_*` values are embedded at build time. Rebuild the frontend after changing them.

## Database setup and migrations

Prisma is configured in `prisma.config.ts` and loads `.env` automatically.

```bash
# Generate the client into src/generated/prisma
npm run db:generate

# Apply committed migrations (development, staging, production)
npm run db:deploy

# Create and apply a new migration while developing
npm run db:migrate -- --name describe_the_change
```

The lead migration (`20261026050138_add_leads_and_activity`) is additive: it creates the `Lead` and `LeadActivity` tables, enums, indexes, and foreign keys without altering or deleting existing users.

### Test database

Tests force their own connection settings in `src/test/setup.ts` and never use the development database:

```text
postgresql://postgres@localhost:6000/task_auth_test?schema=public
```

Create that database and apply migrations before running tests. Adjust the URL in `src/test/setup.ts` if your local test database differs. For example:

```powershell
$env:DATABASE_URL="postgresql://postgres@localhost:6000/task_auth_test?schema=public"
npm run db:deploy
```

```bash
DATABASE_URL="postgresql://postgres@localhost:6000/task_auth_test?schema=public" npm run db:deploy
```

## Running locally

| Command | Purpose |
| --- | --- |
| `npm run dev` | API with TypeScript watch mode on port 3001. |
| `npm run dev:client` | Vite dev server on port 5173 with `/api` proxy. |
| `npm run build` | Type-check backend and frontend, then build the client into `dist/`. |
| `npm start` | Start the API from `src/server.ts` with `tsx`. |

The API and frontend are separate processes in development. The API must be running before the frontend can log in or load data.

## API reference

Base path: `/api`. All responses use a consistent envelope.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please provide a valid email address."
  }
}
```

### Authentication and CSRF

Authentication uses an HTTP-only cookie named `auth_token`. The API also issues a readable `csrf_token` cookie.

1. Call `GET /api/auth/csrf`. The response body contains `data.csrfToken`.
2. Send that value in the `X-XSRF-TOKEN` header on every `POST`, `PATCH`, and `DELETE` request.
3. Send cookies with every request (`credentials: 'include'` in browsers).

`POST /api/auth/register` is the only CSRF-exempt write because a brand-new user has no session yet. All other state-changing routes require both authentication (where applicable) and CSRF validation.

> When the frontend and API are on different origins in development, the readable CSRF cookie may be unavailable. The bundled frontend therefore caches the token from the `/api/auth/csrf` response body and uses that value, refetching once if the API returns `403 CSRF_ERROR`.

Example using `curl` and `jq`:

```bash
# 1. Get a CSRF cookie + token
CSRF=$(curl -s -c cookies.txt http://localhost:3001/api/auth/csrf | jq -r '.data.csrfToken')

# 2. Register (no CSRF required)
curl -s -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex Morgan","email":"alex@example.com","password":"Password1","confirmPassword":"Password1"}' \
  http://localhost:3001/api/auth/register

# 3. Login (CSRF required; refresh the token if needed)
curl -s -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-XSRF-TOKEN: $CSRF" \
  -d '{"email":"alex@example.com","password":"Password1"}' \
  http://localhost:3001/api/auth/login
```

### Auth endpoints

| Method | Path | Auth | CSRF | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/auth/csrf` | No | — | Issue/refresh a CSRF token. |
| `POST` | `/api/auth/register` | No | Exempt | Create an account, set the auth cookie, send a welcome email. |
| `POST` | `/api/auth/login` | No | Yes | Authenticate and set the auth cookie. |
| `POST` | `/api/auth/logout` | No | Yes | Increment `tokenVersion`, clear the auth cookie. |
| `GET` | `/api/auth/me` | Yes | — | Return the current safe user profile. |
| `POST` | `/api/auth/forgot-password` | No | Yes | Create a single-use reset token and email a link. Always returns a generic response. |
| `POST` | `/api/auth/reset-password` | No | Yes | Consume a reset token, update the password, invalidate all sessions, send a security email. |
| `POST` | `/api/auth/change-password` | Yes | Yes | Verify the current password, update it, invalidate all sessions, clear the cookie, send a security email. |
| `DELETE` | `/api/auth/account` | Yes | Yes | Verify the current password, permanently delete the account and all owned data, clear the cookie, send a confirmation email. |

Registration body:

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "password": "Password1",
  "confirmPassword": "Password1"
}
```

Passwords must be 8–72 characters and contain an uppercase letter, a lowercase letter, and a number.

Change password body:

```json
{
  "currentPassword": "Password1",
  "newPassword": "NewPassword2",
  "confirmPassword": "NewPassword2"
}
```

Delete account body:

```json
{
  "currentPassword": "Password1"
}
```

Account deletion returns:

```json
{
  "success": true,
  "data": {
    "message": "Your account and all associated data have been permanently deleted."
  }
}
```

### Lead endpoints

All lead routes require authentication. Writes also require CSRF. Ownership is always derived from the session; any `userId` sent by a client is ignored.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/leads` | List the current user's leads with filters and pagination. |
| `POST` | `/api/leads` | Create a lead and a `Created` activity. |
| `GET` | `/api/leads/stats` | Pipeline totals, status counts, 30-day trend, upcoming follow-ups. |
| `GET` | `/api/leads/:id` | Get one lead. |
| `PATCH` | `/api/leads/:id` | Update fields and record `Updated` or `StatusChanged` activity. |
| `DELETE` | `/api/leads/:id` | Delete a lead and cascade its activity rows. |
| `GET` | `/api/leads/:id/activities` | Return the latest 20 activity entries. |

Create body:

```json
{
  "name": "Jordan Lee",
  "email": "jordan@acme.com",
  "phoneNumber": "+1 (555) 010-2000",
  "company": "Acme Inc.",
  "serviceInterested": "Consulting",
  "status": "New",
  "followUpDate": "2026-11-02",
  "notes": "Interested in a Q4 pilot."
}
```

`status` defaults to `New`. Optional fields accept `null`. `followUpDate` accepts `YYYY-MM-DD` or a full ISO date-time and is stored as a PostgreSQL `DATE`.

List response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "3f1c9b2e-9a5f-4f1e-9d2f-6d4b0e7c1a22",
        "userId": "7b1a9c3e-2f5d-4e8a-b6c1-9d0e2f4a6b8c",
        "name": "Jordan Lee",
        "email": "jordan@acme.com",
        "phoneNumber": "+1 (555) 010-2000",
        "company": "Acme Inc.",
        "serviceInterested": "Consulting",
        "status": "New",
        "followUpDate": "2026-11-02",
        "notes": "Interested in a Q4 pilot.",
        "createdAt": "2026-10-26T09:15:00.000Z",
        "updatedAt": "2026-10-26T09:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

Stats response:

```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 12,
      "byStatus": {
        "New": 4,
        "Contacted": 3,
        "Qualified": 2,
        "Converted": 2,
        "Lost": 1
      },
      "createdOverTime": [
        { "date": "2026-09-27", "count": 0 },
        { "date": "2026-09-28", "count": 1 }
      ],
      "upcomingFollowUps": {
        "count": 3,
        "leads": []
      }
    }
  }
}
```

`createdOverTime` always contains 30 UTC calendar days. `upcomingFollowUps.count` includes today and future dates; the embedded `leads` array contains up to five upcoming leads.

### Error codes

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid payload, query, date, or UUID. |
| `400` | `RESET_TOKEN_INVALID` | Reset token is missing, expired, or already used. |
| `400` | `PASSWORD_TOO_WEAK` | Password does not meet policy. |
| `400` | `PASSWORD_SAME_AS_CURRENT` | New password matches the existing one. |
| `401` | `INVALID_CREDENTIALS` | Wrong login or current password. |
| `401` | `UNAUTHENTICATED` | No valid session, or the account no longer exists. |
| `401` | `INVALID_TOKEN` | Malformed or expired JWT. |
| `403` | `CSRF_ERROR` | Missing or mismatched CSRF header. |
| `404` | `LEAD_NOT_FOUND` | Lead does not exist or belongs to another user. |
| `409` | `EMAIL_ALREADY_EXISTS` | Registration email is already in use. |
| `429` | `RATE_LIMITED` | Rate limit exceeded. |

## Leads: filtering, sorting, and pagination

`GET /api/leads` accepts:

| Parameter | Values / limits | Default |
| --- | --- | --- |
| `page` | Integer `1`–`100000` | `1` |
| `pageSize` | Integer `1`–`100` | `10` |
| `search` | Up to 100 characters; case-insensitive match on name, email, or phone | — |
| `status` | `New`, `Contacted`, `Qualified`, `Converted`, `Lost` | — |
| `createdFrom` / `createdTo` | `YYYY-MM-DD` or ISO date-time | — |
| `followUpFrom` / `followUpTo` | `YYYY-MM-DD` or ISO date-time | — |
| `sortBy` | `createdAt`, `updatedAt`, `name`, `followUpDate`, `status` | `createdAt` |
| `sortOrder` | `asc`, `desc` | `desc` |

Rules:

- Date-only range boundaries are interpreted in UTC. `createdTo` and `followUpTo` include the entire UTC day.
- `from` values must be earlier than or equal to their matching `to` value.
- All sorts use the lead `id` ascending as a tiebreaker, so pagination is deterministic when primary values are equal.
- `followUpDate` sorting places leads without a follow-up date last.
- Search is scoped to the authenticated user only.

Example:

```text
GET /api/leads?page=2&pageSize=25&status=Qualified&search=acme&sortBy=followUpDate&sortOrder=asc
```

## Transactional email

Four templates live in `src/emails/templates/` and share a table-based layout in `src/emails/layout.ts`:

| Template | Trigger | Key content |
| --- | --- | --- |
| `welcome` | Successful registration | Getting-started guidance and a dashboard link. |
| `password-reset` | Password reset requested for an existing account | Single-use, 30-minute link. The raw token appears only in the email. |
| `password-changed` | Password reset or password change succeeds | Change time, sign-in link, and an unauthorized-change warning. |
| `account-deleted` | Account deletion commits | Confirmation, retention summary, and support/register links. |

Every message includes:

- Responsive, table-based HTML that works without external assets.
- A plain-text alternative.
- Absolute links built only from the validated `FRONTEND_URL`.
- `APP_NAME`, `SUPPORT_EMAIL`, and `SMTP_REPLY_TO` branding.

### Delivery behavior

- Email sends happen **after** the corresponding database operation. A failed email never rolls back registration, password changes, resets, or account deletion.
- Delivery failures are logged with the template name and error class only. Recipients, tokens, bodies, and credentials are never logged.
- Password-reset responses are identical for known and unknown email addresses.
- Raw reset tokens are never stored (only a SHA-256 hash) and never returned by the API or written to logs.
- The in-memory outbox exists only outside production, so production processes do not retain copies of messages or reset links.

### Email modes

| Environment | SMTP configured | Behavior |
| --- | --- | --- |
| Development | No | Messages are captured in an in-memory outbox; no network connection is opened. |
| Development | Yes | Messages are delivered through SMTP and also captured in the outbox. |
| Test | Any | **Never** opens a real SMTP connection. Tests use the in-memory outbox or an injected fake transport. |
| Production | No | Startup validation fails. |
| Production | Yes | Messages are delivered through SMTP. Delivery failures are logged safely. |

### Testing email locally

- **Recommended:** point `SMTP_*` at a sandbox such as Mailtrap or MailHog. Emails are then delivered to the sandbox inbox and are also available in the in-memory outbox.
- **Without SMTP:** leave the SMTP variables blank. New messages are captured in memory and a development log line confirms the capture. The outbox is process-local and intentionally not exposed through an HTTP endpoint.
- **Automated tests:** use `getEmailOutbox()` and `setEmailTransportForTests()` from `src/services/email.service.ts`. These test helpers throw unless `NODE_ENV=test`.

## Frontend

The React app lives in `client/` and is served independently from the API.

| Route | Access | Description |
| --- | --- | --- |
| `/` | Public | Redirects to the dashboard or login based on session state. |
| `/login` | Guests | Login with validation and post-action notices. |
| `/register` | Guests | Account creation with password confirmation. |
| `/forgot-password` | Guests | Request a reset link with a privacy-preserving confirmation state. |
| `/reset-password?token=...` | Guests | Set a new password from a single-use link. |
| `/app/dashboard` | Authenticated | Stats cards, creation chart, status pie, and upcoming follow-ups. |
| `/app/leads` | Authenticated | Search, filters, sorting, pagination, create/edit/delete actions. |
| `/app/leads/:id` | Authenticated | Full lead details, notes, activity timeline, edit/delete. |
| `/app/settings` | Authenticated | Profile summary, password change, and permanent account deletion. |
| any other path | Public | Styled 404 page. |

The frontend:

- Sends cookies with `credentials: 'include'`.
- Caches the CSRF token and adds `X-XSRF-TOKEN` to every write.
- Retries once after `403 CSRF_ERROR`.
- Redirects to login with a notice when the session expires.
- Shows loading skeletons, empty states, field-level validation, server errors, and success toasts.
- Requires the current password and typing `DELETE` before account deletion can be confirmed.

### Frontend build

```bash
npm run typecheck:client
npm run build
```

The production bundle is written to `dist/`.

## Testing

```bash
npm test
npm run typecheck
npm run typecheck:client
```

The suite covers:

- Registration, login, logout, session lookup, malformed/expired JWTs, and CORS/CSRF behavior.
- Cookie parsing edge cases.
- Welcome, reset, password-changed, and deletion emails, including HTML escaping, absolute links, and failure isolation.
- Reset-token hashing, expiry, single use, and generic responses for unknown accounts.
- Lead CRUD, search, filters, sorting, pagination, ownership isolation, stats, activity history, and cascade deletion.
- Account deletion: wrong password protection, permanent deletion, cookie clearing, token invalidation, and database cascades.
- Password changes: session invalidation and security emails.

Tests run sequentially (`fileParallelism: false`) because all suites share one PostgreSQL test database. Tests force `NODE_ENV=test`, override `DATABASE_URL`, and blank SMTP credentials, so they never send real email or delete development accounts.

## Deployment

### 1. Prepare the database

Apply committed migrations before starting the API:

```bash
npm ci
npm run db:generate
npm run db:deploy
```

### 2. Configure production environment

At minimum:

```text
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<at-least-32-random-characters>
FRONTEND_URL=https://app.example.com
BACKEND_URL=https://api.example.com
APP_NAME=LeadDesk
SUPPORT_EMAIL=support@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@example.com
```

Production startup fails when any required value is missing. No email transport is silently disabled in production.

### 3. Deploy the API

Use any Node host (Render, Railway, Fly.io, ECS, a VM, etc.):

```bash
npm ci
npm run db:generate
npm run db:deploy
npm start
```

Run behind HTTPS. In production, cookies are issued with `Secure` and `SameSite=None`, which is required for credentialed cross-site requests and mandates HTTPS in modern browsers.

### 4. Deploy the frontend

Build the static app with the API origin:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

Deploy the contents of `dist/` to a static host or CDN.

**Option A — separate origins (recommended for static hosting):**

- Set `FRONTEND_URL` to the exact frontend origin. CORS and cookies are origin-specific; trailing slashes and `www` differences matter.
- Set `VITE_API_BASE_URL` at build time.
- Use HTTPS on both origins.
- Ensure the reverse proxy forwards cookies and the `X-XSRF-TOKEN` header.
- Prefer a same-site API subdomain (for example, `app.example.com` and `api.example.com`) or a same-origin proxy. Strict browser third-party cookie blocking can prevent cross-site session cookies even with `SameSite=None; Secure`.

**Option B — same origin:**

- Host `dist/` behind a reverse proxy or CDN and route `/api/*` to the API.
- Leave `VITE_API_BASE_URL` blank.
- Set `FRONTEND_URL` to that single public origin.

The API does not serve the SPA. The static host or reverse proxy must fall back to `index.html` for client-side routes such as `/app/leads/:id`.

### Configuration checklist

- [ ] HTTPS enabled on frontend and API.
- [ ] `FRONTEND_URL` exactly matches the browser origin.
- [ ] `JWT_SECRET` is long, random, and private.
- [ ] Database migrations applied.
- [ ] SMTP credentials verified and sender domain authorized.
- [ ] `SUPPORT_EMAIL` monitored.
- [ ] `VITE_API_BASE_URL` set correctly if the API is on another origin.
- [ ] Rate limiting and logs reviewed for your hosting platform.

## Account deletion and data retention

`DELETE /api/auth/account` requires a valid session, a CSRF token, and the current password.

When the password is correct, one database transaction:

1. Deletes the user's `LeadActivity` rows.
2. Deletes the user's `Lead` rows.
3. Deletes the user's `PasswordResetToken` rows.
4. Deletes the `User` row.

Foreign keys also use `ON DELETE CASCADE` as a defense in depth. After the transaction commits:

- Every JWT for that user becomes unusable because authentication requires an existing user with a matching token version.
- The auth cookie is cleared.
- A confirmation email is sent to the former address.

If the password is wrong, the API returns `401 INVALID_CREDENTIALS`, deletes nothing, and sends no deletion email. If confirmation email delivery fails, the deletion still stands; failures are logged without sensitive details.

**Retention:** active database rows are removed immediately. Infrastructure backups, database snapshots, SMTP provider archives, and logs may retain copies according to your hosting provider's retention policy. Account deletion does not automatically erase those external copies.

## Security notes

- bcrypt hashing with 12 rounds; password hashes are never returned by the API.
- JWTs are stored in HTTP-only cookies. `tokenVersion` increments on logout, password change, and password reset.
- Double-submit CSRF protection compares the `X-XSRF-TOKEN` header against one or more `csrf_token` cookie values with constant-time comparison.
- Registration is the only CSRF-exempt write; all other unsafe routes validate CSRF.
- Lead queries always include `{ userId }` derived from the session. Foreign and missing IDs both return `404 LEAD_NOT_FOUND`.
- Request bodies are limited to 16 KB.
- Helmet sets security headers; CORS allows only the configured frontend origin and the CSRF header.
- Rate limits:
  - Registration: 5 per 15 minutes.
  - Login: 10 per 15 minutes.
  - Forgot password: 3 per hour.
  - Reset password: 10 per hour.
  - Change password: 10 per hour.
  - Account deletion: 5 per hour.
  - Lead writes: 120 per 15 minutes.
- Email links are generated from validated configuration, never from request headers, preventing host-header injection.
- The email service and CSRF middleware deliberately exclude secrets, tokens, and message bodies from logs.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Environment variable ... is required` on startup | Fill in all required values in `.env`. In production, SMTP and `SUPPORT_EMAIL` are mandatory. |
| `SMTP configuration is incomplete` | Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` together, or clear all of them in development. |
| Login works but writes return `403 CSRF_ERROR` | Fetch `/api/auth/csrf` and send its token in `X-XSRF-TOKEN`. Ensure cookies are included. |
| Cookies not stored across origins | Use HTTPS and verify `FRONTEND_URL` exactly matches the browser origin. Production cookies use `SameSite=None; Secure`. |
| Frontend calls the wrong API | Set `VITE_API_BASE_URL` before building, or use the Vite dev proxy and leave it blank. |
| `P1001` or Prisma connection errors | Verify `DATABASE_URL`, database availability, and SSL settings required by your host. |
| Tests fail to connect | Create `task_auth_test` on the configured test host and apply migrations. Tests ignore the development database. |
| Emails do not arrive in development | Configure sandbox SMTP, or inspect the in-memory outbox via tests; without SMTP nothing is sent over the network. |
| Direct navigation to `/app/...` 404s in production | Configure the static host to rewrite unknown paths to `index.html`. |
| `prisma migrate dev` cannot find `DATABASE_URL` | Ensure `.env` exists at the repository root; `prisma.config.ts` loads it via `dotenv/config`. |
