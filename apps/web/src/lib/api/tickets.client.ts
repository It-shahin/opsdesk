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
  TicketAttachment,
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

interface AttachmentUploadInitResponse {
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
      'PENDING';

    uploadedAt:
      null;
  };

  upload: {
    url:
      string;

    method:
      'PUT';

    headers:
      Record<
        string,
        string
      >;

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

export function initiateTicketAttachment(
  organizationId:
    string,

  ticketId:
    string,

  file:
    File,
) {
  return apiClientFetch<
    AttachmentUploadInitResponse
  >(
    `/api/organizations/${organizationId}/tickets/${ticketId}/attachments/init`,
    {
      method:
        'POST',

      body:
        JSON.stringify({
          originalName:
            file.name,

          contentType:
            file.type,

          sizeBytes:
            file.size,
        }),
    },
  );
}

export function completeTicketAttachment(
  organizationId:
    string,

  ticketId:
    string,

  attachmentId:
    string,
) {
  return apiClientFetch<
    TicketAttachment
  >(
    `/api/organizations/${organizationId}/tickets/${ticketId}/attachments/${attachmentId}/complete`,
    {
      method:
        'POST',
    },
  );
}

export function createTicketMessage(
  organizationId:
    string,

  ticketId:
    string,

  input: {
    kind:
      'PUBLIC_REPLY' |
      'INTERNAL_NOTE';

    body:
      string;

    attachmentIds?:
      string[];
  },
) {
  return apiClientFetch<
    TicketMessage
  >(
    `/api/organizations/${organizationId}/tickets/${ticketId}/messages`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          input,
        ),
    },
  );
}

export async function uploadTicketAttachment(
  organizationId:
    string,

  ticketId:
    string,

  file:
    File,
) {
  const initiated =
    await initiateTicketAttachment(
      organizationId,
      ticketId,
      file,
    );

  const upload =
    await fetch(
      initiated.upload.url,
      {
        method:
          initiated.upload
            .method,

        headers:
          initiated.upload
            .headers,

        body:
          file,

        credentials:
          'omit',
      },
    );

  if (
    !upload.ok
  ) {
    throw new Error(
      `Failed to upload ${file.name}`,
    );
  }

  return completeTicketAttachment(
    organizationId,
    ticketId,
    initiated
      .attachment
      .id,
  );
}