import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { DEMO_NAME, DEMO_SLUG } from './demo-options.js';

// RFC 4122 UUIDv5, with a namespace reserved for this dataset, never random IDs.
export function demoId(key: string): string {
  const namespace = Buffer.from('32f03f928c3f4413a86482631ea6b74c', 'hex');
  const bytes = createHash('sha1')
    .update(namespace)
    .update(key)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const DEMO_ORGANIZATION_ID = demoId('organization');
export const DEMO_MEMBERSHIP_ID = demoId('owner-membership');
export const DEMO_MARKER_ID = demoId('audit:organization-created');
export const DEMO_VERSION = 'northstar-v1';

const customers = [
  ['Maya Chen', 'Aurora Design Studio', 'maya.chen'],
  ['Elias Brooks', 'Cedar Grove Logistics', 'elias.brooks'],
  ['Nora Patel', 'Harborlight Learning', 'nora.patel'],
  ['Theo Martin', 'Summit Trail Outfitters', 'theo.martin'],
  ['Iris Okafor', 'Juniper Labs', 'iris.okafor'],
  ['Leo Ramirez', 'Blue Finch Media', 'leo.ramirez'],
  ['Amira Stone', 'Willow Peak Consulting', 'amira.stone'],
  ['Finn Laurent', 'Orbit Meadow Supply', 'finn.laurent'],
];

const tags = [
  'Billing',
  'Account access',
  'Integrations',
  'Product feedback',
  'Onboarding',
];

type Scenario = {
  customer: number;
  subject: string;
  description: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  days: number;
  assigned: boolean;
  tags: number[];
  reply: string;
  followup: string;
  note: string;
};

const scenarios: Scenario[] = [
  {
    customer: 1,
    subject: 'Dispatch dashboard stops refreshing after reconnect',
    status: 'OPEN',
    priority: 'URGENT',
    days: 0.5,
    assigned: true,
    tags: [2],
    description:
      'The fictional Cedar Grove dispatch team loses live shipment updates after a brief network interruption. Refreshing the page restores updates for several minutes. Reproduced in the demo sandbox; no live shipments are involved.',
    reply:
      'We reproduced the stale connection in our sandbox and are checking the reconnect handler. Please keep the dashboard open while we compare the last successful update time.',
    followup:
      'The sandbox panel stopped again after switching networks. A full refresh restored it.',
    note: 'Priority raised for the demo dispatch workflow. Investigate subscription recovery; the underlying sample shipments remain intact.',
  },
  {
    customer: 0,
    subject: 'Seat count on renewal preview differs from workspace',
    status: 'OPEN',
    priority: 'HIGH',
    days: 2,
    assigned: true,
    tags: [0],
    description:
      'Aurora Design Studio sees 14 seats in the sample renewal preview but 12 active members in the workspace. They need a clear explanation before approving the fictional renewal.',
    reply:
      'I am comparing active members with the renewal snapshot. The two archived invitations may explain the difference; I will confirm before recommending any changes.',
    followup:
      'Thank you. Both invitations were canceled last week, so they should not count toward the preview.',
    note: 'Compare snapshot refresh time with invitation cancellation events. No payment action requested.',
  },
  {
    customer: 5,
    subject: 'Request for a compact view in the activity feed',
    status: 'OPEN',
    priority: 'LOW',
    days: 5,
    assigned: false,
    tags: [3],
    description:
      'Blue Finch Media would like a compact activity feed for reviewing weekly campaign notes. Their current workflow involves scanning many short entries on a small laptop screen.',
    reply:
      'Thanks for the clear workflow example. We have recorded the request for the product team and would like to understand which fields are essential in the compact layout.',
    followup:
      'Author, date and the first line would be enough. We can expand an entry for the details.',
    note: 'Feature request ready for product triage; no service disruption.',
  },
  {
    customer: 4,
    subject: 'Sandbox webhook retries return a signature mismatch',
    status: 'PENDING',
    priority: 'HIGH',
    days: 3,
    assigned: true,
    tags: [2],
    description:
      'Juniper Labs is testing a synthetic webhook consumer. Initial events validate, but replaying the saved sample payload returns a signature mismatch. All endpoints and payloads are fictional.',
    reply:
      'The replay sample includes an old timestamp. Please generate a new sandbox signature over the original raw body and share the result in this demo thread.',
    followup:
      'We will update our sandbox replay helper and report back tomorrow.',
    note: 'Waiting for customer sandbox retest. No external webhook will be dispatched from this dataset.',
  },
  {
    customer: 2,
    subject: 'Confirm onboarding checklist for the spring cohort',
    status: 'PENDING',
    priority: 'NORMAL',
    days: 8,
    assigned: false,
    tags: [4],
    description:
      'Harborlight Learning is preparing a fictional training cohort and needs confirmation of the recommended member import order and default permissions before completing setup.',
    reply:
      'Start with the two coordinators, verify their roles, and then import the sample learner list. The checklist in your demo workspace reflects this order.',
    followup:
      'We are reviewing the sample list with our coordinators and will confirm the role mapping.',
    note: 'Waiting for coordinator approval; leave unassigned for the next onboarding rotation.',
  },
  {
    customer: 7,
    subject: 'Verify recovery steps for the shared demo kiosk',
    status: 'PENDING',
    priority: 'URGENT',
    days: 6,
    assigned: true,
    tags: [1],
    description:
      'Orbit Meadow Supply cannot open its fictional inventory kiosk after a session timeout. The team needs a recovery checklist for a scheduled internal demonstration. No real credentials are included.',
    reply:
      'Use your existing test identity to start a fresh session, then reopen the kiosk view. We are waiting for confirmation that the test browser can complete sign-in.',
    followup:
      'The test browser is being updated. We will confirm once the fresh session check is complete.',
    note: 'Urgent demo rehearsal blocker. Never request passwords or recovery codes in the ticket.',
  },
  {
    customer: 3,
    subject: 'CSV export repeats the header on the second page',
    status: 'RESOLVED',
    priority: 'NORMAL',
    days: 10,
    assigned: true,
    tags: [2],
    description:
      'Summit Trail Outfitters found a duplicate header when exporting a synthetic 250-row equipment list. The issue occurs only when the export spans multiple pages.',
    reply:
      'The export now writes the header once before iterating through pages. I tested the fix with your sample row count and attached no files to this demo thread.',
    followup:
      'Our sandbox export now has one header and all 250 rows. That resolves the issue.',
    note: 'Resolution verified against synthetic sample rows; monitor for regression during the demo.',
  },
  {
    customer: 6,
    subject: 'Saved report timezone shifts the weekly boundary',
    status: 'RESOLVED',
    priority: 'HIGH',
    days: 4,
    assigned: true,
    tags: [2],
    description:
      'Willow Peak Consulting notices that the saved weekly report starts on Sunday when the fictional workspace preference specifies Monday. The sample report includes UTC timestamps.',
    reply:
      'We corrected the boundary calculation to use the workspace reporting timezone. The preview now starts on Monday and preserves the original event timestamps.',
    followup:
      'The new preview matches our sample calendar. Thanks for explaining the timezone handling.',
    note: 'Confirmed week boundary and UTC storage behavior. Ready for closure after the observation window.',
  },
  {
    customer: 0,
    subject: 'Clarify where archived projects appear in search',
    status: 'RESOLVED',
    priority: 'LOW',
    days: 14,
    assigned: true,
    tags: [3],
    description:
      'Aurora Design Studio wants to find archived sample projects without including them in the default active project search.',
    reply:
      'Enable the Include archived filter in advanced search. It applies to the current search only and leaves the default active view unchanged.',
    followup:
      'That filter found the sample project immediately. The explanation was all we needed.',
    note: 'Documentation question resolved. Add the filter example to the next onboarding walkthrough.',
  },
  {
    customer: 5,
    subject: 'Update the fictional billing contact on the statement',
    status: 'CLOSED',
    priority: 'NORMAL',
    days: 18,
    assigned: true,
    tags: [0],
    description:
      'Blue Finch Media requested that its sample billing statement use the current fictional finance contact rather than the old team alias. No real financial data is present.',
    reply:
      'The sample statement now uses the finance contact shown in the demo company profile. Please check the preview before closing this request.',
    followup:
      'The fictional contact details are correct in the preview. You can close the request.',
    note: 'Customer confirmed the sample statement; closed after a short observation period.',
  },
  {
    customer: 2,
    subject: 'First workspace walkthrough and permissions review',
    status: 'CLOSED',
    priority: 'LOW',
    days: 23,
    assigned: true,
    tags: [4, 1],
    description:
      'Harborlight Learning completed its fictional workspace setup and asked for a guided review of coordinator permissions and the member invitation process.',
    reply:
      'The walkthrough is complete. Coordinators can manage the demo workspace, and additional role demonstrations should use existing Auth0 test identities.',
    followup:
      'The coordinators understand the permissions and the invitation flow. We are ready to finish onboarding.',
    note: 'Onboarding completed with the sample organization. No invitations or usable accounts created by the seed.',
  },
  {
    customer: 7,
    subject: 'Session timeout notice remains after signing in again',
    status: 'CLOSED',
    priority: 'HIGH',
    days: 28,
    assigned: true,
    tags: [1],
    description:
      'Orbit Meadow Supply reported a stale session timeout banner in the sandbox after a successful sign-in. Navigation worked, but the notice obscured the demo inventory filters.',
    reply:
      'The banner now clears when a fresh session is established. We also checked that genuine expired sessions still display the recovery notice.',
    followup:
      'The sample kiosk is clear after sign-in, and the filters are visible again.',
    note: 'Retest passed in the demo sandbox. Closed after confirming the recovery notice still appears for expired sessions.',
  },
];

export function buildDemoData(ownerId: string, asOf: Date) {
  const at = (daysAgo: number) =>
    new Date(asOf.getTime() - daysAgo * 86_400_000);
  const organizationId = DEMO_ORGANIZATION_ID;
  const customerData: Prisma.CustomerCreateManyInput[] = customers.map(
    ([name, company, email], index) => ({
      id: demoId(`customer:${index}`),
      organizationId,
      name,
      company,
      email: `${email}@example.com`,
      notes: 'Fictional portfolio demo contact. Synthetic content only.',
      createdAt: at(29 - index / 10),
      updatedAt: at(29 - index / 10),
    }),
  );
  const tagData: Prisma.TagCreateManyInput[] = tags.map((name, index) => ({
    id: demoId(`tag:${index}`),
    organizationId,
    name,
    normalizedName: name.toLowerCase(),
    createdAt: at(29),
    updatedAt: at(29),
  }));
  const ticketData: Prisma.TicketCreateManyInput[] = [];
  const messageData: Prisma.TicketMessageCreateManyInput[] = [];
  const linkData: Prisma.TicketTagCreateManyInput[] = [];
  const auditData: Prisma.AuditLogCreateManyInput[] = [];
  const audit = (
    key: string,
    action: Prisma.AuditLogCreateManyInput['action'],
    entityType: Prisma.AuditLogCreateManyInput['entityType'],
    entityId: string,
    createdAt: Date,
    metadata: Prisma.InputJsonValue,
  ) => {
    auditData.push({
      id: demoId(`audit:${key}`),
      organizationId,
      actorUserId: ownerId,
      actorMembershipId: DEMO_MEMBERSHIP_ID,
      actorRole: 'OWNER',
      action,
      entityType,
      entityId,
      createdAt,
      metadata,
    });
  };
  audit(
    'organization-created',
    'ORGANIZATION_CREATED',
    'ORGANIZATION',
    organizationId,
    at(29),
    { demoSeed: DEMO_VERSION, asOf: asOf.toISOString(), ownerId },
  );
  for (const customer of customerData)
    audit(
      `customer:${customer.id}`,
      'CUSTOMER_CREATED',
      'CUSTOMER',
      customer.id!,
      customer.createdAt as Date,
      { demoSeed: DEMO_VERSION },
    );
  for (const tag of tagData)
    audit(`tag:${tag.id}`, 'TAG_CREATED', 'TAG', tag.id!, at(29), {
      demoSeed: DEMO_VERSION,
    });
  scenarios.forEach((scenario, index) => {
    const id = demoId(`ticket:${index}`);
    const finished = ['RESOLVED', 'CLOSED'].includes(scenario.status);
    const resolvedAt = finished ? at(scenario.days - 0.4) : null;
    const closedAt =
      scenario.status === 'CLOSED' ? at(scenario.days - 1.4) : null;
    ticketData.push({
      id,
      organizationId,
      customerId: customerData[scenario.customer].id!,
      assigneeMembershipId: scenario.assigned ? DEMO_MEMBERSHIP_ID : null,
      subject: scenario.subject,
      description: scenario.description,
      status: scenario.status,
      priority: scenario.priority,
      source: 'MANUAL',
      resolvedAt,
      closedAt,
      createdAt: at(scenario.days),
      updatedAt: closedAt ?? resolvedAt ?? at(scenario.days - 0.3),
    });
    const bodies = [
      scenario.description,
      scenario.reply,
      scenario.followup,
      scenario.note,
    ];
    bodies.forEach((body, messageIndex) => {
      const member = messageIndex === 1 || messageIndex === 3;
      messageData.push({
        id: demoId(`message:${index}:${messageIndex}`),
        organizationId,
        ticketId: id,
        authorMembershipId: member ? DEMO_MEMBERSHIP_ID : null,
        kind: messageIndex === 3 ? 'INTERNAL_NOTE' : 'PUBLIC_REPLY',
        authorType: member ? 'MEMBER' : 'CUSTOMER',
        source: 'MANUAL',
        body,
        createdAt: at(scenario.days - messageIndex * 0.1),
        updatedAt: at(scenario.days - messageIndex * 0.1),
      });
    });
    for (const tagIndex of scenario.tags)
      linkData.push({
        ticketId: id,
        tagId: tagData[tagIndex].id!,
        createdAt: at(scenario.days),
      });
    audit(
      `ticket:${index}`,
      'TICKET_CREATED',
      'TICKET',
      id,
      at(scenario.days),
      { demoSeed: DEMO_VERSION, source: 'MANUAL', priority: scenario.priority },
    );
    if (resolvedAt)
      audit(
        `resolved:${index}`,
        'TICKET_STATUS_CHANGED',
        'TICKET',
        id,
        resolvedAt,
        { demoSeed: DEMO_VERSION, from: 'OPEN', to: 'RESOLVED' },
      );
    if (closedAt)
      audit(
        `closed:${index}`,
        'TICKET_STATUS_CHANGED',
        'TICKET',
        id,
        closedAt,
        { demoSeed: DEMO_VERSION, from: 'RESOLVED', to: 'CLOSED' },
      );
  });
  return {
    organization: {
      id: organizationId,
      name: DEMO_NAME,
      slug: DEMO_SLUG,
      createdAt: at(29),
      updatedAt: at(29),
    },
    membership: {
      id: DEMO_MEMBERSHIP_ID,
      organizationId,
      userId: ownerId,
      role: 'OWNER' as const,
      createdAt: at(29),
      updatedAt: at(29),
    },
    customers: customerData,
    tags: tagData,
    tickets: ticketData,
    messages: messageData,
    links: linkData,
    audits: auditData,
  };
}
