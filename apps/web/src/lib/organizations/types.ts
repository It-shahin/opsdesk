export type OrganizationRole =
  | 'OWNER'
  | 'ADMIN'
  | 'AGENT'
  | 'VIEWER';

export interface Organization {
  id:
    string;

  name:
    string;

  slug:
    string;

  role:
    OrganizationRole;

  createdAt:
    string;

  updatedAt:
    string;
}

export type TicketMessageKind =
  | 'PUBLIC_REPLY'
  | 'INTERNAL_NOTE';

export type TicketMessageAuthorType =
  | 'MEMBER'
  | 'CUSTOMER'
  | 'SYSTEM';

export type TicketMessageSource =
  | 'MANUAL'
  | 'EMAIL'
  | 'SYSTEM';

export type EmailDeliveryStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'DELAYED'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'SUPPRESSED'
  | 'FAILED';

export interface TicketAttachment {
  id:
    string;

  originalName:
    string;

  contentType:
    string;

  sizeBytes:
    number;

  status:
    string;

  uploadedAt:
    string | null;
}

export interface TicketMessage {
  id:
    string;

  kind:
    TicketMessageKind;

  authorType:
    TicketMessageAuthorType;

  source:
    TicketMessageSource;

  body:
    string;

  createdAt:
    string;

  updatedAt:
    string;

  authorMembership:
    {
      id:
        string;

      role:
        string;

      user: {
        id:
          string;

        name:
          string | null;

        email:
          string;

        avatarUrl:
          string | null;
      };
    } | null;

  emailDelivery:
    {
      id:
        string;

      status:
        EmailDeliveryStatus;

      sentAt:
        string | null;

      deliveredAt:
        string | null;

      failedAt:
        string | null;

      createdAt:
        string;
    } | null;

  attachments:
    TicketAttachment[];
}