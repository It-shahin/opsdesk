# Ticket composer verification

Verified on 2026-10-06 using isolated fixtures, as requested. The browser rendered the existing application components and server pages, used the existing Next.js API handlers and server transport, and communicated with a local synthetic API/object store. Auth0, PostgreSQL, email queue/provider, and R2 were replaced by fixtures. No live messages, emails, database records, or R2 objects were created.

| Check | Result | Evidence |
| --- | --- | --- |
| OPEN public reply | PASS: appeared immediately on the right; composer cleared | [Screenshot](composer-public-reply.png) |
| Internal note | PASS: highlighted amber, internal label; response had no email delivery | [Screenshot](composer-internal-note.png) |
| PDF attachment | PASS: uploaded and appeared on its message | [Screenshot](composer-pdf-attachment.png) |
| Multiple files | PASS: PDF and PNG appeared together; both fixture attachment records have the same message ID | [Screenshot](composer-multiple-attachments.png), [fixture state](composer-fixture-state.json) |
| File larger than 25 MB | PASS: 26 MiB PDF rejected before upload | Validation assertion |
| More than 10 files | PASS: 11 files rejected before upload | Validation assertion |
| More than 50 MB combined | PASS: three 17 MiB PDFs rejected before upload | Validation assertion |
| Unsupported file | PASS: HTML rejected before upload | [Screenshot](composer-file-validation.png) |
| CLOSED ticket | PASS: Reply disabled; internal note submitted successfully without email delivery | [Screenshot](composer-closed.png) |
| Customer without email | PASS in fixture: warning shown, reply response contained FAILED email delivery | [Screenshot](composer-no-email.png), backend service/HTTP tests |
| VIEWER | PASS: read-only message replaces composer; no textbox, Attach, or Send reply | [Screenshot](composer-viewer.png) |
| Foreign ticket | PASS in fixture: HTTP 404, generic page, no foreign subject/email rendered | [Screenshot](composer-foreign-ticket-404.png), backend tenant isolation tests |
| Refresh | PASS in fixture: all four OPEN-ticket messages fetched again and rendered | [Screenshot](composer-reload.png) |
| Attachment download | PASS in fixture: Download button obtained signed fixture URL, browser downloaded PDF; SHA-256 equals uploaded file | [Network evidence](composer-network-evidence.json) |

All four invalid file selections left no files selected and generated no attachment init or object PUT requests. A page-error listener found no errors during the verified flows after the initial fixture development-server reload.

## Network behavior

One PDF produced exactly this mutation sequence:

1. POST `/attachments/init` — 200
2. PUT fixture object URL — 200, 217 PDF bytes
3. POST `/attachments/:id/complete` — 200
4. POST `/messages` — 201

The recorded message body was:

```json
{
  "kind": "PUBLIC_REPLY",
  "body": "Fixture PDF attachment reply",
  "attachmentIds": [
    "fcfa3d7a-25d9-4e75-9567-fcc8318a96c0"
  ]
}
```

The browser and upstream API received only JSON metadata/IDs on the message request. File bytes went directly to the fixture object store. See [sanitized network evidence](composer-network-evidence.json) and [fixture records/requests](composer-fixture-state.json); no auth headers, cookies, or real signed URLs are included.

## Fix and automated checks

The actual attachment init controller previously returned Nest's default 201. Added `@HttpCode(200)` and updated the corresponding HTTP test to match the requested sequence.

- Ticket and attachment service tests: 72 passed across 2 suites.
- Ticket, attachment, and email HTTP E2E tests: 55 passed across 3 suites using mocked infrastructure.
- After the status change, attachment HTTP E2E tests were rerun: 18 passed.
- Targeted API lint passed.
- Production API TypeScript check passed with `tsc -p tsconfig.build.json --noEmit --incremental false`.
- The broader `tsc --noEmit --incremental false` check failed on existing untyped Jest mock declarations throughout service/HTTP spec files (`UnknownFunction`/`never` inference). This is separate from the production check and passing Jest executions.

## Scope limits

Refresh persistence was verified against fixture memory, not PostgreSQL. Signed upload/download behavior was verified against a local stand-in, not R2. Real PostgreSQL commits, R2 signatures/CORS, and actual email delivery were not exercised. Backend tests validate service behavior with mocked Prisma/storage, including no-email failure and tenant permissions; they do not establish live integration behavior.

The temporary fixture servers, browser, and large validation files were removed after verification. Screenshots and sanitized JSON evidence remain in this folder.
