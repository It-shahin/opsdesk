import {
  apiClientFetch,
} from './client';

import type {
  TicketFilterTag,
  TicketListResponse,
  TicketMember,
  TicketPriority,
  TicketStatus,
} from '@/lib/tickets/types';

export interface TicketFilters {
  page:
    number;

  search?:
    string;

  status?:
    TicketStatus;

  priority?:
    TicketPriority;

  assigneeMembershipId?:
    string;

  tagId?:
    string;

  sortBy:
    'createdAt' |
    'updatedAt';

  sortOrder:
    'asc' |
    'desc';
}

export function listTickets(
  organizationId:
    string,

  filters:
    TicketFilters,
) {
  const params =
    new URLSearchParams();

  params.set(
    'page',
    String(
      filters.page,
    ),
  );

  params.set(
    'limit',
    '20',
  );

  params.set(
    'sortBy',
    filters.sortBy,
  );

  params.set(
    'sortOrder',
    filters.sortOrder,
  );

  if (
    filters.search
  ) {
    params.set(
      'search',
      filters.search,
    );
  }

  if (
    filters.status
  ) {
    params.set(
      'status',
      filters.status,
    );
  }

  if (
    filters.priority
  ) {
    params.set(
      'priority',
      filters.priority,
    );
  }

  if (
    filters
      .assigneeMembershipId
  ) {
    params.set(
      'assigneeMembershipId',
      filters
        .assigneeMembershipId,
    );
  }

  if (
    filters.tagId
  ) {
    params.set(
      'tagId',
      filters.tagId,
    );
  }

  return apiClientFetch<
    TicketListResponse
  >(
    `/api/organizations/${organizationId}/tickets?${params.toString()}`,
  );
}

export function listTicketMembers(
  organizationId:
    string,
) {
  return apiClientFetch<
    TicketMember[]
  >(
    `/api/organizations/${organizationId}/members`,
  );
}

export function listTicketTags(
  organizationId:
    string,
) {
  return apiClientFetch<
    TicketFilterTag[]
  >(
    `/api/organizations/${organizationId}/tags`,
  );
}