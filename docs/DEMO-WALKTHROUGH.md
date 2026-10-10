# OpsDesk — 2–3 minute product demonstration

**Goal:** Show the working system and explain the engineering behind it, using only the synthetic **Northstar Support [DEMO]** workspace.

**Suggested capture:** 1920×1080 or 1440×900 desktop, clear browser zoom, microphone with minimal background noise. Use existing app session; hide bookmarks, notifications, account email, token-bearing URLs, signed R2 links, and any personal customer details. Never capture a real secret.

## Shot-by-shot storyboard

| Time | Screen / action | Suggested narration |
| --- | --- | --- |
| 0:00–0:20 | Project title, dashboard overview | “This is OpsDesk, a multi-tenant support and customer-management platform built with Next.js, NestJS and TypeScript.” |
| 0:20–0:45 | Ticket inbox; filter by priority and status | “Each organization manages its own support queue. Agents can filter urgent tickets, track ownership and see current statuses.” |
| 0:45–1:15 | Open a synthetic ticket conversation | “A ticket holds public customer replies, private internal notes, assignments and attachments in one timeline.” |
| 1:15–1:35 | Customer CRM and detail view | “Tickets link back to customer records, so the team has context across requests.” |
| 1:35–1:55 | Analytics 7/30 days, then organization switcher | “The dashboard reports ticket trends and workload. Organization membership and role checks also isolate workspaces.” |
| 1:55–2:20 | Architecture diagram / repository README | “The BFF keeps REST tokens server-side, NestJS verifies authorization, and Redis with BullMQ handles background jobs and realtime events.” |
| 2:20–2:45 | CI checks / OpenAPI report; end screen | “I tested cross-tenant isolation, email workflows, signed uploads and realtime recovery on staging, then automated the checks in GitHub Actions.” |

Use a screen recording of real browser behavior. The screenshots below are already captured from actual staging and sanitized for public sharing:

- [Desktop staging screenshot](images/phase-11g-desktop.png)
- [Mobile staging screenshot](images/phase-11g-mobile.png)

## Before recording

- Confirm the [staging application](https://opsdesk-web-staging.up.railway.app/app) is healthy and the correct demo organization is selected.
- Review every ticket/customer visible for private addresses or account details; mask or choose fictional records.
- Prepare the dashboard, inbox, one ticket and CRM views in advance; avoid unnecessary scrolling or waiting.
- Don't trigger outbound emails to unapproved recipients, share passwords, create invitations, or open developer network traces exposing credentials.
- Keep audio factual: development sender is sandbox-restricted; there is no production backup/restore certification.
- Export MP4/H.264 if recording externally and verify audio, readability and privacy before publishing. **No video is included in this repository.**

## Reviewer-friendly alternatives to an authenticated live demo

A reviewer without an Auth0 membership can use the [root README](../README.md), [project case study](PORTFOLIO.md), [architecture](architecture.md), [API contract](api/openapi.json), and [verification matrix](demo/PHASE-11G-FINAL.md). A narrated video can be linked once genuinely recorded and reviewed; do not publish test credentials.
