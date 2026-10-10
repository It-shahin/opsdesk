# Phase 11F documentation and OpenAPI report

Date: 2026-10-10. Branch: `feat/phase-11-documentation`.
Base: latest fetched `feat/phase-11-deployment`, commit `709008c90c749ea858df2b95bace2ac64a031481`.

## Completed

- Root README with actual app screenshot, features, stack, architecture diagram, local configuration/start commands, tests/CI, staging links, and limitations.
- Architecture, security, deployment, and API workflow guides; Socket.IO events described separately from HTTP OpenAPI.
- Read-only [Phase 11E report](demo/FINAL-VERIFICATION.md), including guarded live CLI validation and explicit not-tested checks.
- `@nestjs/swagger` metadata for all 13 existing controllers and 17 request/query DTOs, reviewed success/error projections, tags, access-token/Svix security, UUID parameters, enums, defaults, and validation limits.
- Offline `docs/api/openapi.json` generation/validation for 38 HTTP operations, automatic controller discovery, and snapshot drift detection.
- Separate development-only Swagger viewer on loopback `127.0.0.1:3100`, hosted-environment rejection, disabled Try it out and authorization persistence; no Swagger routes installed in API/worker runtime entrypoints.
- CI includes docs safeguards and OpenAPI drift checks, and now checks PRs targeting the deployment branch.

## Actual local checks

Host: Windows, Node `24.14.0`, pnpm `10.15.1`. CI remains on Node 22. No real provider credentials were copied into the isolated worktree. E2E used disposable Redis on loopback port 16379 and synthetic provider settings; DB integration used disposable PostgreSQL 17 on loopback port 15432. Both task-created containers and the local viewer were stopped/removed after verification.

| Command / check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; lockfile unchanged by install; pnpm reported ignored dependency build scripts |
| `pnpm --filter api exec prisma generate --config prisma7.config.ts` | PASS, synthetic localhost URL, no DB connection |
| `pnpm --filter api build` | PASS |
| `pnpm --filter api lint` | PASS, 2 existing warnings: unused import in users service, control-character regex in attachment policy |
| `pnpm --filter api test` | PASS, 43 suites / 433 tests |
| `pnpm --filter api test:e2e --testTimeout=30000` | PASS, 15 suites / 199 tests; 3 DB suites / 40 tests skipped here and run separately below |
| `pnpm --filter api migrate:deploy` | PASS, all 13 committed migrations applied only to disposable local test DB |
| `pnpm --filter api test:audit:db` | PASS, 22 tests |
| `pnpm --filter api test:analytics:db` | PASS, 5 tests |
| `pnpm --filter api test:demo:db` | PASS, 13 tests with explicit disposable `DEMO_TEST_DATABASE_URL` |
| `pnpm --filter api test:openapi` | PASS, 2 safeguard tests |
| `pnpm --filter api openapi:generate` | PASS, 38 operations validated |
| `pnpm --filter api openapi:check` | PASS, generated schema matches committed snapshot |
| Local Swagger HTTP/binding smoke test | PASS: UI/JSON 200, 38 operations, actual UI options disabled, business route 404, listener only 127.0.0.1 |
| Actual viewer invocation with `NODE_ENV=production` | PASS: refused before listening |
| `pnpm --filter web lint` | PASS, 2 existing realtime effect-cleanup ref warnings |
| `pnpm --filter web test:auth` | PASS, 11 tests |
| `pnpm --filter web test:security` | PASS, 44 tests |
| `pnpm --filter web build` | PASS, production compile / TypeScript / page generation |
| Structural source review | PASS: all 30 existing edited API files retain identical syntax trees after removing documentation imports/decorators and formatting-only parentheses |
| Privacy/whitespace/diff review | PASS; no real account email/credentials in new public docs/schema; screenshot reviewed; no web code, guards, validators, business-service or database-schema edits |

The first unmodified local E2E command hit its existing five-second startup-hook timeout in `app.e2e-spec.ts`; 198 other tests passed. The rerun with a 30-second local timeout passed all 199. No test-source timeout was changed. The first web checks lacked web dependencies in the new worktree; installation resolved that. Initial API compilation required generating the ignored Prisma client, then two Swagger typing corrections were made before the final successful build. These resolved attempts are not hidden as clean first-run results.

## Review and deployment impact

### PR #11 review corrections (2026-10-10)

The local viewer now refuses known hosted-platform markers, including `VERCEL=1` and populated `VERCEL_*` variables, even when `NODE_ENV=development`. The tag-list response schema now includes the required `_count.ticketLinks` integer returned by `TagsService.list`; the generated snapshot was refreshed. No runtime service or entrypoint behavior changed.

Follow-up local checks passed: API build, all three documentation safeguard tests, offline generation/check for 38 operations, required tag-count projection assertions, and an actual viewer invocation with simulated Vercel markers that exited before listening. The hosting checks are defense in depth; the viewer must never be deployed or tunneled. Hosted CI and staging rollout evidence is reported separately after these fixes are published.

The change adds two direct dependencies (`@nestjs/swagger@12.0.2`, dev-only `@apidevtools/swagger-parser@13.1.0`) and their locked transitive packages. Existing dependency resolutions were preserved. API annotations add metadata and imports; a structural comparison and regression suites confirmed the existing code/validators were preserved. No Swagger compiler plugin or automatic HTTP-code rewrite is enabled.

There are no database migrations or changes to authentication, tenant guards, CSRF/origin checks, CSP, runtime entrypoints, or application provider configuration. Generated build outputs already tracked in the base repository are restored and excluded from the change. Full Docker image builds remain part of hosted CI rather than being claimed as local checks.

Preparing/pushing this branch and its PR does not authorize a merge. Merging into `feat/phase-11-deployment` can rebuild and redeploy the staging web/API/worker; review the exact commit and passing hosted CI, then obtain user confirmation before merge/deploy. No production changes, paid resources, plan upgrades, credential rotation, or staging demo writes were performed.

## Remaining limitations

Phase 11E found no critical failure in the tested read-only demo flows, but the live cross-tenant authenticated API 404 remains **not tested**: second-account UI denial passed, while browser navigation to the JSON endpoint was blocked. Four retained failed email jobs continue to need private operational investigation. Outbound email, assignment changes, uploads, and mutation-driven realtime delivery were intentionally not exercised on staging.

OpenAPI models shared ticket projections with optional route-dependent fields and describes webhook envelopes without attempting to enumerate every provider payload. Socket.IO, service workflow constraints, and all dynamic failure outcomes cannot be fully expressed by the HTTP schema. This work does not certify production readiness or backup restoration.

Hosted PR/CI status is recorded in the final Work output report after publication; this repository report describes the local implementation and evidence.
