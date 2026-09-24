import { ConflictException, NotFoundException } from '@nestjs/common';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service.js';

import { ObjectStorageService } from '../storage/object-storage.service.js';

import type { TenantContext } from '../tenancy/tenant-context.types.js';

import { AttachmentsService } from './attachments.service.js';

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  const ticketFindFirstMock = jest.fn();

  const attachmentCreateMock = jest.fn();

  const attachmentFindFirstMock = jest.fn();

  const attachmentUpdateManyMock = jest.fn();

  const buildKeyMock = jest.fn();

  const createSignedUrlMock = jest.fn();

  const headObjectMock = jest.fn();

  const prisma = {
    ticket: {
      findFirst: ticketFindFirstMock,
    },

    attachment: {
      create: attachmentCreateMock,

      findFirst: attachmentFindFirstMock,

      updateMany: attachmentUpdateManyMock,
    },
  };

  const storage = {
    buildAttachmentKey: buildKeyMock,

    createPresignedUploadUrl: createSignedUrlMock,

    headObject: headObjectMock,
  };

  const tenant: TenantContext = {
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

    organizationId: '11111111-1111-4111-8111-111111111111',

    membershipId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

    role: 'AGENT',
  };

  const ticketId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const attachmentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AttachmentsService(
      prisma as unknown as PrismaService,

      storage as unknown as ObjectStorageService,
    );
  });
  it('creates a pending attachment and returns a signed upload URL', async () => {
    ticketFindFirstMock.mockResolvedValue({
      id: ticketId,
    });

    buildKeyMock.mockReturnValue(
      'organizations/org/tickets/ticket/attachments/file',
    );

    attachmentCreateMock.mockImplementation(async ({ data }) => ({
      id: data.id,

      originalName: data.originalName,

      contentType: data.contentType,

      sizeBytes: data.sizeBytes,

      status: 'PENDING',

      uploadedAt: null,
    }));

    createSignedUrlMock.mockResolvedValue({
      url: 'https://r2.example/signed',

      method: 'PUT',

      headers: {
        'Content-Type': 'application/pdf',
      },

      expiresInSeconds: 300,
    });

    const result = await service.initiateUpload(tenant, ticketId, {
      originalName: 'invoice.pdf',

      contentType: 'application/pdf',

      sizeBytes: 1234,
    });

    expect(ticketFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: ticketId,

        organizationId: tenant.organizationId,
      },

      select: {
        id: true,
      },
    });

    expect(attachmentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: tenant.organizationId,

          ticketId,

          createdByMembershipId: tenant.membershipId,

          originalName: 'invoice.pdf',

          contentType: 'application/pdf',

          sizeBytes: 1234,

          status: 'PENDING',
        }),
      }),
    );

    expect(result.upload.url).toBe('https://r2.example/signed');

    expect(result.attachment.status).toBe('PENDING');
  });
  it('does not initiate uploads for a ticket outside the tenant', async () => {
    ticketFindFirstMock.mockResolvedValue(null);

    await expect(
      service.initiateUpload(tenant, ticketId, {
        originalName: 'file.pdf',

        contentType: 'application/pdf',

        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(attachmentCreateMock).not.toHaveBeenCalled();

    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });
  it('verifies the uploaded object before marking the attachment uploaded', async () => {
    attachmentFindFirstMock
      .mockResolvedValueOnce({
        id: attachmentId,

        originalName: 'invoice.pdf',

        contentType: 'application/pdf',

        sizeBytes: 1234,

        status: 'PENDING',

        uploadedAt: null,

        objectKey: 'object-key',
      })
      .mockResolvedValueOnce({
        id: attachmentId,

        originalName: 'invoice.pdf',

        contentType: 'application/pdf',

        sizeBytes: 1234,

        status: 'UPLOADED',

        uploadedAt: new Date(),
      });

    headObjectMock.mockResolvedValue({
      contentLength: 1234,

      contentType: 'application/pdf',

      etag: 'etag-value',

      metadata: {
        'attachment-id': attachmentId,
      },
    });

    attachmentUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    const result = await service.completeUpload(tenant, ticketId, attachmentId);

    expect(attachmentUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: attachmentId,

          organizationId: tenant.organizationId,

          ticketId,

          status: 'PENDING',
        },

        data: expect.objectContaining({
          status: 'UPLOADED',

          uploadedAt: expect.any(Date),

          etag: 'etag-value',
        }),
      }),
    );

    expect(result.status).toBe('UPLOADED');
  });

  it('rejects a completed object with the wrong size', async () => {
    attachmentFindFirstMock.mockResolvedValue({
      id: attachmentId,

      contentType: 'application/pdf',

      sizeBytes: 1000,

      status: 'PENDING',

      objectKey: 'object-key',
    });

    headObjectMock.mockResolvedValue({
      contentLength: 2000,

      contentType: 'application/pdf',

      etag: 'etag',

      metadata: {
        'attachment-id': attachmentId,
      },
    });

    await expect(
      service.completeUpload(tenant, ticketId, attachmentId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(attachmentUpdateManyMock).not.toHaveBeenCalled();
  });

  it('does not complete an attachment before the object exists', async () => {
    attachmentFindFirstMock.mockResolvedValue({
      id: attachmentId,

      contentType: 'application/pdf',

      sizeBytes: 1000,

      status: 'PENDING',

      objectKey: 'object-key',
    });

    headObjectMock.mockResolvedValue(null);

    await expect(
      service.completeUpload(tenant, ticketId, attachmentId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(attachmentUpdateManyMock).not.toHaveBeenCalled();
  });
});
