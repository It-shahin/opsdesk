export type TicketStatus =
  | 'OPEN'
  | 'PENDING'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export type TicketSource =
  | 'MANUAL'
  | 'EMAIL';

export interface TicketTag {
  id:
    string;

  name:
    string;
}

export interface TicketAssignee {
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
}

export interface TicketListItem {
  id:
    string;

  subject:
    string;

  status:
    TicketStatus;

  priority:
    TicketPriority;

  source:
    TicketSource;

  resolvedAt:
    string | null;

  closedAt:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;

  customer: {
    id:
      string;

    name:
      string;

    email:
      string | null;

    company:
      string | null;
  };

  assignee:
    TicketAssignee | null;

  tags:
    TicketTag[];
}

export interface TicketListResponse {
  data:
    TicketListItem[];

  pagination: {
    page:
      number;

    limit:
      number;

    total:
      number;

    totalPages:
      number;

    hasNextPage:
      boolean;

    hasPreviousPage:
      boolean;
  };
}

export interface TicketMember {
  id:
    string;

  role:
    string;

  createdAt:
    string;

  updatedAt:
    string;

  user: {
    id:
      string;

    email:
      string;

    name:
      string | null;

    avatarUrl:
      string | null;
  };
}

export interface TicketFilterTag {
  id:
    string;

  name:
    string;

  createdAt:
    string;

  updatedAt:
    string;

  _count: {
    ticketLinks:
      number;
  };
}