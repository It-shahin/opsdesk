# Phase 11E-A implementation validation

Validated on 2026-10-10 in `C:\Users\Lenovo\Documents\opsdesk`, on
`feat/phase-11-demo`. The starting working tree was clean and the Git remote was
`https://github.com/It-shahin/opsdesk.git`. No commits, pushes, deployments,
Railway changes or operational database seeding were performed.

## Files changed

| File | Change |
| --- | --- |
| `apps/api/src/demo/demo-data.ts` | Deterministic UUIDv5 IDs and synthetic tenant dataset |
| `apps/api/src/demo/demo-options.ts` | CLI parsing, owner selectors, confirmation and target safeguards |
| `apps/api/src/demo/demo-seed.ts` | Transactional seed, validation, provenance and isolated reset |
| `apps/api/src/demo/seed-demo.ts` | Standalone PrismaPg/Prisma CLI and redacted database error reporting |
| `apps/api/src/demo/demo-data.spec.ts` | Dataset, tenancy, timestamps and UUID tests |
| `apps/api/src/demo/demo-options.spec.ts` | Argument and local/staging production-safeguard tests |
| `apps/api/test/demo-database.e2e-spec.ts` | PostgreSQL seed/access/isolation/side-effect/reset integration tests |
| `apps/api/package.json` | Manual seed/validate/reset and opt-in database test commands |
| `.github/workflows/ci.yml` | Demo integration tests using the existing disposable CI PostgreSQL service |
| `docs/demo/README.md` | Architecture, commands, staging procedure, validation and reset instructions |
| `docs/demo/VALIDATION.md` | This file: change inventory, executed checks and remaining limitations |

No schema, migration, lockfile, authentication, application-module, frontend,
Docker or Railway configuration changes. The Nest build incidentally regenerated
already tracked `dist/app.module.js`, its source map and
`tsconfig.build.tsbuildinfo`; those unrelated generated differences were restored
to the clean starting versions. The compiled demo remains ordinary ignored build
output. A temporary `tsconfig.demo-check.json` used only for validation was removed.

## Checks and results

| Check | Result |
| --- | --- |
| `pnpm --filter api build` | Passed; compiled standalone `dist/demo/seed-demo.js` |
| `pnpm --filter api lint` | Passed; two existing warnings, none in new files |
| `pnpm --filter api test` | 43 suites / 433 tests passed |
| `pnpm --filter api test:e2e` | 15 suites / 199 tests passed; 3 database suites / 40 tests skipped by their normal opt-in gates |
| `pnpm --filter api test:demo:db` | 13 PostgreSQL tests passed, separately opted in |
| Targeted demo data/options tests | 2 suites / 32 tests passed initially; another production-host case was then added and passed in the full unit run |
| TypeScript check limited to new demo source/tests | Passed using the existing spec compiler configuration |
| `pnpm --filter api exec prettier --check src/demo test/demo-database.e2e-spec.ts` | Passed |
| Compiled CLI in local `NODE_ENV=production` | Correctly rejected, exit 1, before a database connection |
| Compiled CLI without `--confirm-demo-seed` | Correctly rejected, exit 1, before a database connection |
| `git diff --check` | Passed |

The database tests used a separate disposable PostgreSQL 17 container at
`127.0.0.1:55432`, database `opsdesk_demo_test`, with test-only credentials. All
fixtures/migrations were confined to random `demo_test_*` schemas and removed by
the tests. API end-to-end tests used a separate disposable Redis 7 container at
`127.0.0.1:56379`. Both containers were stopped and removed after validation.
Existing OpsDesk PostgreSQL/Redis containers were left running and unchanged.

The thirteen PostgreSQL cases cover missing/unsynchronized owners, full rollback
on cross-tenant ID collisions, first creation, byte-for-byte logical repeat-run
preservation, actual owner/outsider tenant guard behavior, child relations and
analytics, production/confirmation rejection before transactions, forbidden
outbound integration imports and zero side-effect records, preservation of edits,
incomplete-dataset refusal, reset refusal on interactive/external records, safe
reset/reseed, and organization identity/provenance conflicts.

Initial checks found two errors in the new owner-selector type annotation and a
test request cast; both were corrected. The first database test run also exposed
a test-fixture timestamp changed while exercising reset rejection; the fixture
now restores that timestamp. These issues are resolved in the passing results
above.

## Commands executed

Repeated identical inspection/build/test commands are listed once. Shell-only
inspection was read-only; no environment-file contents or real credentials were
printed. File edits used `apply_patch`, and formatting used Prettier.

Repository discovery and inspection:

```powershell
Get-Location
git status --short
Get-ChildItem apps/api/src/demo -Name
Get-ChildItem docs/demo -Name
git branch --show-current
git remote -v
git diff --stat
git diff -- .github/workflows/ci.yml apps/api/package.json
git ls-files apps/api/dist apps/api/tsconfig.build.tsbuildinfo
rg --files -g AGENTS.md -g package.json -g '*schema*' -g 'prisma.config.*' -g 'tsconfig*.json' -g '*jest*' -g '*eslint*' -g '!node_modules' -g '!dist'
rg --files apps/api/src apps/api/test docs -g '!generated/**'
rg --files -g '*lock*' -g '*railway*' -g '*docker*' -g '*prisma*' -g '.env*' -g '!node_modules' -g '!dist'
rg --files apps/api/src/auth apps/api/src/tenancy apps/api/src/queue
rg --files apps/api/src | Select-String 'message|queues'
rg -n 'NODE_ENV|RAILWAY_|APP_ENV|ENVIRONMENT' apps/api/src/config* apps/api/Dockerfile .github docs apps/api/src -g '!generated/**' -g '!*.spec.ts' -g '!client.ts' -g '!models*'
rg -n 'enqueue|EmailDelivery|createMessage' apps/api/src/tickets/tickets.service.ts
rg -n 'actor|metadata|previousStatus|nextStatus' apps/api/src/audit/audit.service.ts apps/api/src/tickets/tickets.service.ts
rg -n 'dotenv|new Redis|process.env|new Queue|new Worker' apps/api/test/*.ts apps/api/src/tenancy/tenancy.e2e-spec.ts
rg -n 'dotenv|new Redis|process.env|new Queue|new Worker' apps/api/test -g '*.ts'
Get-Command node,pnpm,docker,psql -ErrorAction SilentlyContinue | Select-Object Name,Source
Test-Path node_modules
Test-Path apps/api/src/generated/prisma/client.ts
node --version
pnpm --version
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'
```

`Get-Content` inspections covered the Prisma schema/config; root/API package
files; API tsconfig/build/spec, Nest and Jest configurations; Dockerfile and
Compose configuration; CI and operations runbook; user synchronization and
organization/membership services; tenant context/guard and existing tests;
Auth0 user-info/types; audit/ticket and analytics services; migration SQL; and
the newly written demo files. The Auth0 skill and its security/Next.js references
were also read. Several initial path probes did not exist (`src/prisma`,
`src/auth/organization.guard.ts`, `src/queue`,
`src/email/outbound-email-queue.service.ts`,
`src/queue/email-queue.service.ts`, `src/ticket-messages`); actual paths were
resolved through the file inventory. Two PowerShell wildcard `rg` probes reported
path errors; the subsequent directory-based search succeeded.

Tooling, formatting and checks:

```powershell
pnpm --filter api exec prettier --write src/demo test/demo-database.e2e-spec.ts
pnpm --filter api exec prettier --check src/demo test/demo-database.e2e-spec.ts
pnpm --filter api build
pnpm --filter api lint
pnpm --filter api test -- --runTestsByPath src/demo/demo-options.spec.ts src/demo/demo-data.spec.ts
pnpm --filter api test
pnpm --filter api exec tsc --project tsconfig.spec.json --noEmit
pnpm --filter api exec tsc --project tsconfig.demo-check.json --noEmit

$env:DEMO_TEST_DATABASE_URL='postgresql://demo_test:demo_test_only@127.0.0.1:55432/opsdesk_demo_test'
pnpm --filter api test:demo:db

$env:NODE_ENV='test'
$env:REDIS_URL='redis://127.0.0.1:56379'
pnpm --filter api test:e2e

# Negative compiled-CLI smoke checks: expected exit 1.
$env:NODE_ENV='production'
$env:DATABASE_URL='postgresql://demo_test:demo_test_only@127.0.0.1:55432/opsdesk_demo_test'
node apps/api/dist/demo/seed-demo.js --target local --owner-email owner@example.com --confirm-demo-seed
$env:NODE_ENV='development'
node apps/api/dist/demo/seed-demo.js --target local --owner-email owner@example.com
```

Disposable services and cleanup:

```powershell
docker run --rm --detach --name opsdesk-demo-phase11-tests --publish 127.0.0.1:55432:5432 --env POSTGRES_DB=opsdesk_demo_test --env POSTGRES_USER=demo_test --env POSTGRES_PASSWORD=demo_test_only postgres:17-alpine
docker run --rm --detach --name opsdesk-demo-phase11-redis-tests --publish 127.0.0.1:56379:6379 redis:7-alpine
docker stop opsdesk-demo-phase11-tests opsdesk-demo-phase11-redis-tests
git restore --worktree -- apps/api/dist/app.module.js apps/api/dist/app.module.js.map apps/api/tsconfig.build.tsbuildinfo
git diff --check
git status --short
```

The Docker named-pipe inspection initially lacked sandbox access; the approved
local Docker invocation succeeded. Restoring the three generated files also
required an approved invocation because Git creates an index lock even for this
worktree-only operation. Both succeeded; no automatic approval-review rejection
blocked the work. Official Prisma 7 transaction and Railway variables/SSH
documentation was checked while designing the transaction and staging guards.

## Remaining limitations

- The execution host used Node **24.14.0**, pnpm **10.15.1**. The repository's
  supported Node 22 matrix remains covered by the unchanged CI toolchain; this
  session did not execute that CI job or a separate Node 22 build.
- API lint retains existing `no-unused-vars` in `users.service.ts` and
  `no-control-regex` in `attachments/attachment-policy.ts`. They are unrelated
  to this change and were left unchanged.
- The optional broad `tsconfig.spec.json` no-emit check fails on existing Jest
  mock typing errors in unchanged test files. Nest's normal build, Jest suites,
  and a no-emit check of the new source/tests pass. The broad check is not an
  existing CI requirement.
- Real Auth0 login was not performed. Tests use the actual synchronization and
  tenant guard with isolated mock profiles; they create no usable Auth0 accounts.
  Before a portfolio demo, supply the real existing owner selector, seed the
  verified local/staging target, and perform the manual sign-in checks in README.
- No actual Railway or active workspace database was seeded. A selected owner
  and independently verified staging identifiers are required to do that manually.
- Staging allowlists depend on correct operator configuration. They cannot prove
  that a loopback tunnel or misconfigured staging connection is not production.
