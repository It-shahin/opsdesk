# OpsDesk incident response and rollback

## Deployment inventory

Open the Railway project hosting OpsDesk and select the affected environment.
The intended staging source is `feat/phase-11-deployment`; confirm the configured
branch in each service's Settings > Source. Record the deployed commit and deployment ID
for `api`, `worker`, and `web`; a GitHub push can deploy these independently.

| Service | Process / role | Check |
| --- | --- | --- |
| web | `node apps/web/server.js` | `GET /api/health` returns 200 |
| api | `node dist/main.js` | `GET /health/ready` returns 200 |
| worker | `node dist/worker.js` | fresh `worker.heartbeat` and healthy `queue.health` logs |
| PostgreSQL | durable application data | database status `up` in readiness |
| Redis | BullMQ queues and realtime | Redis status `up` in readiness |

Node 22 and pnpm 10.15.1 are the repository's supported toolchain. Web tests use
Node 22's `--experimental-test-isolation=none` flag. Deployment variables belong
to their Railway environment; database, Redis, R2 bucket, and email credentials
must point to that environment's resources. Keep `NODE_ENV=production` on Railway.

## First ten minutes

1. Assign an incident owner and start a timeline in UTC. Record environment,
   affected functions, first observed time, request IDs, deployment IDs, and the
   last known-good commit. Treat a full outage or suspected data loss as P1;
   delayed background work with a working API is P2 until impact shows otherwise.
2. Pause automatic deployments for affected services and cancel pending bad
   releases. Preserve logs and deployment configuration before restarting.
3. Probe web, API readiness, and API liveness. Readiness checks PostgreSQL and
   Redis with a two-second timeout; liveness only proves the API process is alive.
   Queue health is independent of readiness: a ready API can have a dead worker.
4. Check service deployment/crash history, database and Redis availability, and
   recent code, variable, domain, provider, or migration changes.
5. Choose containment: roll back a bad release, restart a wedged process, or repair
   the dependency. If a worker is producing harmful side effects, stop its active
   deployment before investigating. Preserve its Redis queue and database data.
6. Send impact/status updates through the team's normal incident channel. Never
   paste credentials, message bodies, customer paths, or signed attachment URLs.

For public probes, replace the example hostnames with this environment's domains:

```powershell
Invoke-RestMethod https://staging-web.example.com/api/health
Invoke-RestMethod https://staging-api.example.com/health/live
Invoke-RestMethod https://staging-api.example.com/health/ready
```

For a local Docker reproduction, run from the repository root:

```powershell
docker compose --env-file compose.env -f compose.docker.yml ps -a
docker compose --env-file compose.env -f compose.docker.yml logs --tail 100 api worker migrate
```

## Queue and heartbeat signals

The API samples `email` and `maintenance` queues every 30 seconds, starting 30
seconds after bootstrap. `QueueHealth` emits `queue.health` with only queue name,
state counts, paused flag, waiting backlog, and number of fresh worker instances.
There are no job payloads or customer identifiers in these monitoring events.

| Signal | Meaning | First action |
| --- | --- | --- |
| `status=up` | at least one fresh consumer; no retained failures, pause, or large backlog | watch trends |
| `status=down`, `workersAlive=0` | no fresh consumer for that queue | inspect worker logs and Redis connectivity |
| `status=down`, `reason=probe_failed` | Redis/queue probe failed or exceeded two seconds | inspect Redis, latency, and connection settings |
| `status=degraded`, `paused=true` | queue is paused | determine why before deliberately resuming it |
| `status=degraded`, `backlog>=100` | at least 100 waiting jobs | check consumer capacity, slow jobs, and provider limits |
| `status=degraded`, `counts.failed>0` | failed jobs retained in BullMQ | correlate with worker failure events and delivery state |
| `worker.heartbeat.failed` | heartbeat publication failed | check Redis and worker connection state |

Each worker writes a heartbeat every 15 seconds only for consumers whose run loop
is active, unpaused, and whose Redis connection is ready. Heartbeats expire after
75 seconds. The Redis sorted sets `opsdesk:observability:workers:email` and
`opsdesk:observability:workers:maintenance` contain random instance IDs and timestamp
scores. Replicas have independent IDs. Orderly shutdown removes only that
instance's membership; a crash is detected by expiry. A pause/stop removes that
consumer's heartbeat at the next tick.

A fresh heartbeat proves a live consumer loop, not successful delivery. Check
`email.job.completed`, `email.job.failed`, `email.worker.error`,
`maintenance.completed`, `maintenance.failed`, and `maintenance.worker.error` too.
Delayed scheduled jobs are not part of the waiting backlog. Failed counts are
retained history, not a rate: a single old failed job can keep the queue degraded
until it is retried or ages out. Email failures are retained up to seven days and
5,000 jobs; maintenance failures up to seven days and 500 jobs.

Configure the log/monitoring system to alert on two consecutive down samples,
a growing backlog across samples, repeated heartbeat failures, and missing API
samples for more than 90 seconds. Monitoring code emits signals; it does not
provision an external alert destination. Allow startup/rollout grace for the
75-second heartbeat expiry plus one 30-second sample interval. If deploying older
workers without heartbeats, new monitors report them down until upgraded.

## Diagnose and recover

### API unavailable / readiness 503

Compare `/health/live` with `/health/ready`. A live API with failed readiness points
to a dependency; restart loops or failed liveness point to startup/runtime issues.
Check missing variables, private DNS, ports, database authentication, resource
exhaustion, and recent migrations. A healthy PostgreSQL container alone does not
prove the application's credentials work. Changing `POSTGRES_PASSWORD` does not
change the password inside an already initialized Docker volume.

### Worker down / email delayed

Verify the worker uses `node dist/worker.js`, not the API entrypoint, and shares the
API's environment-specific `DATABASE_URL` and `REDIS_URL`. Inspect heartbeat and
failure events. Check provider outages/rate limits and the database delivery state
before any manual retry; prevent duplicate customer messages. Preserve queues and
use the existing delivery recovery flow rather than generating replacement jobs.
Restart the worker once the cause is repaired and verify both queue heartbeats.

### Web healthy but requests or login fail

Check API readiness, `API_SERVER_URL` private address/port, `WEB_ORIGIN`, Auth0
issuer/audience, callback/logout allowlists, and the browser's public realtime URL.
`NEXT_PUBLIC_*` values and the web CSP are embedded at build time: correcting only
runtime variables is insufficient; rebuild the web image with the correct values.

### Redis loss / failed maintenance

Stop further harmful worker actions and assess persistence/provider status. Do not
flush Redis or obliterate queues to clear an alert. Recover Redis, then verify job
schedulers and delivery recovery. For attachment cleanup failures, check R2
availability/permissions and observe a successful maintenance run before closing
the incident. Never delete PostgreSQL or R2 data to fix queue health.

## Application rollback on Railway

1. Pause autodeploy for the affected services and cancel pending releases.
2. Identify a known-good deployment for each affected service from the same
   environment. API and worker should use compatible application commits.
3. Check whether migrations applied after that commit. Confirm the older API and
   worker still support the current database schema and queued job formats.
   Prefer a forward fix when a destructive schema change prevents safe rollback.
4. Open the service > Deployments > last known-good deployment > three-dot menu >
   Rollback, then confirm. Repeat for the affected API, worker, and web services.
   Railway restores the deployment's image and custom variables: recheck secret
   rotations, environment-specific references, and domains after rollback.
5. Validate web health, API readiness, login, realtime, a controlled ticket flow,
   both queue heartbeats, and backlog trend. Use staging/test recipients for email
   checks; do not send an incident smoke test to a customer.
6. Keep autodeploy paused until the branch contains the reviewed revert/fix and
   CI succeeds. Re-enable it deliberately; otherwise the bad commit can redeploy.

If Railway no longer retains the old image, rebuild/deploy the recorded good
commit with the verified environment configuration. Do not reset or force-push
shared branch history as an emergency rollback mechanism.

[Railway rollback behavior](https://docs.railway.com/deployments/deployment-actions)
also explains retention constraints. Application rollback does not undo database
migrations or restore database/Redis/R2 contents. GitHub push deployments of the
three application services are independent; do not assume Compose-style ordering.

## Migration failure and data recovery (Prisma 7.10)

Only the API release should run the pre-deploy command:

```sh
./node_modules/.bin/prisma migrate deploy --config prisma7.config.ts
```

Before schema changes, verify a recoverable database backup and review SQL for
compatibility with the currently running API and worker. Prefer additive changes
and separate deployments for data backfills and destructive changes.

For a failed migration, preserve PostgreSQL logs and inspect its migration record.
Inside the API image, run the read-only status check:

```sh
./node_modules/.bin/prisma migrate status --config prisma7.config.ts
```

Repair the root cause and determine which SQL actually executed. For a partially
applied failed migration, a reviewed repair may require `migrate resolve
--rolled-back <migration-name>` or `--applied <migration-name>` with the same
config. These commands change migration history; they do not reverse SQL or
restore data. Do not mark a successful migration rolled back, edit applied
migrations, run `migrate reset`, or use `db push` against staging/production.
See the [Prisma resolve reference](https://docs.prisma.io/docs/cli/migrate/resolve).

For suspected data corruption/loss, stop writes and affected workers. Restore the
verified backup to a separate database, validate its schema/data and recovery point,
then plan a controlled switch of API and worker connection variables. Keep the
original database for investigation and reconcile writes after the recovery point.
Restoring data is a separate operation from rolling back application images.

## Close the incident

Confirm sustained healthy probes, fresh consumers on both queues, stable/decreasing
backlogs, and expected provider operations. Record the recovery commit/deployment,
timeline, impact, data/queue reconciliation, and any remaining retained failed jobs.
Write a short follow-up with cause, detection gap, and corrective actions. Validate
these commands on Node 22 before promoting the fix:

```sh
pnpm install --frozen-lockfile
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter web lint
pnpm --filter web test:auth
pnpm --filter web test:security
pnpm --filter web build
```

Database integration tests require an isolated test database; never point
`test:audit:db` or `test:analytics:db` at an operational environment.
