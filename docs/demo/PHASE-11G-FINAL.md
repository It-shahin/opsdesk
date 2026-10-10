# Phase 11G final verification

Date: 2026-10-10 UTC. Scope: staging portfolio release on
`feat/phase-11-deployment`. Detailed request correlations, measurements,
limitations and commands are in [the full report](../PHASE-11G-REPORT.md).
Status: **staging portfolio complete; not production-ready**.

## Release matrix

| Deliverable / check | Result | Evidence |
| --- | --- | --- |
| 11G-A email diagnosis and monitoring | PASS | Four historical sandbox-recipient rejections identified; safe code/status diagnostics and consumer/history signals added; failed jobs preserved |
| Controlled outbound / inbound lifecycle | PASS | One approved synthetic reply reached DELIVERED; actual mailbox reply routed to the same ticket and appeared live |
| 11G-B real tenant isolation | PASS | A legitimate nonmember received BFF/API 404 before the user independently granted Agent membership |
| Ticket, messages, realtime, R2 | PASS | Status/assignment 200, notes 201, actual cross-session updates, 70-byte signed upload/download content match |
| Auth, RBAC, CSRF, rate limits, contracts | PASS | Automated regressions; live unauthorized access 401 and public documentation 404; no guards weakened |
| 11G-C desktop/mobile and accessibility basics | PASS | Live 1440/390-pixel layouts, loading/error/empty states, Geist font and actual keyboard skip-link checks |
| Missed-event reconnect recovery | PASS | Exactly one missed event; UI NORMAL before reconnect → LOW after reconnect, then guarded cleanup to CLOSED/NORMAL |
| Repeatable performance measurements | PASS (limited) | Five BFF requests median 170 ms; three warm authenticated reloads to content median 554 ms; no performance certification |
| 11G-D CI / builds / documentation | PASS | API unit 445, hosted E2E 199, database integration 40, web auth 11, security/recovery 48; lint, OpenAPI and hosted Docker gates passed |
| Local full Redis E2E | FAIL (environment) | Local Redis unavailable: 177 passed, 20 failed, 41 skipped; full hosted Redis E2E passed |
| Local PostgreSQL / Docker | NOT TESTED | Local daemon unavailable; separate hosted DB and Docker jobs passed |
| Field vitals, capacity, all delivery failure modes | NOT TESTED | No field dataset/load test or controlled live bounce/complaint exercise |
| Arbitrary-recipient email / production recovery | NOT TESTED | Development sender restriction; paid backups declined and no restore drill |
| Final staging runtime rollout | PASS | Merge `a4125c4`, all five services SUCCESS/no pending work; eight public probes pass, fresh worker heartbeats and unchanged retained failures |

## Release trail

- [PR #13](https://github.com/It-shahin/opsdesk/pull/13): primary release,
  merge `1439b5c45ace86b8eb384687f4713da51e3d0d56`. User reviewed and approved
  staging after Sourcery requested a human reviewer for the logging change.
- [PR #14](https://github.com/It-shahin/opsdesk/pull/14): focused reconnect
  recovery and authentic screenshots, merge
  `a4125c4ae4d21c5db4b56fbc9228070415ed7171`.
  Exact-head [CI 38062892907](https://github.com/It-shahin/opsdesk/actions/runs/38062892907)
  passed all five jobs; Sourcery's updated check passed and both findings were
  resolved. The valid timing-gap finding was fixed with acknowledgment ordering;
  committed GitHub blob metadata disproved the missing-image finding.

The merge's automatic [push CI 38063542294](https://github.com/It-shahin/opsdesk/actions/runs/38063542294)
passed all five jobs before Railway released builds. At 15:30 UTC all services
were successful and no pending work remained:

| Service | Runtime deployment ID |
| --- | --- |
| Web | `096dd626-4fbd-440e-9c7e-305c5f0cea0c` |
| API | `5823b2bd-117f-48d4-81a0-490f8fad1306` |
| Worker | `2a1d65c8-8e51-4ba2-959f-9adab8d082bd` |

The deployed recovery test returned 200/LOW (request
`522dc761-97dd-47ac-b823-dbfd5cc0ee2c`), dropped one event, and observed LOW
after reconnect without reload. A later BFF read confirmed CLOSED/NORMAL after
cleanup. Web health/API live/ready returned 200, unauthorized ticket access 401,
and four Swagger/OpenAPI paths 404. Email queue at 15:30:58 UTC had waiting 0,
active 0, delayed 1, failed 4, one fresh consumer, unchanged retained failures and
the preserved degraded warning. Both worker consumers were healthy.

The documentation delivery records this tested runtime snapshot; later commits
containing only documentation do not represent a new feature or a claim of
continuous monitoring. Repository PR/check history records their final delivery.

## What changed and why

The request path remains browser → Auth0-backed Next.js BFF → JWT-validated
NestJS API → tenant-scoped PostgreSQL. REST tokens stay server-side; Socket.IO
uses the existing authenticated, private/no-store token endpoint and validates
room membership separately. No identities, permissions or provider settings
were created or changed by this release.

Public replies persist delivery state and queue BullMQ work; the worker sends
through Resend, and signed webhooks reconcile delivery or ingest replies.
Allowlisted diagnostics expose useful codes/statuses without raw provider
messages. Queue monitoring retains the degraded warning while distinguishing
healthy consumers from historical failures. This is an in-memory net count
trend, not an error rate.

Realtime recovery subscribes to authorized rooms before refetching snapshots,
covering missed events and writes during rejoin. Initial connection avoids extra
fetches; reconnects incur bounded reads and replace one notification. The change
restores consistency after interruptions without promising uninterrupted sockets.

## Data and production boundary

Only the named synthetic release customer/ticket was created or changed by the
integration exercise. The ticket remains CLOSED with NORMAL priority; messages,
audit history and the synthetic attachment remain available. No failed job,
customer row or R2 object was deleted, and no outbound job was replayed.

Account/email/assignee identities were masked in authentic
[desktop](../images/phase-11g-desktop.png) and
[mobile](../images/phase-11g-mobile.png) screenshots. The approved recipient,
tokens, passwords, signed URLs and raw provider payloads are omitted.

Production promotion still requires separate authorization, a verified sending
domain, a tested backup/restore plan and decisions on alerting, attachment
scanning and capacity. See [the production checklist](../PRODUCTION-READINESS.md).
No production/default-branch deployment or paid resource change was performed.
