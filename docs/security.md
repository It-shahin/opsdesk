# Security model

This document describes the implemented boundaries, not a security certification. Do not publish access tokens, session cookies, provider keys, invitation acceptance tokens, signed URLs, real account emails, or customer content.

## Authentication

The Next.js Auth0 SDK maintains the web session. Browser REST requests use BFF routes; the server obtains the access token and forwards it to NestJS. The API independently verifies JWT signatures through Auth0 JWKS and checks the configured issuer and API audience. An ID token is not an API access token. Internal user synchronization uses the verified identity and trusted provider profile flow; request bodies do not choose an Auth0 subject.

Realtime is an explicit exception to the server-only REST token path: the authenticated `/api/realtime/token` BFF endpoint returns an access token with private/no-store caching for Socket.IO's handshake. Keep that token in memory, never local storage, analytics, logs, or screenshots. Socket authentication does not bypass tenant room authorization.

Health routes are public. The Resend webhook is public with respect to Auth0, but requires a verified Svix signature over the exact raw request body, plus its ID and timestamp headers. The webhook signature is a separate security boundary.

## Tenant isolation and authorization

The tenant guard resolves existing membership using the authenticated internal user and requested organization. Missing membership returns 404 to avoid organization enumeration. Child-resource services scope queries by organization and return 404 for foreign resources. The permission guard checks action permissions; services enforce additional workflow constraints. Tenant IDs, attachment IDs, or cached socket roles alone never authorize access.

| Capability | Owner | Admin | Agent | Viewer |
| --- | --- | --- | --- | --- |
| Read customers, tickets, members, analytics | Yes | Yes | Yes | Yes |
| Write customers/tickets/messages/tags/attachments | Yes | Yes | Yes | No |
| Manage members and invitations | Yes | Yes, restricted | No | No |
| Read audit logs | Yes | Yes | No | No |

Admin members cannot grant or modify Owner/Admin membership as if they were an owner. Last-owner protections prevent removing the organization's final owner. Invitations expire, store a hash rather than the raw acceptance token, and require the signed-in identity's email to match the invite. The raw token is returned once for manual link sharing; keep it private. See the actual service rules when extending permissions.

## Browser and request protections

The BFF checks session state and mutation origins; the API's existing Helmet, CORS, rate limiting, and validation pipeline remain in force. DTO validation transforms values and rejects unknown properties. Optional/null handling and normalization are governed by validators and services, not only by OpenAPI constraints. The web CSP is built from configured public origins; changing those values requires rebuilding. Existing CSP directives are not changed by the documentation work.

Use HTTPS and environment-specific callback/logout allowlists for hosted deployments. API CORS and web mutation checks are complementary; neither replaces bearer verification. Realtime token responses and private user/tenant responses must not be publicly cached.

## Files, messages, and external events

Attachment policy limits individual files to 25 MiB, message attachment count to 10, and total message attachment bytes to 50 MiB. Upload completion checks R2 metadata and ownership. This is not antivirus scanning. Webhook verification/deduplication and outbound delivery state reduce replay and duplicate-delivery risks; outbound actions still require operational monitoring.

Audit metadata is sanitized by the application; avoid adding secrets or message bodies to new audit fields. Queue logs should contain operational identifiers/counts, not job payloads. Never expose database, Redis, or provider credentials through `NEXT_PUBLIC_*` variables.

## Documentation safeguards

Live API/worker entrypoints do not install Swagger or OpenAPI routes. Machine-readable generation uses an isolated testing module with inert service mocks and never listens. The separate local viewer requires `NODE_ENV=development`, rejects Railway and hosted environment markers, binds only `127.0.0.1:3100`, disables Try it out, and does not persist authorization. Do not proxy, tunnel, or deploy this viewer. No tokens are needed for generation or viewing.

Safeguard tests verify environment rejection and that runtime entrypoints/modules do not import the documentation server. CI validates the OpenAPI document and checks that the committed snapshot matches controller metadata. These checks complement the existing tenant/RBAC, BFF, webhook, and realtime suites.

## Known verification limits

The [staging report](demo/FINAL-VERIFICATION.md) distinguishes UI denial from a live HTTP 404 check. The latter was blocked by the browser and remains not tested with the second real account. Read-only verification did not exercise outbound delivery or alter demo records. Backup restoration, malware scanning, penetration testing, and production readiness are outside that result.
