# API workflows and OpenAPI

[openapi.json](openapi.json) describes the existing NestJS HTTP surface: **38 operations** across health, users, organizations, customers, tickets/messages, tags, members, invitations, attachments, analytics, audit, and Resend webhooks. Browser REST clients use the Next.js BFF; the schema describes the upstream API, not the BFF's session cookie contract.

## Auth and tenant boundaries

Authenticated v1 routes require an Auth0 **access token** for the configured audience and issuer. After authentication, organization routes resolve membership and required permissions. Missing membership/foreign resources return 404; insufficient action permissions return 403. UUID syntax, DTO validation, last-owner rules, invitation identity matching, attachment ownership, and ticket state transitions still apply. See [the role matrix](../security.md#tenant-isolation-and-authorization).

Public `/`, `/health/live`, `/health/ready`, and `/health` do not require bearer authentication. Readiness may return 503 when dependencies are unavailable. `/v1/webhooks/resend` requires Resend/Svix signature headers and the unmodified raw body instead of Auth0. Do not copy a webhook into Swagger and expect its signature to remain valid.

## Typical workflows

| Goal | Existing upstream route sequence |
| --- | --- |
| Select workspace | `GET /v1/me`, `GET /v1/organizations`, then `GET /v1/organizations/{organizationId}` |
| Browse customers | `GET .../customers` with status/search/company/page/limit; retrieve a scoped customer by ID |
| Browse inbox | `GET .../tickets` with status/priority/customerId/assigneeMembershipId/tagId/search/sort/page/limit |
| Read conversation | `GET .../tickets/{ticketId}` and `GET .../tickets/{ticketId}/messages` |
| Change assignment | `PATCH .../tickets/{ticketId}/assignee` with a membership UUID, or `null` to unassign |
| Move status | `PATCH .../tickets/{ticketId}/status` with an allowed transition |
| Add message | `POST .../tickets/{ticketId}/messages` with kind/body and optional owned attachment IDs |
| Upload file | `POST .../tickets/{ticketId}/attachments/init`, PUT to returned signed URL with returned headers, then `POST .../tickets/{ticketId}/attachments/{attachmentId}/complete` |
| Download file | `GET .../tickets/{ticketId}/attachments/{attachmentId}/download`, then use the short-lived returned URL |
| Team membership | List `.../members`; role changes are restricted by caller role and last-owner rules |
| Invite member | Create `.../invitations`, share the one-time `acceptanceToken` privately, accept via `/v1/invitations/accept` as the matching identity |
| Analyze workload | `GET .../analytics/overview?range=7d` (also `30d`, `90d`) |
| Audit activity | `GET .../audit-logs` with pagination and documented filters |

`...` denotes `/v1/organizations/{organizationId}`. Use the exact verbs, body fields, and schemas in the snapshot. Write workflows are described for local development; they were not executed against demo staging during verification.

Ticket status transitions: OPEN → PENDING/RESOLVED; PENDING → OPEN/RESOLVED; RESOLVED → OPEN/CLOSED; CLOSED → OPEN. Closed-ticket message writes are restricted. Public replies may queue an email when the customer has an email address; internal notes do not. Do not use a public reply as a harmless connectivity test.

List endpoints for customers, tickets, and audit return `{ data, pagination }`. Other collections such as tags, memberships, and conversations are arrays. Ticket projections differ: listing omits description, creation omits some assignment/tag/lifecycle fields, and detail returns a richer projection. Those fields are optional in the shared response schema. Optional DTO properties may accept null because of the existing validator configuration; service normalization/rejection remains authoritative. OpenAPI does not assert every dynamic business outcome.

## OpenAPI and local Swagger

Install development dependencies and generate Prisma/compile the API first. A synthetic localhost DB URL is sufficient for client generation; it does not connect to the database:

```powershell
$env:DATABASE_URL='postgresql://build:build@127.0.0.1:5432/opsdesk'
pnpm --filter api exec prisma generate --config prisma7.config.ts
pnpm --filter api build
pnpm --filter api openapi:generate
pnpm --filter api openapi:check
pnpm --filter api test:openapi
```

Use a fresh terminal afterward before starting the real local app, so the synthetic build URL is not reused accidentally. Generation uses real controller/DTO metadata, manually reviewed response projections, inert service mocks, and disabled guards in an isolated testing module. It never imports the runtime AppModule/WorkerModule, initializes the API, listens, or connects to providers. Those inert guards are only used for introspection, never to serve business routes.

The generator validates OpenAPI structure/references, unique operation IDs, tags/descriptions, success schemas, bearer security, tenant 404 responses, required UUID path parameters, and the reviewed route count. `openapi:check` compares the freshly generated document with the committed JSON and fails on drift. Regenerate and review the JSON whenever routes/DTOs/projections change.

For a **local-only** viewer:

```powershell
$env:NODE_ENV='development'
pnpm --filter api openapi:serve
```

Open `http://127.0.0.1:3100/docs`. JSON is at `/docs/openapi.json`. The process is separate from the API, binds only loopback, rejects non-development mode, populated `RAILWAY_*` variables and hosted environment markers, disables Try it out, and does not persist authorization. Stop it after use; do not tunnel or deploy it. No credentials are needed. Neither the staging API nor the production runtime installs these routes.

Annotations use `@nestjs/swagger` directly without the compiler plugin's automatic HTTP-code changes. Existing guards, HTTP verbs/status behavior, DTO validators, BFF CSRF/origin checks, and CSP remain unchanged. Schema metadata does not enforce runtime authorization.

## Socket.IO events

OpenAPI describes HTTP. The implemented event transport is Socket.IO on namespace `/realtime`, with `handshake.auth.token` from the authenticated BFF realtime-token endpoint. Never persist/log that token.

| Direction | Event | Payload/behavior |
| --- | --- | --- |
| Server → client | `realtime.ready` | `connectedAt` timestamp after authenticated connection |
| Client → server | `organization.join` / `organization.leave` | `{ organizationId }`; membership validation on join; leave also exits ticket rooms |
| Server → client | `organization.joined` / `organization.left` | Joined organization/membership/role, or organization ID on leave |
| Client → server | `ticket.join` / `ticket.leave` | `{ organizationId, ticketId }`; join requires joined organization, fresh membership, read permission, scoped ticket existence |
| Server → client | `ticket.joined` / `ticket.left` | Organization/ticket IDs |
| Server → client | `ticket.created` / `ticket.updated` | Tenant-scoped ticket change; refetch relevant UI data |
| Server → client | `ticket.message.created` | Tenant/ticket message change; refetch conversation |
| Server → client | `email.delivery.updated` | Tenant/ticket/message delivery change; refetch delivery state |

Room commands acknowledge `{ ok: true, ... }` or `{ ok: false, error: { code, message } }`. The source of truth for emitted payload fields is `apps/api/src/realtime/realtime.types.ts`; join/leave and permission checks live in `realtime.gateway.ts`. Redis distributes updates across instances. Do not join arbitrary rooms by client-supplied room names.

## Verification

API unit tests use mocks. API E2E includes authenticated/tenant/RBAC HTTP and realtime checks; run it with disposable Redis and synthetic provider values matching `.github/workflows/ci.yml`, including `NODE_ENV=test`. DB integration suites are opt-in (`test:audit:db`, `test:analytics:db`, `test:demo:db`) and must use a disposable PostgreSQL database. Demo DB tests additionally require `DEMO_TEST_DATABASE_URL` and enforce their test safeguards.

CI runs the local-docs safeguard tests and offline snapshot check after the API build. [Phase 11E](../demo/FINAL-VERIFICATION.md) records staging behavior separately; [Phase 11F](../PHASE-11F-REPORT.md) records the actual local/hosted checks for this change. A schema validation pass does not replace a live tenant-isolation test or delivery test.
