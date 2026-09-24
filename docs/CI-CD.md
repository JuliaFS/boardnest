# Continuous integration and delivery

## Purpose

Continuous integration (CI) checks every proposed change in a clean runner before
it can be merged. Continuous delivery (CD) promotes a revision that has already
passed CI to a controlled environment. CI answers whether a revision is safe to
merge; CD answers which verified revision is released, where, and under whose
approval.

Boardnest uses two GitHub Actions workflows:

- `.github/workflows/ci.yml` validates pull requests and pushes to `main`;
- `.github/workflows/deploy.yml` gates production deployment after a successful
  `main` CI run.

## GitHub Actions concepts

- A **workflow** is a YAML automation definition under `.github/workflows`.
- An **event** starts a workflow, such as `pull_request`, `push`,
  `workflow_run`, or a manual `workflow_dispatch`.
- A **job** is an isolated runner with a collection of ordered steps.
- A **step** runs a command or a reusable action.
- An **artifact** preserves output such as a Playwright report after the runner
  is destroyed.
- A **secret** is encrypted sensitive configuration. It must not be printed or
  passed to untrusted pull-request code.
- A repository or environment **variable** stores non-secret configuration.
- A GitHub **environment** groups production secrets, deployment history, branch
  restrictions, and optional approval rules.

## CI workflow

`CI` runs for pull requests targeting `main`, direct pushes to `main`, and manual
runs. Its token has only read access to repository contents. A newer run for the
same branch cancels an obsolete in-progress run.

### Quality job

The `Quality` job performs these steps in order:

1. checks out the repository without persisting write credentials;
2. installs the pinned pnpm and Node.js versions;
3. installs the frozen lockfile;
4. checks Prettier formatting;
5. runs ESLint with zero warnings;
6. type-checks every workspace;
7. runs shared tests plus API/web coverage gates;
8. builds all applications and packages.

The job fails immediately if formatting, linting, TypeScript, a test, a coverage
threshold, dependency installation, or a build fails.

### End-to-end job

`End-to-end` starts only after `Quality` succeeds. It installs Chromium and its
Linux dependencies, then runs the Playwright workflow. CI uses one worker for
reproducibility and retries a failed browser test twice. The GitHub reporter
adds annotations while the HTML report is retained as an artifact for 14 days,
including for failed runs.

The E2E fixture runs the real React application against its stateful test
transport. It does not need Supabase or production credentials.

### Docker images job

`Docker images` also starts after `Quality`. It:

1. validates the resolved Compose model with non-secret placeholders;
2. runs Dockerfile build checks;
3. builds the `api-runtime` image;
4. builds the `web-runtime` image.

The placeholder Supabase URL and key are used only to validate Compose
interpolation. They are not usable credentials and never enter runtime images.

## Pull-request protection

After the workflow exists on GitHub, configure the `main` branch rule in
**Settings → Branches** or **Settings → Rules → Rulesets**:

1. require a pull request before merging;
2. require the `Quality`, `End-to-end`, and `Docker images` status checks;
3. require branches to be up to date before merging;
4. block force pushes and branch deletion;
5. optionally require one review when another reviewer is available.

Do not add repository secrets to the CI workflow. Workflows from forked pull
requests must remain safe to execute without privileged credentials.

## Production deployment workflow

`Production deployment` listens for a completed `CI` workflow on `main` and
continues only when CI succeeded. It resolves the exact verified commit and
serializes production runs so two deployments do not overlap. To request a
manual production run, manually start the `CI` workflow on `main`; successful
completion triggers the same protected path without bypassing verification.

The workflow is intentionally dormant before Phase 12. The `plan` job reads the
non-secret repository variable `PRODUCTION_DEPLOYMENTS_ENABLED`. When it is
absent or not equal to `true`, the workflow records a successful skipped
deployment without requesting any credentials.

After Phase 12 configures the providers, use this ownership:

| Name                             | Kind                 | Purpose                                    |
| -------------------------------- | -------------------- | ------------------------------------------ |
| `PRODUCTION_DEPLOYMENTS_ENABLED` | repository variable  | Explicit production deployment switch      |
| `PRODUCTION_WEB_URL`             | environment variable | URL shown in GitHub deployment history     |
| `RAILWAY_SERVICE`                | environment variable | Railway API service identifier or name     |
| `RAILWAY_TOKEN`                  | environment secret   | Scoped Railway production project token    |
| `VERCEL_DEPLOY_HOOK_URL`         | environment secret   | Vercel hook bound to the production branch |

When enabled, the workflow checks out the verified revision, deploys the API
with a pinned Railway CLI, and then triggers the Vercel production build. The
provider project, environment variables, health verification, and final
activation belong to Phase 12.

Configure the `production` GitHub environment to accept only `main`. For a
public portfolio repository, add a required reviewer if the GitHub plan permits
it. Environment secrets are released only after its protection rules pass.

## Supabase migrations

CI does not connect to the hosted production database and does not receive a
service-role key or database password. The existing schema was applied manually
before migration history was managed by the Supabase CLI. Automatically replaying
those historical files against the live project could duplicate already applied
objects.

Phase 12 must first baseline the remote migration history. New migrations can
then be validated in an isolated database and applied as an explicit deployment
step. Production database changes must never run for a pull request.

## Failure and rollback strategy

- A CI failure blocks merge; fix the branch and push another commit.
- A deployment failure stops the workflow before the next provider step and
  leaves the last healthy production deployment in service.
- For application regressions, disable `PRODUCTION_DEPLOYMENTS_ENABLED`, restore
  the previous provider deployment, then revert the offending commit on `main`.
- Vercel can promote a previous successful deployment; Railway can roll back or
  redeploy the previous healthy deployment from its dashboard.
- Database migrations use forward fixes. Destructive automatic down migrations
  are avoided because deployed application instances may still depend on the
  newer schema.
- Rotate a deploy token or hook immediately if it may have been exposed.

Rollback is an incident response, not a substitute for CI. Record the failed
revision and cause before re-enabling production delivery.

## Local equivalence

Before opening a pull request, run:

```bash
pnpm check
pnpm test:ci
docker compose config --quiet
docker build --check --target api-runtime .
```

GitHub remains authoritative because it runs from a clean checkout on the same
pinned toolchain for every contributor.
