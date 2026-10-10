# Phase 11G staging release verification

Verification date: **2026-10-10 UTC**. Source baseline:
`aa2259b5dd029735d5378f9cd880bd07b76bf2db` (merged Phase 11F PR #11).
Release branch: `feat/phase-11-release`; target: `feat/phase-11-deployment`.
Scope is staging portfolio release, **not production certification**.

## Release matrix

PASS means observed evidence for the stated scope. NOT TESTED means no claim of
success. A local environment failure is separate from hosted CI verification.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| 11G-A: retained email failure diagnosis | PASS | Four retained jobs, one attempt each, permanent provider rejection; correlated provider logs confirm sandbox recipient restriction |
| Current approved sandbox outbound | PASS | One synthetic public reply, worker completion, provider sent/delivered events, application DELIVERED state |
| Actual inbound routing and realtime | PASS | User replied from approved mailbox; received webhook success and CUSTOMER public message on same ticket; open owner conversation updated without reload |
| Historical failure preservation | PASS | No retry/replay/delete; initial waiting 0, active 0, delayed 1, failed 4, workers 1 |
| Arbitrary recipients / verified custom sending domain | NOT TESTED | Connected provider has no verified sending domains; development sender limitation remains |
| 11G-B: real authenticated nonmember 404 | PASS | Supported BFF GET to demo tickets returned 404; matching API request log at 11:31:45 UTC |
| Synthetic status, assignment, internal notes | PASS | PATCH status/assignee 200; internal note 201; assignment reflected in owner UI |
| Actual cross-session realtime | PASS | Owner inbox gained new ticket without reload; open conversation received notes, attachment and inbound reply |
| R2 lifecycle | PASS | Init 200, signed PUT 200, complete 200, note link 201, authorized signed GET 200, exact 70-byte content match |
| API unit regression | PASS | 44 suites / 445 tests locally, including safe diagnostics and retained count trends |
| Security E2E | PASS | 26 tests locally; synthetic auth/RBAC/tenancy/CSRF/rate-limit coverage |
| Web auth / security | PASS | 11 auth and 48 security/recovery tests locally (44 on primary release plus 4 follow-up recovery regressions) |
| API/web lint and builds | PASS | Both pass; 2 existing lint warnings per app; no new errors |
| Offline OpenAPI / viewer guards | PASS | 38 HTTP operations; 3 viewer safeguard tests; drift check passes |
| Full local Redis E2E attempt | FAIL (environment) | No local Redis daemon: realtime connection tests failed; 177 passed, 20 failed, 41 skipped in partial run |
| Local PostgreSQL integration / Docker images | NOT TESTED | Docker engine unavailable; no disposable local DB/Redis. Hosted CI required |
| Hosted CI and Docker gates | PASS | [Run 38060843349](https://github.com/It-shahin/opsdesk/actions/runs/38060843349): all five jobs passed on code commit `87ba3c784666eedda586da4e95a1fea11542afa4`; final documentation head must also pass |
| Public health / unauthenticated access / Swagger | PASS | Web health and API live/ready 200; DB/Redis up; unauthenticated tickets 401; `/docs`, `/api-docs`, `/swagger`, `/openapi.json` 404 |
| 11G-C: desktop/mobile usability | PASS | Live desktop 1440×900 and mobile 390×844 navigation, filters and layout inspected; no mobile horizontal overflow |
| Empty state / loading behavior | PASS | Empty workspace observed; held browser-only ticket request showed skeleton, then actual tickets; accessible loading status added |
| Controlled error-state browser check | PASS | Browser-only synthetic 503 displayed error and Try again; removing interception and retrying restored real tickets |
| Font regression fix | PASS | Live baseline computed Times New Roman due self-referencing font variable; local production build computes Geist/Arial fallback |
| Keyboard access source/build | PASS | Skip link, focusable main and unnested nav added |
| Live postdeployment keyboard check | PASS | Actual Tab focused visible skip link, Enter focused main; computed Geist font and zero nested nav landmarks |
| Repeatable latency sample | PASS (limited) | Five sequential authenticated no-store BFF requests: 309, 172, 159, 170, 157 ms; median 170 ms |
| Field Core Web Vitals / Lighthouse certification | NOT TESTED | No field dataset or DevTools audit; request timings are not LCP/INP/CLS or an SLA |
| Safety review / primary staging merge | PASS | Human reviewed and approved after Sourcery requested review; exact-head five-job CI passed; PR #13 merged to staging only |
| 11G-D: primary staging rollout and probes | PASS | All five Railway services SUCCESS, no pending work; Web/API readiness 200, DB/Redis up, protected routes unchanged; deployment IDs below |
| Reconnect recovery follow-up | PASS (regression) | Real provider event harness verifies missed-change invalidation and notification replacement; live follow-up rollout pending |
| Production backup and restore certification | NOT TESTED | Paid backups declined; no restore drill; production release remains blocked |

## 11G-A: cause, fix and boundaries

Read-only queue/database inspection at **11:23:01 UTC** found four failed BullMQ
email jobs, all completed on 2026-10-09 at 16:13:28, 16:17:32, 19:52:06 and
22:54:47 UTC. Each had one attempt, a FAILED delivery record and no accepted
provider message. The live queue had no waiting/active work and one fresh worker.
The delayed job and maintenance schedule were not evidence of a stalled email.

Private provider logs at those matching times were POST `/emails`, HTTP **403**,
code `validation_error`, explicitly describing the development sender's
account-only test recipient restriction. This was not an inferred DNS failure,
missing credential, API-key permission issue or verified-domain outage. Sender
configuration uses the provider's development domain; the connected provider
lists no custom sending domains. No configuration or DNS changes were needed for
the approved sandbox recipient. [Resend error reference](https://resend.com/docs/api-reference/errors)
and [test-email constraints](https://resend.com/docs/dashboard/emails/send-test-emails).

The old logs lost the useful provider code when a permanent rejection was wrapped
as a BullMQ unrecoverable error. New `email.provider.failed` events preserve only
allowlisted codes, a bounded status and retry/final-attempt flags. Raw responses
can contain private addresses; tests verify they never enter this event. The
worker's retry classification, idempotency and delivery-state behavior are unchanged.

Queue events now expose consumer health and retained failure count/trend while
keeping the existing degraded warning. A stable failed count is historical
evidence, not proof that future sends will succeed; net counts are not rates.
No retained jobs were deleted, retried or replaced to clear monitoring warnings.

## 11G-B: live integration evidence

Only existing legitimately signed-in Auth0 accounts were used. No identities,
tokens, passwords or sessions were extracted. The second account was a nonmember
when the 404 test ran. The user subsequently gave that account an Agent membership;
later successful tests therefore do not contradict the earlier nonmember result.
No membership or role was changed by this release workflow.

The nonmember BFF request ID was
`2e0b3e80-b411-4991-911c-213d205ffcbc`. Railway correlated
`GET /v1/organizations/:organizationId/tickets`, 404, 192 ms. Response cache policy
was no-store. This checks the supported browser/BFF/API path rather than a forged
identity or a UI-only denial.

One separately named **Phase 11G Release Test 2026-10-10** customer and
**Phase 11G synthetic integration 2026-10-10** ticket were created in Northstar's
demo organization. The approved sandbox recipient is private and omitted here.
Existing demo/genuine customer records were not overwritten. Original seed counts
in the Phase 11E report remain historical; new fixtures naturally add rows.

| Operation | Redacted correlation evidence |
| --- | --- |
| Synthetic ticket create, 201 | `eb0132d0-63eb-4aad-8ae8-419d21b634b8` |
| Status PENDING, 200 | `b0aaa3ac-3e97-4a0e-86d7-0261dc39d9e7` |
| Agent assignment, 200 | `ff542225-4a3a-4aae-83b2-1ea8495fd26a` |
| Internal note, 201 | `2dd11acc-3fe7-423b-892a-5d1df400ec1e` |
| R2 initialize / complete, 200 | `0e4d8869-babb-43d7-a2cb-edf5fcb8ae8b` / `da9db5d4-6c08-4296-ac5d-fef674186580` |
| Attachment note / download authorization | `2cc23c9a-4f98-4dc3-84bd-b63787521660` / `c49401f5-aba9-47b2-8db1-cef1fbd89856` |

The attachment was 70 bytes of synthetic plain text. Browser PUT/GET returned 200
and downloaded content exactly matched. Signed URLs were kept in browser memory,
never stored in this report. An open owner conversation gained the Agent's notes
and attachment without reload; the owner's inbox also gained the newly created
ticket. This is observed propagation across two real sessions, beyond a socket's
connected indicator.

One public reply was sent through the normal owner composer. Worker completion
was logged at **11:38:54 UTC**, provider sent at **11:38:56.352 UTC**, and provider
delivered at **11:38:59.060 UTC**. The BFF showed DELIVERED. The user replied from
the approved mailbox; `email.received` webhook succeeded at **11:40:33.064 UTC**,
creating a CUSTOMER public reply on the same ticket and reopening it to OPEN.
The user used their own short test sentence rather than the suggested exact marker;
the evidence is the correlated arrival, routed message and live UI update.

The disposable ticket was subsequently RESOLVED then CLOSED through supported
BFF status transitions (both 200), with subject/customer identity guards.
Request IDs: `3869a23e-9cab-4fda-8e2a-ed9f69b96c7e` and
`0b2d2cc7-5826-4497-8e13-dc1ecf90026f`. Customer, messages, audit history and
attachment remain available; no rows or objects were deleted. A read-only queue
inspection at 14:55:34 UTC confirmed the same four historical failures and no
new failed jobs after the approved email round trip.

This proves one sandbox round trip. It does not certify arbitrary recipients,
bounce/complaint handling against real mailboxes, attachment delivery in outbound
email, or every provider failure mode. Those modes remain covered by automated
tests where present and need separately scoped live tests where required.

## 11G-C: focused UI and performance changes

The font custom property referenced itself, invalidating the intended sans font
and producing Times New Roman in staging. It now references the loaded Geist
variable with explicit fallbacks. A keyboard skip link targets a focusable main,
the redundant outer navigation landmark is removed, and workspace loading has a
status role/name. These are focused fixes; the interface and security flows were
not redesigned.

Live checks inspected desktop and mobile navigation, filter wrapping, menu links,
conversation/attachment layout and the empty workspace state. Mobile document
width was 375 at a 390-pixel viewport (scrollbar accounted for), without overflow.
The local production landing preview confirmed the corrected font and no overflow
at widths 1440 and 390. A browser-only held request showed the actual loading
skeleton; a synthetic 503 showed the error/Retry UI, and a real refetch recovered.
These interceptions did not change staging services or database state. Authentication stays
with the supported Auth0 flow; local checks used inert provider placeholders.

The deployed UI passed actual Tab/Enter skip-link testing. The focused skip link
was visible (171-pixel width), Enter moved focus to `workspace-content`, and
there were no nested navigation landmarks. Desktop/mobile screenshots in
`docs/images/phase-11g-*.png` were captured after actual tickets and realtime were
ready. Account identity, all visible emails and assignee names were masked at
capture; customer data is synthetic. All 35 original local documentation targets
checked existed; the expanded report/images are checked again before delivery.

A long-running background session exposed stale data after disconnect/reconnect
and accumulated recovery notifications. Transport/browser throttling can cause
disconnects; this release does not claim to eliminate network interruptions.
The follow-up refreshes active queries **after successful organization-room
rejoin acknowledgment**, marks inactive caches stale for later use, and gives
the recovery toast a stable ID. Ticket-message queries are reconciled again after
the ticket-room ACK because delivery updates use ticket rooms. Subscribing before
refetching closes the gap where a write could commit after a snapshot read but
before room subscription. Initial readiness/join does not redundantly refresh.
Four tests execute the actual TypeScript provider's socket handlers, covering
missed/gap writes, ticket-delivery reconciliation, notification replacement and a
denied rejoin that triggers no reconciliation. No authentication, role or
room-membership checks change.

A controlled live baseline test used only the CLOSED disposable ticket. The
browser dropped one `ticket.updated` server frame, then closed/reconnected only
its own WebSocket; HTTP and authentication remained intact. A guarded priority
PATCH returned 200/LOW (request `74cff75f-24c7-4ab8-b5c4-e9083875422a`), while
the UI remained NORMAL even after reconnect. This reproduced the missing-refresh
bug beyond the background-tab observation. The test restored priority NORMAL
through the BFF and reloaded the inbox. The same check is repeated after the
follow-up deploy. No credentials or socket authentication frames were extracted.

Latency samples used the existing authenticated Chrome session, sequential BFF
ticket-list requests with `cache: no-store`, no artificial throttling, and measured
fetch plus body consumption. Five samples and a median describe that moment only;
no before/after speedup, field vitals or performance certification is claimed.

Three authenticated desktop reloads (warm browser cache, no throttling) took
713, 554 and 448 ms from navigation start until actual ticket content appeared;
median 554 ms. DOMContentLoaded was 350, 205 and 183 ms respectively. These
pre-release samples are a realistic moment-in-time observation, not field vitals
or an improvement claim. Local production landing checks had no overflow at
1440 and 390 pixels; their timing is not compared with authenticated staging.

## 11G-D: reproducible release gates

Local checks used Node 24.14.0 and pnpm 10.15.1; supported hosted CI uses Node 22.
Frozen installation and inert-environment Prisma generation passed. No provider
secrets were needed for builds, documentation or unit tests.

```sh
pnpm install --frozen-lockfile
pnpm --filter api exec prisma generate --config prisma7.config.ts
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api test
pnpm --filter api test:openapi
pnpm --filter api openapi:check
pnpm --filter web lint
pnpm --filter web test:auth
pnpm --filter web test:security
pnpm --filter web build
```

Security E2E passed separately. A broader local attempt lacked Redis and is
recorded above as an environment failure, not silently omitted. Full CI must run
with Redis, three disposable PostgreSQL suites and all Docker targets. Docker
Desktop was installed but its daemon was unavailable; no live database was used
as a substitute. Existing lint warnings concern an unused type/control-character
regex in API and realtime-effect cleanup references in web.

Hosted [CI run 38060843349](https://github.com/It-shahin/opsdesk/actions/runs/38060843349)
passed on `87ba3c784666eedda586da4e95a1fea11542afa4`: API unit, API E2E,
database integration, web and Docker images. Full Redis E2E had 199 tests passing;
40 DB-dependent tests are intentionally skipped there and run in the separate
PostgreSQL job: audit 22, analytics 5, demo 13, all passing. Docker runtime and
migration targets, entrypoints, standalone web server and Compose validation passed.
Final documentation head `844345ce574c833b0aa562731ef6bc3d77f51620` also passed
all five jobs in [run 38061291313](https://github.com/It-shahin/opsdesk/actions/runs/38061291313).
The merge commit's automatic [push run 38061619922](https://github.com/It-shahin/opsdesk/actions/runs/38061619922)
passed before Railway's configured CI gate released the deployments.

Only the new feature branch and staging target are in scope. No production merge,
security bypass, schema migration, paid resource, failed-job cleanup or credential
publication is authorized here. Release notes, checklist and runbook are updated.
The [primary release PR is #13](https://github.com/It-shahin/opsdesk/pull/13). The code diff
was inspected for privacy, preserved retry semantics, tenant/auth boundaries and
absence of migrations. Sourcery reported no inline issues but explicitly assessed
the change as needing a human reviewer because logging defects could disclose
private provider details or hide actionable failures. The user reviewed and approved
the staging merge after that assessment. CI was not treated as human approval.

## Primary release deployment snapshot

Merged staging commit: **`1439b5c45ace86b8eb384687f4713da51e3d0d56`**.
All three application deployments report that commit and branch
`feat/phase-11-deployment`. This records the primary release snapshot; the focused
reconnect follow-up is separately reviewed and checked before staging promotion.

| Service | Successful deployment ID |
| --- | --- |
| Web | `7d241141-740e-47b1-a7ff-a447490c958e` |
| API | `bbeade01-2fd8-45b0-bb28-f7e446e2ca28` |
| Worker | `d55394bf-831f-451f-917c-b37b399711e0` |

At 15:04:28 and 15:04:58 UTC the new API emitted email queue health with waiting
0, active 0, delayed 1, failed 4, workersAlive 1, `consumerStatus=up`,
`retainedFailureTrend=unchanged`, and overall `status=degraded`. Maintenance was
up with zero failures. Worker heartbeat at 15:05:14 UTC reported both consumers
healthy. Web health, API live/ready, unauthenticated 401 and documentation 404
probes all passed after rollout. No pending Railway work remained.
