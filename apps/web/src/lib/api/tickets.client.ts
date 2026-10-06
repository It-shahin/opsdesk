import {
  apiClientFetch,
} from './client';

import type {
  TicketFilterTag,
  TicketListResponse,
  TicketMember,
  TicketPriority,
  TicketStatus,
  TicketMessage,
} from '@/lib/tickets/types';

import type {
  TicketDetail,
} from './tickets.server';

interface AttachmentDownloadResponse {
  attachment: {
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

    messageId:
      string;
  };

  download: {
    url:
      string;

    expiresInSeconds:
      number;
  };
}

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

export function getTicketClient(
  organizationId:
    string,

  ticketId:
    string,
) {
  return apiClientFetch<
    TicketDetail
  >(
    `/api/organizations/${organizationId}/tickets/${ticketId}`,
  );
}

export function listTicketMessages(
  organizationId:
    string,

  ticketId:
    string,
) {
  return apiClientFetch<
    TicketMessage[]
  >(
    `/api/organizations/${organizationId}/tickets/${ticketId}/messages`,
  );
}

export function getAttachmentDownload(
  organizationId:
    string,

  ticketId:
    string,

  attachmentId:
    string,
) {
  return apiClientFetch<
    AttachmentDownloadResponse
  >(
    `/api/organizations/${organizationId}/tickets/${ticketId}/attachments/${attachmentId}/download`,
  );
}