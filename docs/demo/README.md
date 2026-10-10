# Northstar Support demo workspace

Phase 11E-A provides an explicitly invoked dataset for portfolio demonstrations.
The workspace is **Northstar Support [DEMO]**, with the fixed slug
`northstar-support-demo-v1`. No schema or migration changes are required.

## Architecture and dataset

The CLI lives in `apps/api/src/demo/` and is compiled by the existing `nest build`
into `dist/demo/seed-demo.js`. It uses the repository's generated Prisma 7 client,
`PrismaPg` adapter and PostgreSQL. The existing Next.js, NestJS, Auth0 and Railway
architecture is unchanged. It is not registered in an application module,
controller, startup hook, deployment command or Prisma migration/seed hook.

| Records | Initial count / behavior |
| --- | --- |
| Organization | 1, with fixed name, slug and UUIDv5 |
| Membership | 1 OWNER, referencing the explicitly selected existing user |
| Customers | 8 fictional people, distinct fictional companies, unique `example.com` addresses |
| Tickets | 12: 3 OPEN, 3 PENDING, 3 RESOLVED, 3 CLOSED |
| Priorities | LOW, NORMAL, HIGH and URGENT; 2 active tickets unassigned |
| Tags | 5 categories: Billing, Account access, Integrations, Product feedback, Onboarding |
| Tag links | 13 |
| Messages | 48: customer questions/follow-ups, member replies, and 12 internal notes |
| Audit events | 35 organization, customer, tag, ticket creation and status events |
| Deliveries / webhooks / attachments / invitations | 0 |

All fictional content is hardcoded; no production exports or real customer
personal information are used. The selected real account remains in `users` and
is referenced by the membership and audit actor foreign keys. Its profile and
other memberships are never changed by the seed.

UUIDv5 IDs derive from a reserved namespace and stable record keys. The first
run stores a dataset version, owner ID and timestamp anchor in the organization
creation audit event. Dates span the preceding 29 days, with coherent resolution,
closure and message times. Without `--as-of`, the first run uses the current time.
For a reproducible date anchor, pass `--as-of YYYY-MM-DD` (UTC midnight, non-future).
The relative ticket volume, resolutions and workload populate the existing
analytics service. Email analytics intentionally have no synthetic delivery data.

A repeat run validates the deterministic IDs, provenance, owner and tenant
relations, then reports `unchanged`. It never overwrites edits, rebases timestamps,
changes the owner, silently skips collisions, or repairs missing rows. A conflicting
slug/ID, absent provenance, changed owner/role or incomplete dataset aborts.
Use the explicit reset flow to refresh an aging dataset. New interactive records
remain intact; changed structural relations can require manual review.

Each operation uses a serializable transaction with a 5-second acquisition wait,
60-second total timeout, 30-second statement timeout and 5-second lock timeout.
A constraint error rolls back the entire seed. Concurrent runs can produce an
ID/serialization conflict; retry manually after the other transaction completes.
There is no automatic retry or destructive replacement.

The CLI writes through Prisma directly. It does not bootstrap NestJS, import
BullMQ/Resend/R2 providers, enqueue jobs, emit realtime/webhook events, create
delivery rows, send invitations or upload attachments. All sources are `MANUAL`.
Normal interactive replies after seeding still follow the application's usual
email behavior; keep demonstrations synthetic and avoid sending replies to real
recipients. No network providers are exercised by the seed itself.

## Owner and tenant access

First sign in to the intended local or staging application with a real Auth0 test
identity so the normal verified-profile synchronization creates its `users` row.
Select that existing account with **exactly one** of:

- `--owner-email your-existing-test-account@example.com` (trimmed/lowercased)
- `--owner-user-id <existing-users.id UUID>`
- `--owner-auth-provider-id 'auth0|existing-subject'` (any existing Auth0 provider subject)

The account must already exist in the selected database with a provider-shaped
`authProviderId`. The database has no separate synchronization provenance field;
the seed trusts the existing synchronization flow and does not contact Auth0.
It never creates accounts, passwords, tokens or credentials.

The existing membership and tenant guards grant the selected user OWNER access.
Their memberships in other organizations retain their roles. Other users receive
the application's existing 404 tenant-access response unless separately granted
membership. To demonstrate AGENT/VIEWER/ADMIN, use real Auth0 test identities and
the normal invitation/member management flow. This seed does not provision them.

## Local manual seed

Use the repository's supported Node 22 and pnpm 10.15.1 toolchain. Install
dependencies and generate the client if your checkout does not already have them.
Use the existing migration workflow to prepare your **local development** database;
the demo command itself never migrates or resets a database.

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter api exec prisma generate --config prisma7.config.ts
pnpm --filter api build

# Select only a local development database, for example the existing Compose port.
# Replace the connection credentials locally; do not commit them.
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://LOCAL_USER:LOCAL_PASSWORD@127.0.0.1:5433/opsdesk'

# Replace with an account that has already signed in to this local database.
pnpm --filter api demo:seed --target local --owner-email 'YOUR_EXISTING_AUTH0_TEST_EMAIL' --confirm-demo-seed
```

The CLI loads `apps/api/.env` through dotenv when invoked through pnpm, while
explicit shell variables take precedence. Review your selected environment locally
without printing credentials. `NODE_ENV` must be `development` or `test`. Only
`localhost`, `127.0.0.1` and `::1` PostgreSQL URLs are allowed. Any populated
`RAILWAY_*` context rejects the local path. Run from a clean local shell, not a
Railway shell. Docker service names such as `postgres` are deliberately excluded
from the local path; invoke it from the host using the loopback port.

To fix an anchor, append `--as-of 2026-10-10` or another valid non-future date to the
first seed. Omit it on subsequent runs to reuse the stored anchor. A different
anchor rejects the repeat run. Past fixed anchors eventually age out of dashboards.

## Railway staging: manual only

Do not deploy, change Railway variables, or execute anything in Railway as an
automatic part of seeding. After separately reviewing and deploying this code to
the intended staging service, open a manual shell for that **specific** project,
environment and API service. The runtime image already includes the compiled CLI;
pnpm and dev dependencies are not needed inside it.

Keep `NODE_ENV=production` on Railway. The guard distinguishes the staging
environment using its Railway system identifiers, not the Node runtime mode.
The environment name must be exactly `staging`. Verify the project/environment
and the database service in Railway before choosing these independent allowlists:

| Variable | Required value |
| --- | --- |
| `DEMO_STAGING_PROJECT_ID` | Verified staging project ID |
| `DEMO_STAGING_ENVIRONMENT_ID` | Verified staging environment ID |
| `DEMO_STAGING_DATABASE_HOST` | Exact staging PostgreSQL hostname |
| `DEMO_STAGING_DATABASE_PORT` | Exact staging PostgreSQL port, normally `5432` |
| `DEMO_STAGING_DATABASE_NAME` | Exact staging database name, often `railway` |

Set them temporarily in the manual staging shell after verification. Do not
derive them automatically from whatever target happens to be selected. Hostnames
must match `<service>.railway.internal` or `<proxy>.proxy.rlwy.net`. The selected
`DATABASE_URL` host, port and decoded database name must match these values.
The command's project/environment IDs must also match both the allowlists and
Railway's `RAILWAY_PROJECT_ID`/`RAILWAY_ENVIRONMENT_ID`. Do not override those
Railway-provided identity variables or rename a production environment to staging.

Inside the API container, whose working directory is `/app/apps/api`:

```sh
# Replace each placeholder with independently verified staging values.
export DEMO_STAGING_PROJECT_ID='VERIFIED_STAGING_PROJECT_ID'
export DEMO_STAGING_ENVIRONMENT_ID='VERIFIED_STAGING_ENVIRONMENT_ID'
export DEMO_STAGING_DATABASE_HOST='postgres.railway.internal'
export DEMO_STAGING_DATABASE_PORT='5432'
export DEMO_STAGING_DATABASE_NAME='railway'

node dist/demo/seed-demo.js --target railway-staging \
  --railway-project-id 'VERIFIED_STAGING_PROJECT_ID' \
  --railway-environment-id 'VERIFIED_STAGING_ENVIRONMENT_ID' \
  --owner-email 'YOUR_EXISTING_AUTH0_TEST_EMAIL' --confirm-demo-seed
```

Railway documents its [system variables](https://docs.railway.com/variables/reference)
and [manual SSH environment selection](https://docs.railway.com/cli/ssh).
The CLI does not call Railway APIs or change deployments/settings. Execution
through a remote container shell is recommended so private PostgreSQL DNS and
Railway identity variables are present; remote seeding from an ordinary local
shell fails without the full explicit staging context.

## Validate the result

From the repository root for local data:

```powershell
pnpm --filter api demo:validate --target local --owner-email 'YOUR_EXISTING_AUTH0_TEST_EMAIL'
pnpm --filter api demo:seed --target local --owner-email 'YOUR_EXISTING_AUTH0_TEST_EMAIL' --confirm-demo-seed
```

Validation is read-only. Expected outcomes are `validated` then `unchanged`, with
8 customers, 12 tickets, 5 tags, 48 messages, 13 ticket tags and 35 audit events.
These are the deterministic seed records; extra interactive records are not
included in these reported counts. Validation checks membership and tenant
relations as well as IDs. It does not require demo-edited text/status to match
the initial fixture.

For staging, use the same `node dist/demo/seed-demo.js` command and staging flags,
with `--action validate` and without `--confirm-demo-seed`.

Sign in as the selected owner, refresh the organization switcher, and choose
Northstar Support [DEMO]. Check ticket status/priority filters, tag categories,
assigned/unassigned work, conversations and audit history. The 30-day analytics
view should show twelve tickets and populated creation/resolution trends. Check
the 7-day view for recent active work and a recent resolution. Sign in with a
different real Auth0 test identity without membership; the demo must not appear
in its switcher and direct organization requests must return 404.

You can inspect the scoped database counts without exposing account details:

```sql
SELECT o.slug,
  (SELECT count(*) FROM customers c WHERE c."organizationId" = o.id) AS customers,
  (SELECT count(*) FROM tickets t WHERE t."organizationId" = o.id) AS tickets,
  (SELECT count(*) FROM tags t WHERE t."organizationId" = o.id) AS tags,
  (SELECT count(*) FROM ticket_messages m WHERE m."organizationId" = o.id) AS messages,
  (SELECT count(*) FROM audit_logs a WHERE a."organizationId" = o.id) AS audit_events
FROM organizations o WHERE o.slug = 'northstar-support-demo-v1';
```

## Reset only the demo dataset

This is a separate explicit destructive operation. Review the demo and run
validation first. From the same verified local environment:

```powershell
pnpm --filter api demo:reset --target local --owner-email 'YOUR_EXISTING_AUTH0_TEST_EMAIL' --confirm-demo-reset northstar-support-demo-v1
```

For staging, use `node dist/demo/seed-demo.js --action reset`, the same staging
target/project/environment/owner flags, and
`--confirm-demo-reset northstar-support-demo-v1`. The seed confirmation flag
does not authorize a reset.

Reset requires the deterministic organization ID, fixed slug/name, audit marker,
same owner and complete seed records. It checks for extra memberships, customers,
tickets, tags, messages, links, audits, invitations, attachments, deliveries and
external references to seeded records. If any exist, it aborts without deleting
anything: review those records manually and preserve any material you need.
This deliberately refuses an organization that has accumulated interactive data
or real test identities; it never silently removes them. Incomplete seeds also
need manual review rather than automatic repair. Simple text/status edits do not
prevent reset.

For a verified pristine dataset, PostgreSQL cascades remove only that demo
organization and its children inside the same transaction. The shared user is
retained, along with every other organization and membership. A second reset
reports `absent`. Run the seed again afterward to refresh the timestamp anchor.
Never use `prisma migrate reset`, database truncation, global `deleteMany`, schema
deletion, Redis flushing or R2 deletion to reset this workspace.

## Production and real-tenant protection

Both write operations require explicit confirmation before connecting. Production
markers in `APP_ENV`, `ENVIRONMENT`, `DEPLOYMENT_ENV` or Railway's environment name
are rejected, as are production-labelled database hosts/names. Connection URL
query parameters other than `sslmode` are rejected to prevent host/search-path
overrides. Local production runtime mode is rejected; Railway production runtime
mode is permitted only with the full staging checks above.

These are safeguards against accidental targeting, not proof of database origin.
A loopback tunnel or deliberately incorrect staging allowlists can misidentify a
database. Do not forward production databases to a permitted loopback port. Use
separate staging credentials/resources, verify the independently selected target,
and never repoint staging at production or copy its allowlists into production.
No real organization is selected by name alone or modified to become the demo.

## Automated checks

```powershell
pnpm --filter api build
pnpm --filter api lint
pnpm --filter api test

# Dedicated disposable local test database; never .env/DATABASE_URL fallback.
$env:DEMO_TEST_DATABASE_URL = 'postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/opsdesk_demo_test'
pnpm --filter api test:demo:db
```

Database tests require loopback PostgreSQL and a database name containing a
`test` or `ci` segment. They create a random temporary schema, apply the existing
migrations only inside it, and remove that schema afterward. Mock Auth0 profiles
exercise the real user synchronization and tenant guard in this isolated schema;
they cannot authenticate with Auth0. Production and staging account sign-in still
requires the manual smoke check above. Integration tests also reject any import
of BullMQ, Resend, the R2 S3 client or Nest's bootstrap module, and assert zero
delivery/webhook/attachment/invitation records. CI runs the demo tests in its
existing PostgreSQL service.

See [implementation validation](VALIDATION.md) for commands, results and the
remaining environment limitations of this implementation session.
