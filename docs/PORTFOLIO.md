# OpsDesk — Full-stack portfolio case study

**Project:** OpsDesk · Multi-tenant customer support and CRM SaaS prototype  
**Stage:** Completed, verified staging portfolio application (not production-certified)  
**Repository:** [github.com/It-shahin/opsdesk](https://github.com/It-shahin/opsdesk)  
**App:** [Railway staging](https://opsdesk-web-staging.up.railway.app/app) (requires existing authorized Auth0 membership)  
**Walkthrough:** [2–3 minute demo plan](DEMO-WALKTHROUGH.md)

![Real staged OpsDesk inbox with sanitized synthetic ticket data](images/phase-11g-desktop.png)

## The problem

Support teams need a dependable place to track customers and ongoing requests while keeping different organizations' data isolated. Email replies, ticket assignments, internal notes, uploads, and analytics create several coordinated workflows beyond basic CRUD.

## What I built

OpsDesk is an independently designed full-stack TypeScript project, with a Next.js interface, an Auth0-backed backend-for-frontend (BFF), a NestJS REST API, PostgreSQL/Prisma persistence, Redis/BullMQ background processing, Cloudflare R2 attachments, Resend email and Socket.IO realtime updates.

Users can manage customers and tickets, filter queues by priority/status, assign team members, discuss issues through public replies or internal notes, upload files using signed URLs, and inspect dashboard trends. Separate roles (Owner, Admin, Agent, Viewer) and organization membership checks protect tenant data.

## Why the architecture matters

| Design decision | Problem it addresses |
| --- | --- |
| Organization-scoped database access and role checks | Prevents one tenant or role from reading another tenant's data |
| Auth0 session through a Next.js BFF | Keeps REST access tokens on the server rather than in browser application state |
| Separate worker with Redis/BullMQ | Moves outgoing emails and maintenance work out of request-response handlers |
| Resend signed webhooks and idempotent lifecycle processing | Correlates inbound mail and delivery status without duplicate processing |
| Cloudflare R2 signed URLs | Transfers attachments without proxying large file bodies through the API |
| Authorized Socket.IO rooms and reconnect recovery | Distributes updates while revalidating membership and refetching missed updates |
| GitHub Actions, Docker, Railway readiness and observability | Makes integration failures, deployment health and queue history inspectable |
| Offline Swagger/OpenAPI snapshot | Documents 38 HTTP operations without exposing interactive API docs publicly |

Architecture details: [architecture](architecture.md), [security](security.md), [OpenAPI](api/README.md), [operations](operations/runbook.md).

## Proof and verification

The real **Northstar Support [DEMO]** staging workspace uses fictional customers and tickets. Final end-to-end checks covered tenant denial (actual nonmember 404), status/assignment/notes, two-way **approved sandbox** email, R2 signed uploads/downloads, cross-session realtime updates and missed-event recovery. Desktop/mobile UI, keyboard navigation, loading and retry states were also exercised.

The hosted CI runs application unit tests, security and Redis E2E tests, PostgreSQL database integration and Docker build checks. The release-specific evidence, pass/fail matrix and limitations are recorded in [Phase 11G verification](demo/PHASE-11G-FINAL.md) and the [full report](PHASE-11G-REPORT.md).

**Limitations disclosed:** The staging environment requires authorized sign-in; the Resend development sender permits only approved test recipients (four historical rejected jobs remain retained); no production backup/restore drill, field performance certification, attachment malware scanning or unrestricted commercial email delivery is claimed. See [production-readiness criteria](PRODUCTION-READINESS.md).

## Portfolio descriptions ready to reuse

### CV — short

**OpsDesk — Full-Stack SaaS Portfolio Project**  
Built a multi-tenant customer-support and CRM application using Next.js, NestJS, TypeScript, PostgreSQL/Prisma and Redis/BullMQ. Implemented Auth0/RBAC tenant isolation, realtime ticket updates, Resend email, Cloudflare R2 attachments, analytics and CI-tested Docker/Railway staging deployment.

### LinkedIn / project section

**OpsDesk | Multi-tenant Support & CRM SaaS**

I built OpsDesk to explore the engineering challenges behind real support platforms—not just building pages, but coordinating tenant-safe APIs, asynchronous jobs, third-party integrations, and realtime user experiences.

The app includes a customer CRM, ticket queues, agent assignments, internal notes, outbound/inbound email workflows, attachment uploads, and operational analytics. I used Next.js and NestJS in a TypeScript monorepo, with Auth0, Prisma/PostgreSQL, Redis/BullMQ, Socket.IO, Cloudflare R2 and Resend.

I also added automated security and integration tests, GitHub Actions, Docker, Railway staging, OpenAPI documentation and an end-to-end release verification report.

This is a portfolio staging application, not a commercial production deployment. The [repository](https://github.com/It-shahin/opsdesk) includes authentic sanitized screenshots, architecture, setup and testing instructions.

### Interview explanation (30 seconds)

“OpsDesk is a multi-tenant support platform I built with Next.js and NestJS. It combines CRM and ticket workflows with Auth0 role-based access, PostgreSQL and Prisma, BullMQ background email jobs, Cloudflare R2 attachments and Socket.IO realtime events. I focused heavily on protecting tenant boundaries, handling integrations safely, and verifying the whole system with CI and live staging tests. One interesting challenge was reconnect recovery: the UI now refreshes the correct workspace data after rejoining authorized realtime rooms.”

## Suggested live demonstration

Follow the [recording storyboard](DEMO-WALKTHROUGH.md). For privacy, use the synthetic demo workspace only and never show Auth0 credentials, token values, signed upload links, user emails or operational secrets. Recruiters should not be given shared production-like credentials.
