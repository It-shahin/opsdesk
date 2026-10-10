# Phase 11E final staging verification

Date: 2026-10-10 (Africa/Casablanca). Target: Railway **staging** only.
Application commit: `709008c90c749ea858df2b95bace2ac64a031481`, the demo merge on
`feat/phase-11-deployment`. No critical failure was found in the tested demo
flows. Proceed to Phase 11F with the limitations below; this is not an unrestricted
production certification.

| Check | Result | Evidence |
| --- | --- | --- |
| Deployment inventory | PASS | API, web, worker, PostgreSQL and Redis online; no pending changes, warnings or critical notifications in Railway's environment status; no recent deployment failures in the tool's default window |
| Deployed source | PASS | API, web and worker all report deployment commit `709008c`, source branch `feat/phase-11-deployment` |
| Public readiness | PASS | API `/health/ready` returned 200, database and Redis `up`; web `/api/health` returned 200 |
| Unauthenticated API boundary | PASS | GET API `/v1/organizations` without credentials returned 401, `Missing access token` |
| Owner/demo visibility | PASS | Existing real owner signed in normally; Northstar Support [DEMO] visible, OWNER role, 12 tickets |
| Deterministic records | PASS | Existing guarded staging CLI returned `validated`: 8 customers, 12 tickets, 5 tags, 48 messages, 13 ticket-tag links, 35 audit events |
| Status filter | PASS | OPEN returned 3 matching tickets |
| Combined priority filter | PASS | OPEN + URGENT returned exactly the dispatch dashboard ticket |
| Tags | PASS | Switcher offers Account access, Billing, Integrations, Onboarding, Product feedback |
| Conversation | PASS | Dispatch dashboard ticket displayed 4 seeded messages, including an internal note and an assigned owner; no reply submitted |
| 30-day analytics | PASS | 12 created, 6 resolved, 6 active, 8 active customers; populated creation/resolution chart; statuses 3 each; priorities LOW 3 / NORMAL 3 / HIGH 4 / URGENT 2 |
| 7-day analytics | PASS | 6 created, 1 resolved; populated daily creation trend and recent resolution on 6 October |
| Team and assignments | PASS (read-only) | One OWNER membership; no invitations; dashboard workload 2 open + 2 pending assigned, 2 active unassigned; no membership, assignment or role mutation |
| Organization switching | PASS | Owner switched to another existing workspace, showing its own 1 ticket, then back to demo with 12 tickets |
| Realtime connection | PASS (read-only) | Live connection indicator on demo inbox, conversation and dashboard; no event-producing mutations exercised |
| Second real account visibility | PASS | Existing second real Auth0 account had only its existing memberships, with demo absent from workspace list |
| Second real account direct demo page | PASS | Direct demo `/app/{organizationId}` displayed “Not found” and access-denial text |
| Live authenticated API cross-tenant 404 | NOT TESTED | Browser blocked navigation to the BFF JSON endpoint (`ERR_BLOCKED_BY_CLIENT`); no matching API 404 log was obtained. UI denial is not proof of the API status. No tokens extracted, new accounts generated or identity impersonated |
| Outbound email, uploads, mutations | NOT TESTED (by design) | Explicit read-only scope; no tickets/replies/invitations/uploads created and no demo data changed |

## CLI validation safeguards and evidence

The existing CLI was inspected before execution: `--action validate` selects only
read paths and fails if the dataset is absent. Validation runs inside a transaction
with local statement/lock timeouts; it does not run the seed/reset write branches.
The existing registered SSH identity was used; no SSH credentials were created or
registered. The project, staging environment and API service were selected
explicitly. Independently known staging identifiers and the PostgreSQL host,
port and database were supplied as temporary command-scoped allowlists. Railway's
own identity variables and `NODE_ENV` were not overwritten.

Redacted command pattern (replace placeholders only with independently verified
staging values, and use an existing synchronized user):

```sh
railway ssh --project VERIFIED_PROJECT --environment VERIFIED_STAGING_ENV \
  --service VERIFIED_API_SERVICE --identity-file EXISTING_KEY -- \
  env DEMO_STAGING_PROJECT_ID=VERIFIED_PROJECT \
      DEMO_STAGING_ENVIRONMENT_ID=VERIFIED_STAGING_ENV \
      DEMO_STAGING_DATABASE_HOST=VERIFIED_STAGING_DB_HOST \
      DEMO_STAGING_DATABASE_PORT=5432 \
      DEMO_STAGING_DATABASE_NAME=VERIFIED_STAGING_DB_NAME \
  node /app/apps/api/dist/demo/seed-demo.js --action validate \
    --target railway-staging --railway-project-id VERIFIED_PROJECT \
    --railway-environment-id VERIFIED_STAGING_ENV --owner-user-id EXISTING_USER_UUID
```

The actual execution used the existing owner selector privately; it is deliberately
excluded here. Validator exit status was 0 with `outcome: validated`.

## Operational warning and remaining work

Runtime API logs repeatedly report the email queue `degraded`, with **4 retained
failed jobs**, waiting 0, active 0, delayed 1, backlog 0 and one live worker.
Maintenance is `up`; worker heartbeats report both consumers healthy. Email
recovery logs found zero pending deliveries and queued zero jobs. Railway's
deployment health does not capture this application-level warning. The source
monitor marks any retained failed count degraded; it does not establish whether
these failures are current or historical. No jobs were retried, cleared or sent.
Review failed-job causes privately using the [runbook](../operations/runbook.md).
This warning did not block the read-only demo/documentation stage.

The specific live API cross-tenant 404 remains to be checked with the second real
account through an authenticated, supported API client. Existing isolated tenant
tests and seed validation are useful code evidence but do not replace that live
test. Team assignment changes, email deliverability and actual event delivery were
not tested in this read-only verification.

No production operations, paid resources, plan upgrades, backup purchases,
database resets, schema migrations, application deployments or demo mutations
were performed. Normal sign-in and organization preference switching were the
only intentional browser state changes. Screenshot evidence uses only the seeded
synthetic workspace, with no account email, credential or signed URL shown.
