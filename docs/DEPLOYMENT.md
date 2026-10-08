# Production deployment

## Target topology

```text
Browser
  ├── HTTPS ──> Vercel (React application)
  └── HTTPS/WSS + HttpOnly cookies ──> Railway (API + GraphQL subscriptions)
                                          ├── Supabase PostgreSQL and Auth
                                          └── Upstash Redis Pub/Sub
```

Railway runs the final `api-runtime` stage in the root `Dockerfile`. Vercel
builds `apps/web` and uses `apps/web/vercel.json` to route React Router URLs to
`index.html`. Supabase remains the source of truth; Redis carries ephemeral
real-time events only.

The repository contains no production credentials. Keep the deployment switch
off until every provider and GitHub value below is configured.

## 1. Choose production URLs

The recommended arrangement uses two subdomains of one site:

```text
Web: https://app.example.com
API: https://api.example.com
WS:  wss://api.example.com/graphql
```

This arrangement keeps authentication cookies same-site while requests remain
cross-origin. Set `COOKIE_SAME_SITE=lax`.

For a temporary deployment that mixes a `vercel.app` URL with a
`railway.app` URL, set `COOKIE_SAME_SITE=none`. The API then emits
`SameSite=None; Secure` cookies and continues to require the exact trusted
frontend `Origin`. Some browsers or privacy tools may still block these as
third-party cookies, so provider domains are not the preferred final setup.

Never use `none` over HTTP. The API rejects that combination outside production.

## 2. Prepare Supabase

Use the existing Boardnest Supabase project and schema.

1. Copy **Project URL** as `SUPABASE_URL`.
2. Copy the public `sb_publishable_...` key as
   `SUPABASE_PUBLISHABLE_KEY`.
3. Under **Authentication → URL Configuration**, set **Site URL** to the exact
   production web URL.
4. Add the exact API callback to **Redirect URLs**:
   `https://api.example.com/auth/callback`.
5. Keep the localhost callback while local development is still needed.

Normal queries use the authenticated user's access token and remain protected
by Row Level Security. The enabled reminder scheduler separately requires the
service-role key for its single narrowly granted RPC; the API does not require
a direct database URL.

### Existing database migration baseline

The current hosted schema was created manually from `database/migrations`
before Supabase CLI history existed. The deployment workflow therefore does not
run database migrations. Do not copy the current numbered files into
`supabase/migrations` and push them to the same database; that would attempt to
create existing objects again.

Before adding a future automatic migration step:

1. create a Supabase backup;
2. install and authenticate the Supabase CLI;
3. run `supabase init` and `supabase link --project-ref <project-ref>` from the
   repository root;
4. run `supabase db pull` to capture the existing remote schema as one
   timestamped baseline;
5. review the generated SQL against `database/migrations` and confirm that the
   CLI recorded the baseline as applied remotely;
6. test every later migration against an isolated database before production.

This is an explicit database operation and should be performed separately from
the first application deployment.

## 3. Create production Redis

1. Create an Upstash Redis database close to the Railway and Supabase regions.
2. Copy the TLS Node.js connection string. It has this shape:

   ```text
   rediss://default:<password>@<host>.upstash.io:6379
   ```

3. Store it only as Railway's `REDIS_URL`. Do not add it to Vercel or GitHub.

Boardnest uses the Redis protocol endpoint, not the Upstash REST URL. TLS is
selected by the `rediss://` scheme.

## 4. Configure Railway

1. Create a Railway project and an empty service for the API.
2. Generate a project-scoped deployment token for GitHub Actions.
3. Configure the service to build the root `Dockerfile`. Do not set a target:
   its final stage is deliberately `api-runtime`.
4. Set the health-check path to `/health`.
5. Let Railway provide `PORT`; do not hard-code a public port.
6. Generate a Railway domain or attach `api.example.com` and wait for HTTPS.
   The public domain target port must match the runtime `PORT` shown in the
   deploy log (Railway currently injects `8080` for this service), not the
   Dockerfile's local default.
7. Add these service variables:

| Variable                         | Production value                                  |
| -------------------------------- | ------------------------------------------------- |
| `API_URL`                        | Exact public API origin, without a trailing slash |
| `COOKIE_SAME_SITE`               | `lax` for same-site subdomains; otherwise `none`  |
| `CORS_ORIGIN`                    | Exact Vercel/custom web origin                    |
| `INVITATION_EMAIL_FROM`          | Sender on a verified Resend domain                |
| `NODE_ENV`                       | `production`                                      |
| `REDIS_URL`                      | Private Upstash `rediss://...` connection string  |
| `RESEND_API_KEY`                 | Server-only Resend sending key                    |
| `REMINDER_SCHEDULER_ENABLED`     | `true`                                            |
| `REMINDER_SCHEDULER_INTERVAL_MS` | `30000`                                           |
| `REMINDER_SCHEDULER_BATCH_SIZE`  | `100`                                             |
| `SUPABASE_PUBLISHABLE_KEY`       | Supabase public publishable key                   |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase secret service-role key                  |
| `SUPABASE_URL`                   | Supabase project URL                              |

The API serves HTTP, GraphQL, and WebSockets from the same process. Railway
must not be configured as a short-lived serverless function.
`SUPABASE_SERVICE_ROLE_KEY` belongs only in Railway. Never add it to Vercel,
prefix it with `VITE_`, print it in logs, or store it in GitHub for this runtime
path. `RESEND_API_KEY` and `INVITATION_EMAIL_FROM` are optional but must be set
together to enable invitation delivery. Apply migrations through
`350_invitation_acceptance.sql` before exposing invitation acceptance.

## 5. Configure Vercel

Create or link a Vercel project with `apps/web` as its root directory. The
checked-in Vercel configuration supplies the Vite build, `dist` output, and SPA
rewrite.

For a CLI-created project:

```bash
nvm use
corepack enable
pnpm dlx --allow-build esbuild vercel@58.4.4 login
pnpm dlx --allow-build esbuild vercel@58.4.4 link --cwd apps/web
```

The narrow `--allow-build esbuild` permission is required by pnpm's temporary
`dlx` environment. It permits only Vercel CLI's pinned `esbuild` dependency to
run its platform-specific installation script; it does not relax the
repository's dependency policy.

Add these variables to the Vercel **Production** environment before building:

| Variable           | Production value                  |
| ------------------ | --------------------------------- |
| `VITE_API_URL`     | `https://api.example.com`         |
| `VITE_GRAPHQL_URL` | `https://api.example.com/graphql` |
| `VITE_WS_URL`      | `wss://api.example.com/graphql`   |

`VITE_*` values are public build-time configuration. Never put Supabase secret
keys, Redis credentials, deployment tokens, or database passwords in them.
Enter the real URL text: copying a dashboard's masked `••••` display embeds
those characters into the JavaScript bundle and stops frontend initialization.

`apps/web/vercel.json` explicitly uses
`pnpm install --frozen-lockfile`. This prevents Vercel's local builder from
falling back to npm, which cannot resolve the pnpm workspace `catalog:`
protocol.

The GitHub workflow deploys Vercel with its CLI. Avoid a second automatic
production deployment from a provider Git integration, or disable that path,
so production always comes from the revision that passed Boardnest CI.

## 6. Configure the GitHub production environment

In **GitHub → Settings → Environments**, create `production`, restrict it to
`main`, and add approval protection if available.

Add these environment variables:

| Variable             | Example / purpose                             |
| -------------------- | --------------------------------------------- |
| `PRODUCTION_API_URL` | `https://api.example.com` for smoke checks    |
| `PRODUCTION_WEB_URL` | `https://app.example.com` and deployment link |
| `RAILWAY_SERVICE`    | Railway API service name or identifier        |

Add these environment secrets:

| Secret              | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `RAILWAY_TOKEN`     | Scoped Railway project deployment token       |
| `VERCEL_TOKEN`      | Vercel token used only for deployment         |
| `VERCEL_ORG_ID`     | Team/account ID for the linked Vercel project |
| `VERCEL_PROJECT_ID` | ID of the linked Vercel project               |

After `vercel link`, the two IDs can be read locally from
`apps/web/.vercel/project.json`. The `.vercel` directory must remain untracked.

Finally, create or change the repository variable
`PRODUCTION_DEPLOYMENTS_ENABLED` to `true`. This is the last activation step,
not a secret.

## 7. Release

1. Run `pnpm check` locally.
2. Push the deployment branch and open a pull request to `main`.
3. Confirm `Quality`, `End-to-end`, and `Docker images` pass.
4. Merge to `main`.
5. If the GitHub `production` environment requires approval, approve the
   pending deployment.
6. Watch **Production deployment**. It deploys the exact SHA that passed CI:
   Railway first, Vercel second, production smoke checks last.

The automated smoke test verifies:

- the Railway `/health` response;
- the Vercel HTML document;
- the production GraphQL endpoint and exact CORS origin.

It can also be run locally without credentials:

```bash
PRODUCTION_WEB_URL=https://app.example.com \
PRODUCTION_API_URL=https://api.example.com \
pnpm smoke:production
```

## 8. Manual production verification

Use a new test account and verify all of the following:

1. `/register`, the Supabase confirmation email, the API PKCE callback, and the
   redirect to `/dashboard` complete successfully.
2. DevTools shows `boardnest-access` and `boardnest-refresh` as `HttpOnly` and
   `Secure`; their `SameSite` value matches the selected domain strategy.
3. No access or refresh token appears in Local Storage, Session Storage, the
   page source, or a JSON response.
4. Workspace, private/public project, status, and task CRUD work.
5. Two signed-in browsers see task changes in real time over
   `wss://.../graphql`.
6. A second user cannot read or mutate a private project without membership.
7. Sign-out clears both cookies and protected routes return to `/login`.
8. Browser and provider logs contain no keys, passwords, Redis URLs, or tokens.

## 9. Production troubleshooting

### Vercel loads only the background

Open the browser console. If it reports invalid public environment variables,
verify all three `VITE_*` production values contain full URLs rather than
masked characters. Because Vite embeds them at build time, saving a variable
is not enough: run a new production deployment and hard-refresh the browser.

### Railway returns 502 while the service is online

Read the API deploy log for `Boardnest API listening on port ...`, then set the
Railway generated domain's target port to that exact value. `/health` should
return `{"service":"boardnest-api","status":"ok"}`.

### Redis closes immediately in Railway

Use the provider's Redis protocol URL with TLS, normally `rediss://...`, rather
than an HTTP REST endpoint or a non-TLS `redis://` URL when the provider requires
TLS.

### Vercel reports `Unsupported URL Type "catalog:"`

Confirm the checked-in `apps/web/vercel.json` still contains the explicit pnpm
install command. The error means the build incorrectly attempted `npm install`.

## 10. Failure and rollback

- Set `PRODUCTION_DEPLOYMENTS_ENABLED=false` before investigating repeated
  failures.
- Vercel can promote the last healthy deployment.
- Railway can roll back or redeploy the previous healthy API deployment.
- Revert the faulty commit on `main` so source control matches production.
- Database changes use reviewed forward fixes; never automatically run a
  destructive down migration against production.
- Rotate a token immediately if it is printed, committed, or otherwise exposed.

Provider rollback does not roll back Supabase data. Record the failed revision,
the restored revision, and any required data repair before re-enabling delivery.
