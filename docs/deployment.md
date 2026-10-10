# Deployment

## Current staging topology

Railway project **opsdesk**, environment **staging**, runs separate web, API, worker, PostgreSQL, and Redis services. The three application deployments inspected during Phase 11E used commit `709008c90c749ea858df2b95bace2ac64a031481` from `feat/phase-11-deployment`. The demo branch had already been merged into that source branch.

- Web: <https://opsdesk-web-staging.up.railway.app/app>
- Web process health: <https://opsdesk-web-staging.up.railway.app/api/health>
- API readiness: <https://opsdesk-api-staging.up.railway.app/health/ready>
- API liveness: <https://opsdesk-api-staging.up.railway.app/health/live>

These URLs are public; tenant application data requires authentication and membership. No public Swagger UI is deployed. Configuration and account access are shared privately, never committed.

## Images and entrypoints

`apps/api/Dockerfile` builds NestJS and generates Prisma. Its runtime target serves `node dist/main.js`; the worker uses the same application image with `node dist/worker.js`. The migration target retains the tools needed for `prisma migrate deploy --config prisma7.config.ts`. `apps/web/Dockerfile` builds the Next.js standalone output.

For a complete **local** image test, fill in the development templates first, then use `docker compose --env-file compose.env -f compose.docker.yml up --build`. The Compose migration service runs before API/worker startup. This command starts local infrastructure and application processes, including job consumers; use only dedicated development provider configuration.

## Environment configuration

API and worker require the environment-specific DB/Redis URLs, Auth0 issuer/audience, R2 endpoint/bucket/access keys, Resend keys/webhook secret, sender address, and inbound domain. Web requires Auth0 application credentials/session secret, `APP_BASE_URL`, and `API_SERVER_URL`. Use Railway private networking for server-to-server/database/Redis addresses where configured; browsers require public HTTPS origins.

Web build-time values include `NEXT_PUBLIC_REALTIME_URL`, `NEXT_PUBLIC_R2_ORIGIN`, and values used to construct CSP/build output. Public values must match the target environment before building; changing only runtime values will not update already compiled browser assets. Set hosted `NODE_ENV=production`, configure exact HTTPS callback/logout origins, and keep staging credentials/data separate from production.

## Release review and migration ordering

1. Review the diff and passing CI for the exact proposed commit.
2. Confirm the target Railway environment and source branch. Merging into `feat/phase-11-deployment` can trigger staging autodeploy.
3. Review migration compatibility and apply committed migrations using the migration release step appropriate to the environment. The source repository includes the migration image/command; verify the actual Railway release configuration before each release rather than assuming the API applies migrations itself.
4. Deploy compatible API/worker/web versions, then inspect readiness, consumer heartbeats, queue health, and deployment logs.
5. Verify authenticated workflows using approved accounts. Keep reports clear about live checks versus automated tests.

Every release must be authorized for its target environment. Phase 11G is authorized for staging after exact-commit CI and diff review. It adds safe provider diagnostics, queue history/consumer signals, focused accessibility/font fixes, and release documentation. It adds no DB migrations, guard changes, hosted documentation, provider configuration changes, or paid resources. Production/default-branch release still requires separate consent.

## Operations and data safeguards

Use [the operations runbook](operations/runbook.md) for readiness/queue interpretation, rollback, and provider failures. A ready API does not prove a healthy worker or successful delivery. Phase 11G traced the four retained failures to development sender recipient restrictions, preserved them, and verified one approved sandbox email round trip. See the [release report](PHASE-11G-REPORT.md) for evidence and limitations.

The [demo tooling](demo/README.md) has explicit staging identity/database safeguards. Validation was read-only and confirmed 8 customers / 12 tickets / 5 tags / 48 messages. Seed/reset commands are writes and are not part of routine health verification. Never replace identity/database safeguards with production values or disable them to make a command pass.

The user declined paid database backups and plan upgrades. This work does not add paid resources or certify restore readiness. Any future recovery plan must be reviewed within the approved environment and budget. Application rollback does not undo database migrations; inspect compatibility first.
