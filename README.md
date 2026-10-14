# Project Management System

Account authentication for a same-origin Next.js frontend and Express API. Workspace ownership is not implemented here. Every account receives the global role `user`; Owner, Admin, and Member permissions will be enforced later from workspace membership, not from this global role.

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

`db:seed` is idempotent and ensures the global `user` role. Migration `0000_auth` also inserts that role.

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Register, open the activation link from the SMTP inbox, then log in. Reloading the dashboard calls `GET /api/auth/me` with the access cookie. When that token expires, the client sends one `POST /api/auth/refresh-token` request, including the CSRF header, and retries the original request.

## Production

Terminate TLS at one host. Route `/api` to Express and every other path to Next.js. Set `NODE_ENV=production`, `SECURE_COOKIE=true`, and `SAME_SITE=lax` or `SAME_SITE=strict`. The API refuses to start in production when the secure flag is false, `SAME_SITE` is invalid, or `SAME_SITE=none`. Do not add a trailing slash to the refresh path; the refresh cookie is scoped to the exact path `/api/auth/refresh-token`.

CORS remains limited to `CORS_ORIGINS`, allows `Authorization` and `X-CSRF-Token`, and uses credentials. Same-origin browser traffic does not depend on CORS, but direct API clients do.

## Mobile and other non-browser clients

`POST /api/auth/login` returns `accessToken` and `refreshToken` in the JSON body as well as setting cookies. Send `Authorization: Bearer <accessToken>` on API calls. Refresh with `POST /api/auth/refresh-token` and the same bearer refresh token, or `POST /api/auth/refresh-token-mobile` with `{ "refreshToken": "..." }`. Bearer refresh does not require the CSRF header. Store those tokens in the platform's secure storage, not in a browser-readable location.

## Authorization

`authentication` accepts a bearer access token, otherwise the access cookie. It rejects blacklisted, expired, malformed, or non-access tokens, missing users, and revoked or replaced sessions. `authorization(['permission-title'])` then allows the request when the user's global role has any one of the named permissions. An empty permission list is denied. This global check does not grant workspace Owner, Admin, or Member access.

## Tests

```bash
cd backend
npm test
cd ../frontend
npm test
npm run typecheck
```

Backend integration tests migrate `projectmanagementsystem_test` and skip when PostgreSQL is not reachable at `DATABASE_URL` or `TEST_DATABASE_URL`. They refuse to run against a database whose name does not end in `_test`.
