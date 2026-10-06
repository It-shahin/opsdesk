import 'server-only';

import {
  apiServerFetch,
} from './server';

import type {
  TicketPriority,
  TicketSource,
  TicketStatus,
  TicketTag,
} from '@/lib/tickets/types';

export interface TicketDetail {
  id:
    string;

  subject:
    string;

  description:
    string | null;

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

    phone:
      string | null;

    company:
      string | null;

    archivedAt:
      string | null;
  };

  tags:
    TicketTag[];
}

export function getTicket(
  organizationId:
    string,

  ticketId:
    string,
) {
  return apiServerFetch<
    TicketDetail
  >(
    `/v1/organizations/${organizationId}/tickets/${ticketId}`,
  );
}