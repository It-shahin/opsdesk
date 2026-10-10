import type { SchemaObject } from '@nestjs/swagger';

const str: SchemaObject = { type: 'string' };
const uuid: SchemaObject = { type: 'string', format: 'uuid' };
const date: SchemaObject = { type: 'string', format: 'date-time' };
const num: SchemaObject = { type: 'number' };
const integer: SchemaObject = { type: 'integer' };
const bool: SchemaObject = { type: 'boolean' };
const nullable = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  nullable: true,
});
const enumeration = (...values: string[]): SchemaObject => ({
  type: 'string',
  enum: values,
});
const array = (schema: SchemaObject): SchemaObject => ({
  type: 'array',
  items: schema,
});
const object = (
  properties: Record<string, SchemaObject>,
  required = Object.keys(properties),
): SchemaObject => ({ type: 'object', properties, required });
const timestamps = { createdAt: date, updatedAt: date };
const role = enumeration('OWNER', 'ADMIN', 'AGENT', 'VIEWER');
const ticketStatus = enumeration('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');
const priority = enumeration('LOW', 'NORMAL', 'HIGH', 'URGENT');
const userSummary = object({
  id: uuid,
  email: { ...str, format: 'email' },
  name: nullable(str),
  avatarUrl: nullable(str),
});
const actor = object({
  id: uuid,
  name: nullable(str),
  email: { ...str, format: 'email' },
});
const customerSummary = object({
  id: uuid,
  name: str,
  email: nullable(str),
  company: nullable(str),
});
const assignee = object({ id: uuid, role, user: userSummary });
const tagSummary = object({ id: uuid, name: str });
const pagination = object({
  page: integer,
  limit: integer,
  total: integer,
  totalPages: integer,
  hasNextPage: bool,
  hasPreviousPage: bool,
});
const paginated = (schema: SchemaObject) =>
  object({ data: array(schema), pagination });
const organization = object({
  id: uuid,
  name: str,
  slug: str,
  role,
  ...timestamps,
});
const customer = object({
  id: uuid,
  name: str,
  email: nullable(str),
  phone: nullable(str),
  company: nullable(str),
  notes: nullable(str),
  archivedAt: nullable(date),
  ...timestamps,
});
// Projections vary by route: list omits description, create omits assignee/tags
// and resolved/closed timestamps. Optional fields describe those real projections.
const ticket = object(
  {
    id: uuid,
    subject: str,
    description: nullable(str),
    status: ticketStatus,
    priority,
    source: enumeration('MANUAL', 'EMAIL'),
    resolvedAt: nullable(date),
    closedAt: nullable(date),
    ...timestamps,
    customer: customerSummary,
    assignee: nullable(assignee),
    tags: array(tagSummary),
  },
  [
    'id',
    'subject',
    'status',
    'priority',
    'source',
    'createdAt',
    'updatedAt',
    'customer',
  ],
);
const attachmentSummary = object({
  id: uuid,
  originalName: str,
  contentType: str,
  sizeBytes: integer,
  status: enumeration('PENDING', 'UPLOADED'),
  uploadedAt: nullable(date),
});
const attachment = object({ ...attachmentSummary.properties, ...timestamps });
const deliveryStatus = enumeration(
  'PENDING',
  'SENDING',
  'SENT',
  'DELAYED',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'SUPPRESSED',
  'FAILED',
);
const message = object({
  id: uuid,
  kind: enumeration('PUBLIC_REPLY', 'INTERNAL_NOTE'),
  authorType: enumeration('MEMBER', 'CUSTOMER', 'SYSTEM'),
  source: enumeration('MANUAL', 'EMAIL', 'SYSTEM'),
  body: str,
  ...timestamps,
  authorMembership: nullable(assignee),
  attachments: array(attachmentSummary),
  emailDelivery: nullable(
    object({
      id: uuid,
      status: deliveryStatus,
      sentAt: nullable(date),
      deliveredAt: nullable(date),
      failedAt: nullable(date),
      createdAt: date,
    }),
  ),
});
const invitation = object({
  id: uuid,
  email: str,
  role,
  expiresAt: date,
  acceptedAt: nullable(date),
  canceledAt: nullable(date),
  ...timestamps,
  invitedBy: actor,
  status: enumeration('PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED'),
});
const member = object({ id: uuid, role, ...timestamps, user: userSummary });
const countMap = (...keys: string[]) =>
  object(Object.fromEntries(keys.map((key) => [key, integer])));
const dependency = object({
  status: enumeration('up', 'down'),
  latencyMs: num,
});

export const responseSchemas = {
  Error: object(
    { statusCode: integer, message: { oneOf: [str, array(str)] }, error: str },
    ['statusCode', 'message'],
  ),
  User: object({ ...userSummary.properties, ...timestamps }),
  Organization: organization,
  Organizations: array(organization),
  Customer: customer,
  Customers: paginated(customer),
  Ticket: ticket,
  Tickets: paginated(ticket),
  Message: message,
  Messages: array(message),
  Tag: object({ id: uuid, name: str, ...timestamps }),
  Tags: array(object({ id: uuid, name: str, ...timestamps })),
  Member: member,
  Members: array(member),
  Invitation: invitation,
  Invitations: array(invitation),
  CreatedInvitation: object({
    ...invitation.properties,
    acceptanceToken: {
      ...str,
      description:
        'One-time invitation secret. Never log or publish this value.',
    },
  }),
  AcceptedInvitation: object({
    membership: object({ id: uuid, role, createdAt: date }),
    organization: object({ id: uuid, name: str, slug: str }),
    invitation: object({ id: uuid, acceptedAt: date }),
  }),
  Attachment: attachment,
  InitiatedAttachment: object({
    attachment,
    upload: object({
      url: {
        ...str,
        format: 'uri',
        description: 'Short-lived signed URL; treat as a secret.',
      },
      method: enumeration('PUT'),
      headers: object({
        'Content-Type': str,
        'x-amz-meta-attachment-id': uuid,
      }),
      expiresInSeconds: integer,
    }),
  }),
  Download: object({
    attachment: object({ ...attachmentSummary.properties, messageId: uuid }),
    download: object({
      url: { ...str, format: 'uri' },
      expiresInSeconds: integer,
    }),
  }),
  AuditLogs: paginated(
    object({
      id: uuid,
      organizationId: uuid,
      action: str,
      entityType: str,
      entityId: nullable(uuid),
      actorUserId: nullable(uuid),
      actorMembershipId: nullable(uuid),
      actorRole: nullable(role),
      metadata: {
        nullable: true,
        description: 'Sanitized action-specific JSON metadata.',
      },
      createdAt: date,
      actorUser: nullable(actor),
    }),
  ),
  Analytics: object({
    range: object({
      preset: enumeration('7d', '30d', '90d'),
      timezone: enumeration('UTC'),
      from: date,
      to: date,
      days: integer,
    }),
    tickets: object({
      total: integer,
      active: integer,
      open: integer,
      pending: integer,
      resolved: integer,
      closed: integer,
      urgentActive: integer,
      unassignedActive: integer,
      createdInPeriod: integer,
      resolvedInPeriod: integer,
      averageResolutionMinutes: nullable(num),
      byStatus: countMap('OPEN', 'PENDING', 'RESOLVED', 'CLOSED'),
      byPriority: countMap('LOW', 'NORMAL', 'HIGH', 'URGENT'),
      bySource: countMap('MANUAL', 'EMAIL'),
    }),
    ticketVolume: array(
      object({
        date: { ...str, format: 'date' },
        created: integer,
        resolved: integer,
      }),
    ),
    customers: countMap('total', 'active', 'archived', 'createdInPeriod'),
    workload: array(
      object({
        membershipId: uuid,
        role,
        user: userSummary,
        openTickets: integer,
        pendingTickets: integer,
        activeTickets: integer,
      }),
    ),
    email: object({
      totalInPeriod: integer,
      delivered: integer,
      failed: integer,
      inFlight: integer,
      deliveryRatePercent: nullable(num),
      failureRatePercent: nullable(num),
      byStatus: countMap(...(deliveryStatus.enum as string[])),
    }),
  }),
  Root: object({ name: str, status: str }),
  Live: object({ status: enumeration('ok'), uptimeSeconds: integer }),
  Ready: object({
    status: enumeration('ready'),
    services: object({ database: dependency, redis: dependency }),
  }),
  Webhook: object({ received: bool, result: str }, ['received']),
} satisfies Record<string, SchemaObject>;

export type ResponseSchemaName = keyof typeof responseSchemas;
