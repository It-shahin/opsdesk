# Staging portfolio release — Phase 11G

Date: 2026-10-10. Target: `feat/phase-11-deployment` only.

## Changes

- Safe email provider failure diagnostics preserve useful error code/status
  without exposing recipients, response messages or credentials.
- Queue monitoring distinguishes fresh consumer health from retained failures,
  preserves degraded warnings, and reports the net retained count trend.
- Fixed the self-referencing font variable that caused a serif fallback.
- Added a workspace skip link, a focusable main and accessible loading status;
  removed a redundant nested navigation landmark.
- Added live integration evidence, a production checklist and updated operational
  guidance. No database migration or provider configuration change.

## Verified scope

Real nonmember API denial, synthetic ticket status/assignment/notes, cross-session
realtime, R2 upload/download, and one approved sandbox email delivery plus actual
inbound reply. See [the release matrix and exact gates](PHASE-11G-REPORT.md).

## Known limits

The sender remains in development mode. Four historical rejected jobs remain
retained. Arbitrary recipient delivery requires a verified domain. Backups and a
restore drill have not been certified; paid backup upgrades were declined. No
malware scanning, automatic invitation emails, public Swagger, field performance
certification or production release is claimed.

## Rollback

Use the [runbook](operations/runbook.md#application-rollback-on-railway) to select
compatible known-good staging deployments. This release has no schema changes.
Preserve queue history and verify all three application services independently.
