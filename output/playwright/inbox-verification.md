# Inbox verification — 2026-10-06

The user chose fixture checks only. These are browser checks of the repository's actual Next.js pages, AppShell, TicketInbox, ticket shell, API BFF handlers, and server API transport. Only authentication and upstream API data were replaced in a temporary, isolated Next app on port 3002 and an in-memory API on port 3004. The real database was not changed. Temporary test servers and browser sessions were stopped after verification.

## Results

| Check | Result |
| --- | --- |
| Organization inbox | 20 visible rows of 26 tickets; every ticket link used the selected organization; no foreign ticket marker |
| Search `Jane` | URL `?search=Jane`; 25 matching customer records after correcting fixture data; subjects did not contain Jane |
| Status OPEN + priority HIGH | Both URL parameters and API queries present; combined response had 25 matching tickets |
| Assignee | Sent membership UUID `a005d10b-84a7-4e5c-b91a-c7a69bf21675` |
| Tag | Sent tag UUID `ad773505-18bd-4dc9-a172-2e4ec7216f8e` |
| All filters combined | Search, status, priority, assignee, and tag reached the API together; response remained organization scoped |
| Refresh | Search text and all four selected controls restored from URL |
| Page 2 | URL retained filters and added `page=2`; five results, “Page 2 of 2” |
| Change filter | Changing priority to URGENT removed `page`; API received page 1; empty result displayed “No matching tickets” |
| Clear | All filter and page parameters removed; controls reset; 26 tickets returned |
| Click ticket | Navigated to `/app/<organization>/tickets/<ticket>`; subject, status, customer, and basic conversation placeholder rendered |
| Foreign ticket | A ticket owned by fixture organization B, requested under organization A, returned HTTP 404 with generic UI and no customer/ticket data |
| Switch workspace | Organization B showed its one ticket and no organization A ticket rows; dropdown opened without MenuGroupContext errors |
| Browser console | Final inbox and workspace-switching session: zero errors or warnings; foreign 404 produced the expected failed-resource entry |

Backend verification: the existing ticket E2E suite passed all 30 tests, including organization scoping, combined filters, membership/tag identifiers, pagination, and foreign-ticket rejection. These tests use mocked persistence, so they are not a live PostgreSQL integration test.

Web TypeScript and targeted ESLint checks passed.

## Real application links

- Inbox: http://localhost:3000/app/58e19921-64ce-4614-b6b3-396754ba4b5f
- Search: http://localhost:3000/app/58e19921-64ce-4614-b6b3-396754ba4b5f?search=Jane
- OPEN: http://localhost:3000/app/58e19921-64ce-4614-b6b3-396754ba4b5f?search=Jane&status=OPEN
- HIGH combined: http://localhost:3000/app/58e19921-64ce-4614-b6b3-396754ba4b5f?search=Jane&status=OPEN&priority=HIGH
- All filters: http://localhost:3000/app/58e19921-64ce-4614-b6b3-396754ba4b5f?search=Jane&status=OPEN&priority=HIGH&assigneeMembershipId=a005d10b-84a7-4e5c-b91a-c7a69bf21675&tagId=ad773505-18bd-4dc9-a172-2e4ec7216f8e
- Page 2: http://localhost:3000/app/58e19921-64ce-4614-b6b3-396754ba4b5f?page=2
- Ticket: http://localhost:3000/app/58e19921-64ce-4614-b6b3-396754ba4b5f/tickets/819f42f7-5181-4eb7-9f33-256c89ff6f4c
- Second workspace: http://localhost:3000/app/97dd6a37-2b06-4b60-bbf2-1c687e814b6e
- Cross-organization ticket URL: http://localhost:3000/app/97dd6a37-2b06-4b60-bbf2-1c687e814b6e/tickets/819f42f7-5181-4eb7-9f33-256c89ff6f4c

The real database had one OPEN, URGENT, unassigned Jane Doe ticket in the first workspace, and no tickets in the second workspace. HIGH and assigned-member combinations therefore have no matching live records, and Next pagination is unavailable with one ticket. Live authenticated browser behavior was not verified, as requested. Links require an account with workspace access.

Evidence: `inbox-api-requests.jsonl` contains sanitized fixture API method/path/query values; PNG files show fixture page 2, ticket shell, and generic foreign-ticket 404.
