# Production readiness checklist

Phase 11G targets a staging portfolio release. Passing staging tests is not a
production approval. Use [the evidence matrix](PHASE-11G-REPORT.md) for current
results; the following items must be resolved before promotion.

| Gate | Current boundary | Required next step |
| --- | --- | --- |
| Production authorization | Staging release only | Explicit consent before default-branch merge or production deployment |
| Durable backup / recovery | Paid backups declined; no restore certification | Agree a no-surprise recovery plan within budget; verify a backup and restore into an isolated DB |
| Email sending domain | Development sender; one approved sandbox recipient | Verify owned domain and DNS, then test delivery with controlled recipients |
| Recipient lifecycle | One sent/delivered/received round trip | Controlled bounce/complaint/suppression exercises and operational handling |
| Alert destination | Structured signals exist; no external alert receiver provisioned | Configure an approved destination and test notification/recovery |
| Attachments | Policy, signed URLs and metadata validation; no malware scanning | Decide scanning/quarantine policy before accepting untrusted production files |
| Release compatibility | No Phase 11G schema change | Review every future migration; prove rollback compatibility and backups |
| Runtime validation | Exact-commit CI and staging health required | Verify all services, dependencies, queues and authenticated flows after promotion |
| Security operations | Auth0/RBAC/tenancy/CSRF/rate-limit regression coverage | Review production tenant configuration, least privilege, rotation and incident ownership |
| Performance / capacity | Small repeatable staging latency sample only | Set realistic budgets and run approved workload/capacity tests; gather field data |
| Demo data | Synthetic demo plus named release fixture | Keep demo/test records and identities out of production; no bulk cleanup as a release shortcut |

Do not upgrade a plan, purchase backups, expose Swagger, weaken guards, or point
test/seed tools at production to make this checklist pass. Local installation
requires privately configured provider credentials for a full app; offline docs,
unit checks and hosted CI use inert test values.
