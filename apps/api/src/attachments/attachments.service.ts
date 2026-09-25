import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  filenameMatchesContentType,
  isAllowedContentType,
  normalizeContentType,
  sanitizeFilename,
  PENDING_UPLOAD_MAX_AGE_MS,
  UNLINKED_UPLOAD_MAX_AGE_MS,
} from './attachment-policy.js';

import {
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  ObjectStorageService,
} from '../storage/object-storage.service.js';

import type {
  TenantContext,
} from '../tenancy/tenant-context.types.js';

type InitiateAttachmentInput = {
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly storage:
      ObjectStorageService,
  ) {}

  async initiateUpload(
    tenant: TenantContext,
    ticketId: string,
    input:
      InitiateAttachmentInput,
  ) {
    const contentType =
      normalizeContentType(
        input.contentType,
      );

    if (
      !isAllowedContentType(
        contentType,
      )
    ) {
      throw new BadRequestException(
        'Attachment type is not allowed',
      );
    }

    const safeFilename =
      sanitizeFilename(
        input.originalName,
      );

    if (
      !filenameMatchesContentType(
        safeFilename,
        contentType,
      )
    ) {
      throw new BadRequestException(
        'Filename extension does not match attachment type',
      );
    }
    const ticket =
      await this.prisma.ticket.findFirst({
        where: {
          id:
            ticketId,

          organizationId:
            tenant.organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!ticket) {
      throw new NotFoundException(
        'Ticket not found',
      );
    }

    const attachmentId =
      randomUUID();

    const objectKey =
      this.storage
        .buildAttachmentKey(
          tenant.organizationId,
          ticket.id,
          attachmentId,
        );

    /*
     * Create DB metadata FIRST.
     *
     * If URL signing fails, we have
     * a harmless PENDING DB row.
     *
     * The reverse would be worse:
     * giving somebody an upload URL
     * for an object that isn't known
     * to the database.
     */
    const attachment =
      await this.prisma.attachment.create({
        data: {
          id:
            attachmentId,

          organizationId:
            tenant.organizationId,

          ticketId:
            ticket.id,

          createdByMembershipId:
            tenant.membershipId,

          objectKey,

          originalName:
            safeFilename,

          contentType:
            input.contentType,

          sizeBytes:
            input.sizeBytes,

          status:
            'PENDING',
        },

        select:
          this.attachmentSelect(),
      });

    const upload =
      await this.storage
        .createPresignedUploadUrl({
          key:
            objectKey,

          attachmentId,

          contentType,
        });

    return {
      attachment,
      upload,
    };
  }

  async completeUpload(
    tenant: TenantContext,
    ticketId: string,
    attachmentId: string,
  ) {
    const attachment =
      await this.prisma.attachment.findFirst({
        where: {
          id:
            attachmentId,

          organizationId:
            tenant.organizationId,

          ticketId,
        },

        select: {
          id: true,
          originalName: true,
          contentType: true,
          sizeBytes: true,
          status: true,
          uploadedAt: true,
          createdAt: true,
          updatedAt: true,

          objectKey: true,
        },
      });

    if (!attachment) {
      throw new NotFoundException(
        'Attachment not found',
      );
    }

    /*
     * Completion is idempotent.
     */
    if (
      attachment.status ===
      'UPLOADED'
    ) {
      return this.toResponse(
        attachment,
      );
    }

    const object =
      await this.storage.headObject(
        attachment.objectKey,
      );

    if (!object) {
      throw new ConflictException(
        'Attachment upload has not completed',
      );
    }

    if (
      object.contentLength !==
      attachment.sizeBytes
    ) {
      return this.rejectInvalidUpload(
        attachment,
        'Uploaded file size does not match attachment metadata',
      );
    }

    if (
      !object.contentType ||
      normalizeContentType(
        object.contentType,
      ) !==
        normalizeContentType(
          attachment.contentType,
        )
    ) {
      return this.rejectInvalidUpload(
        attachment,
        'Uploaded file type does not match attachment metadata',
      );
    }

    const storedAttachmentId =
      object.metadata[
        'attachment-id'
      ];

    if (
      storedAttachmentId !==
      attachment.id
    ) {
      return this.rejectInvalidUpload(
        attachment,
        'Uploaded object metadata is invalid',
      );
    }

    const uploadedAt =
      new Date();

    const updated =
      await this.prisma.attachment.updateMany({
        where: {
          id:
            attachment.id,

          organizationId:
            tenant.organizationId,

          ticketId,

          status:
            'PENDING',
        },

        data: {
          status:
            'UPLOADED',

          uploadedAt,

          etag:
            object.etag,
        },
      });

    if (
      updated.count !== 1
    ) {
      /*
       * Another completion request
       * may have won the race.
       */
      const current =
        await this.prisma.attachment.findFirst({
          where: {
            id:
              attachment.id,

            organizationId:
              tenant.organizationId,

            ticketId,
          },

          select:
            this.attachmentSelect(),
        });

      if (
        current?.status ===
        'UPLOADED'
      ) {
        return current;
      }

      throw new ConflictException(
        'Attachment state changed concurrently',
      );
    }

    const completed =
      await this.prisma.attachment.findFirst({
        where: {
          id:
            attachment.id,

          organizationId:
            tenant.organizationId,

          ticketId,
        },

        select:
          this.attachmentSelect(),
      });

    if (!completed) {
      throw new NotFoundException(
        'Attachment not found',
      );
    }

    return completed;
  }

  private attachmentSelect() {
    return {
      id: true,
      originalName: true,
      contentType: true,
      sizeBytes: true,
      status: true,
      uploadedAt: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private toResponse<
    T extends {
      objectKey?: string;
    },
  >(
    attachment: T,
  ) {
    const {
      objectKey:
        _objectKey,
      ...response
    } = attachment;

    return response;
  }

  async createDownloadUrl(
  tenant: TenantContext,
  ticketId: string,
  attachmentId: string,
) {
  const attachment =
    await this.prisma.attachment.findFirst({
      where: {
        id:
          attachmentId,

        organizationId:
          tenant.organizationId,

        ticketId,

        status:
          'UPLOADED',

        messageId: {
          not: null,
        },

        message: {
          is: {
            organizationId:
              tenant.organizationId,

            ticketId,
          },
        },
      },

      select: {
        id: true,
        originalName: true,
        contentType: true,
        sizeBytes: true,
        status: true,
        uploadedAt: true,

        objectKey: true,

        messageId: true,
      },
    });

  if (!attachment) {
    throw new NotFoundException(
      'Attachment not found',
    );
  }

  const download =
  await this.storage
    .createPresignedDownloadUrl({
      key:
        attachment.objectKey,

      filename:
        attachment.originalName,

      contentType:
        attachment.contentType,
    });

  return {
    attachment: {
      id:
        attachment.id,

      originalName:
        attachment.originalName,

      contentType:
        attachment.contentType,

      sizeBytes:
        attachment.sizeBytes,

      status:
        attachment.status,

      uploadedAt:
        attachment.uploadedAt,

      messageId:
        attachment.messageId,
    },

    download,
  };
}

private async rejectInvalidUpload(
  attachment: {
    id: string;
    objectKey: string;
  },
  message: string,
): Promise<never> {
  try {
    await this.storage.deleteObject(
      attachment.objectKey,
    );

    await this.prisma.attachment.deleteMany({
      where: {
        id:
          attachment.id,

        status:
          'PENDING',
      },
    });
  } catch {
    /*
     * Leave the DB record/object for
     * the abandoned-upload cleanup pass.
     */
  }

  throw new ConflictException(
    message,
  );
}

async cleanupAbandonedUploads() {
  const now =
    Date.now();

  const pendingBefore =
    new Date(
      now -
        PENDING_UPLOAD_MAX_AGE_MS,
    );

  const unlinkedBefore =
    new Date(
      now -
        UNLINKED_UPLOAD_MAX_AGE_MS,
    );

  const candidates =
    await this.prisma.attachment.findMany({
      where: {
        OR: [
          {
            status:
              'PENDING',

            createdAt: {
              lt:
                pendingBefore,
            },
          },

          {
            status:
              'UPLOADED',

            messageId:
              null,

            createdAt: {
              lt:
                unlinkedBefore,
            },
          },
        ],
      },

      select: {
        id: true,
        objectKey: true,
      },

      orderBy: {
        createdAt:
          'asc',
      },

      take:
        100,
    });

  let deleted =
    0;

  let failed =
    0;

  for (
    const attachment
    of candidates
  ) {
    try {
      await this.storage.deleteObject(
        attachment.objectKey,
      );

      await this.prisma.attachment.deleteMany({
        where: {
          id:
            attachment.id,

          messageId:
            null,
        },
      });

      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    scanned:
      candidates.length,

    deleted,
    failed,
  };
}
}
