# Project Management System

Account authentication and workspace membership for a same-origin Next.js frontend and Express API. Every account receives the global role `user`; Owner, Admin, and Member permissions are enforced from workspace membership, not from this global role.

## Architecture

- Access, refresh, activation, and reset tokens are HMAC-SHA256 JWTs signed with `JWT_SECRET`. `JWT_SECRET` is a shared secret, not an RSA private key. Each token has a `tokenType` and is accepted only by the endpoint that expects that type.
- The browser session uses three cookies:
  - `accessToken`: HttpOnly, `Path=/api`
  - `refreshToken`: HttpOnly, `Path=/api/auth/refresh-token`
  - `csrfToken`: readable by JavaScript, `Path=/`, rotated on login and refresh, and stored only as a hash on the current refresh session
- The UI and `/api` must share one origin. In development, Next.js rewrites `/api` to the Express server. In production, a reverse proxy must do the same. A cookie set by another host is not readable by the page, even when `HttpOnly` is false.
- Cookie-authenticated `POST`, `PATCH`, and `DELETE` requests use the double-submit check: the `csrfToken` cookie and `X-CSRF-Token` header must match, and that value must match the hash stored for the access token's session. Requests that present `Authorization: Bearer` are exempt because they are not relying on the browser to attach a cookie.
- Refresh tokens rotate. The replaced session row stays until `expires_at` so reuse can be detected. Reuse of an old refresh `jti` revokes the whole session family. Logout also blacklists the presented access token until its own expiry and revokes its refresh family, so that session ends immediately. Expired blacklist rows and expired refresh sessions, including replaced or revoked ones, are deleted on a timer. Rows are not deleted only because they were replaced or revoked.
- Passwords are hashed with bcrypt at cost 10. Activation uses one emailed link whose JWT contains `{ email, otp }` and expires in 30 minutes. Only the HMAC of the OTP is stored. Reset links expire in 15 minutes. Login rejects unverified users.

## Local setup

Requirements: Node.js 22, PostgreSQL 13 or newer, and an SMTP server. [Mailpit](https://mailpit.axllent.org/) on `127.0.0.1:1025` is suitable for local mail.

```bash
cd backend
cp .env.example .env
cd ../frontend
cp .env.example .env
```

Set `DATABASE_URL`, generate a `JWT_SECRET` of at least 32 characters, and point `API_PROXY_TARGET` at the API origin, for example `http://127.0.0.1:4000`. Leave `NEXT_PUBLIC_API_URL` empty so the browser calls the Next.js origin.

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`db:seed` is idempotent. It ensures the global `user` role, then creates verified Gmail-style test accounts, two workspaces, projects, and tasks. Every seed account uses the password `ChangeMe!12345`. Running the seed again resets that password for these accounts only.

| Email | Seed Delivery | Seed Research |
|---|---|---|
| `wajeeha.owner@gmail.com` | Owner | |
| `wajeeha.admin@gmail.com` | Admin | Admin |
| `wajeeha.member1@gmail.com` | Member | Owner |
| `wajeeha.member2@gmail.com` | Member | Member |
| `wajeeha.member3@gmail.com` | | Member |

Tasks are assigned only to Members. Migration `0000_auth` also inserts the global `user` role. Migration `0001_workspaces` creates workspace and membership tables. Migration `0002_projects_tasks` creates projects and tasks.

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Register, open the activation link from the SMTP inbox, then log in. Create a workspace from the workspace screen and add already-registered users by email. Reloading the page calls `GET /api/auth/me` with the access cookie. When that token expires, the client sends one `POST /api/auth/refresh-token` request, including the CSRF header, and retries the original request.

## Production

Terminate TLS at one host. Route `/api` to Express and every other path to Next.js. Set `NODE_ENV=production`, `SECURE_COOKIE=true`, and `SAME_SITE=lax` or `SAME_SITE=strict`. The API refuses to start in production when the secure flag is false, `SAME_SITE` is invalid, or `SAME_SITE=none`. Do not add a trailing slash to the refresh path; the refresh cookie is scoped to the exact path `/api/auth/refresh-token`.

CORS remains limited to `CORS_ORIGINS`, allows `Authorization` and `X-CSRF-Token`, and uses credentials. Same-origin browser traffic does not depend on CORS, but direct API clients do.

## Mobile and other non-browser clients

`POST /api/auth/login` returns `accessToken` and `refreshToken` in the JSON body as well as setting cookies. Send `Authorization: Bearer <accessToken>` on API calls. Refresh with `POST /api/auth/refresh-token` and the same bearer refresh token, or `POST /api/auth/refresh-token-mobile` with `{ "refreshToken": "..." }`. Bearer refresh does not require the CSRF header. Store those tokens in the platform's secure storage, not in a browser-readable location.

## Authorization

`authentication` accepts a bearer access token, otherwise the access cookie. It rejects blacklisted, expired, malformed, or non-access tokens, missing users, and revoked or replaced sessions. `authorization(['permission-title'])` then allows the request when the user's global role has any one of the named permissions. An empty permission list is denied.

Workspace routes use a separate membership check. Each workspace has one Owner; the creator becomes Owner in the same transaction that creates the workspace. Owners can update/delete the workspace and transfer ownership. Admins can add, remove, and change the `admin`/`member` role of non-owner members. Members have read-only access. The Owner cannot be removed or demoted; transfer ownership first. Workspace APIs live under `/api/workspaces`, and cookie-authenticated mutations require the CSRF header.

## Projects and tasks

Projects belong to one workspace. Tasks belong to one project and require a title, assignee, due date, status (`TODO`, `IN_PROGRESS`, or `DONE`), priority (`LOW`, `MEDIUM`, or `HIGH`), creator, timestamps, and optimistic-lock `version`.

- Owner and Admin can create, edit, and delete projects and tasks.
- Members can view workspace projects/tasks and can update `status` and `progress` (0–100) on tasks assigned to them.
- A new task assignee, and any change of assignee, must be a user whose current role in that workspace is Member. An Owner or Admin cannot be newly assigned. If an assigned Member is later promoted, that existing assignment stays in place until the assignee is changed.
- `GET /api/workspaces/:workspaceId/projects/:projectId/tasks` supports `search`, `status`, `priority`, `assigneeId`, `sortBy` (`createdAt`, `updatedAt`, `dueDate`, `priority`, `title`), `sortDirection`, `page`, and `pageSize` (1–100). Responses include `items` plus pagination metadata.
- Project detail responses include task totals by status and a `progress` percentage: the average of each task's progress, rounded to the nearest whole number. A project with no tasks is 0%. The same average is returned for each assignee in `byAssignee`. Each task stores its own `progress` from 0 to 100. The migration indexes workspace/project lookup, project task ordering, status/priority filtering, assignee filtering, and due dates.
- Task updates must submit the current `version`. Updates use `id + version` matching and return `409 Conflict` when another change has already advanced the version; reload the task before retrying.

## Tests

```bash
cd backend
npm test
cd ../frontend
npm test
npm run typecheck
```

Backend integration tests migrate `projectmanagementsystem_test` and skip when PostgreSQL is not reachable at `DATABASE_URL` or `TEST_DATABASE_URL`. They refuse to run against a database whose name does not end in `_test`.
