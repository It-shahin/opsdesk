import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';

import { AttachmentsController } from '../src/attachments/attachments.controller.js';
import { AttachmentsService } from '../src/attachments/attachments.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PermissionGuard } from '../src/rbac/permission.guard.js';
import { PermissionsService } from '../src/rbac/permissions.service.js';
import { ObjectStorageService } from '../src/storage/object-storage.service.js';
import { TenantContextService } from '../src/tenancy/tenant-context.service.js';
import type { TenantAuthenticatedRequest } from '../src/tenancy/tenant-context.types.js';
import { TenantMembershipGuard } from '../src/tenancy/tenant-membership.guard.js';
import { TicketsController } from '../src/tickets/tickets.controller.js';
import { TicketsService } from '../src/tickets/tickets.service.js';
import { UsersService } from '../src/users/users.service.js';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const TICKET_A = '33333333-3333-4333-8333-333333333333';
const ATTACHMENT_A = '44444444-4444-4444-8444-444444444444';
const FOREIGN_ATTACHMENT = '55555555-5555-4555-8555-555555555555';
const MESSAGE_A = '66666666-6666-4666-8666-666666666666';
const AGENT_MEMBERSHIP = '77777777-7777-4777-8777-777777777777';
const VIEWER_MEMBERSHIP = '88888888-8888-4888-8888-888888888888';

const USERS = {
  agent: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sub: 'auth0|agent',
    email: 'agent@example.com',
    membershipId: AGENT_MEMBERSHIP,
    role: 'AGENT',
  },
  viewer: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    sub: 'auth0|viewer',
    email: 'viewer@example.com',
    membershipId: VIEWER_MEMBERSHIP,
    role: 'VIEWER',
  },
} as const;

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const authenticatedRequest = context
      .switchToHttp()
      .getRequest<TenantAuthenticatedRequest>();
    const authorization = authenticatedRequest.headers.authorization;
    const identities: Record<string, string> = {
      'Bearer agent-token': USERS.agent.sub,
      'Bearer viewer-token': USERS.viewer.sub,
    };
    const sub = authorization ? identities[authorization] : undefined;

    if (!sub) {
      throw new UnauthorizedException();
    }

    authenticatedRequest.auth = { sub };
    authenticatedRequest.accessToken = authorization.replace('Bearer ', '');
    return true;
  }
}

describe('Attachment HTTP security', () => {
  let app: INestApplication;

  const syncUserMock = jest.fn();
  const resolveTenantMock = jest.fn();
  const ticketFindFirstMock = jest.fn();
  const attachmentCreateMock = jest.fn();
  const attachmentFindFirstMock = jest.fn();
  const attachmentUpdateManyMock = jest.fn();
  const attachmentDeleteManyMock = jest.fn();
  const buildAttachmentKeyMock = jest.fn();
  const createUploadUrlMock = jest.fn();
  const createDownloadUrlMock = jest.fn();
  const headObjectMock = jest.fn();
  const deleteObjectMock = jest.fn();
  const txTicketFindFirstMock = jest.fn();
  const txTicketUpdateManyMock = jest.fn();
  const txAttachmentFindManyMock = jest.fn();
  const txAttachmentUpdateManyMock = jest.fn();
  const txMessageCreateMock = jest.fn();
  const txMessageFindFirstMock = jest.fn();

  const transactionClient = {
    ticket: {
      findFirst: txTicketFindFirstMock,
      updateMany: txTicketUpdateManyMock,
    },
    attachment: {
      findMany: txAttachmentFindManyMock,
      updateMany: txAttachmentUpdateManyMock,
    },
    ticketMessage: {
      create: txMessageCreateMock,
      findFirst: txMessageFindFirstMock,
    },
  };

  type TransactionCallback = (
    transaction: typeof transactionClient,
  ) => Promise<unknown>;

  const transactionMock =
    jest.fn<(callback: TransactionCallback) => Promise<unknown>>();

  const uploadUrl = `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/attachments/init`;
  const completeUrl = `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/attachments/${ATTACHMENT_A}/complete`;
  const messagesUrl = `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/messages`;
  const downloadUrl = `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/attachments/${ATTACHMENT_A}/download`;

  const pendingAttachment = (objectKey = 'object-key') => ({
    id: ATTACHMENT_A,
    originalName: 'hello.txt',
    contentType: 'text/plain',
    sizeBytes: 100,
    status: 'PENDING',
    uploadedAt: null,
    objectKey,
  });

  const configureIdentityMocks = () => {
    syncUserMock.mockImplementation(
      async (authenticatedRequest: TenantAuthenticatedRequest) => {
        const user = Object.values(USERS).find(
          (candidate) => candidate.sub === authenticatedRequest.auth.sub,
        );

        if (!user) {
          throw new Error('Unknown test user');
        }

        return { id: user.id, email: user.email };
      },
    );

    resolveTenantMock.mockImplementation(
      async (userId: string, organizationId: string) => {
        if (organizationId !== ORG_A) {
          return null;
        }

        const user = Object.values(USERS).find(
          (candidate) => candidate.id === userId,
        );

        return user
          ? {
              userId: user.id,
              organizationId: ORG_A,
              membershipId: user.membershipId,
              role: user.role,
            }
          : null;
      },
    );
  };

  beforeAll(async () => {
    const prisma = {
      ticket: { findFirst: ticketFindFirstMock },
      attachment: {
        create: attachmentCreateMock,
        findFirst: attachmentFindFirstMock,
        updateMany: attachmentUpdateManyMock,
        deleteMany: attachmentDeleteManyMock,
      },
      $transaction: transactionMock,
    };
    const storage = {
      buildAttachmentKey: buildAttachmentKeyMock,
      createPresignedUploadUrl: createUploadUrlMock,
      createPresignedDownloadUrl: createDownloadUrlMock,
      headObject: headObjectMock,
      deleteObject: deleteObjectMock,
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AttachmentsController, TicketsController],
      providers: [
        Reflector,
        PermissionsService,
        PermissionGuard,
        TenantMembershipGuard,
        AttachmentsService,
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ObjectStorageService, useValue: storage },
        {
          provide: TenantContextService,
          useValue: { resolve: resolveTenantMock },
        },
        {
          provide: UsersService,
          useValue: { syncAuthenticatedUser: syncUserMock },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new TestAuthGuard());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    configureIdentityMocks();
    transactionMock.mockImplementation(async (callback) =>
      callback(transactionClient),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post(uploadUrl)
      .send({
        originalName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(401);
  });

  it('prevents viewers from initiating uploads', async () => {
    await request(app.getHttpServer())
      .post(uploadUrl)
      .set('Authorization', 'Bearer viewer-token')
      .send({
        originalName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(403);

    expect(ticketFindFirstMock).not.toHaveBeenCalled();
    expect(createUploadUrlMock).not.toHaveBeenCalled();
  });

  it('allows an agent to initiate an upload', async () => {
    ticketFindFirstMock.mockResolvedValue({ id: TICKET_A });
    buildAttachmentKeyMock.mockReturnValue(
      `organizations/${ORG_A}/tickets/${TICKET_A}/attachments/generated`,
    );
    attachmentCreateMock.mockResolvedValue({
      id: ATTACHMENT_A,
      originalName: 'hello.txt',
      contentType: 'text/plain',
      sizeBytes: 100,
      status: 'PENDING',
      uploadedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createUploadUrlMock.mockResolvedValue({
      url: 'https://r2.example/signed-put',
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        'x-amz-meta-attachment-id': ATTACHMENT_A,
      },
      expiresInSeconds: 300,
    });

    const response = await request(app.getHttpServer())
      .post(uploadUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        originalName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(201);

    expect(response.body.attachment.status).toBe('PENDING');
    expect(response.body.upload.url).toBe('https://r2.example/signed-put');
    expect(response.body.attachment).not.toHaveProperty('objectKey');
    expect(ticketFindFirstMock).toHaveBeenCalledWith({
      where: { id: TICKET_A, organizationId: ORG_A },
      select: { id: true },
    });
  });

  it('does not create upload permissions for another organization', async () => {
    await request(app.getHttpServer())
      .post(`/v1/organizations/${ORG_B}/tickets/${TICKET_A}/attachments/init`)
      .set('Authorization', 'Bearer agent-token')
      .send({
        originalName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(404);

    expect(attachmentCreateMock).not.toHaveBeenCalled();
    expect(createUploadUrlMock).not.toHaveBeenCalled();
  });

  it('does not create upload permissions for a ticket outside the tenant', async () => {
    ticketFindFirstMock.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(uploadUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        originalName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
      })
      .expect(404);

    expect(attachmentCreateMock).not.toHaveBeenCalled();
    expect(createUploadUrlMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported content types before storage signing', async () => {
    await request(app.getHttpServer())
      .post(uploadUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        originalName: 'attack.html',
        contentType: 'text/html',
        sizeBytes: 100,
      })
      .expect(400);

    expect(ticketFindFirstMock).not.toHaveBeenCalled();
    expect(createUploadUrlMock).not.toHaveBeenCalled();
  });

  it('rejects attachments over the per-file size limit', async () => {
    await request(app.getHttpServer())
      .post(uploadUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        originalName: 'large.pdf',
        contentType: 'application/pdf',
        sizeBytes: 25 * 1024 * 1024 + 1,
      })
      .expect(400);

    expect(createUploadUrlMock).not.toHaveBeenCalled();
  });

  it('rejects filename and MIME type mismatches', async () => {
    ticketFindFirstMock.mockResolvedValue({ id: TICKET_A });

    await request(app.getHttpServer())
      .post(uploadUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        originalName: 'payload.exe',
        contentType: 'application/pdf',
        sizeBytes: 100,
      })
      .expect(400);

    expect(attachmentCreateMock).not.toHaveBeenCalled();
    expect(createUploadUrlMock).not.toHaveBeenCalled();
  });

  it('does not complete a PENDING attachment before its R2 object exists', async () => {
    attachmentFindFirstMock.mockResolvedValue(pendingAttachment());
    headObjectMock.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(completeUrl)
      .set('Authorization', 'Bearer agent-token')
      .expect(409);

    expect(attachmentUpdateManyMock).not.toHaveBeenCalled();
  });

  it('verifies R2 before completing an upload', async () => {
    attachmentFindFirstMock
      .mockResolvedValueOnce(pendingAttachment())
      .mockResolvedValueOnce({
        id: ATTACHMENT_A,
        originalName: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: 100,
        status: 'UPLOADED',
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    headObjectMock.mockResolvedValue({
      contentLength: 100,
      contentType: 'text/plain',
      etag: 'etag-123',
      metadata: { 'attachment-id': ATTACHMENT_A },
    });
    attachmentUpdateManyMock.mockResolvedValue({ count: 1 });

    const response = await request(app.getHttpServer())
      .post(completeUrl)
      .set('Authorization', 'Bearer agent-token')
      .expect(200);

    expect(response.body.status).toBe('UPLOADED');
    expect(headObjectMock).toHaveBeenCalledWith('object-key');
    expect(attachmentUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ATTACHMENT_A,
          organizationId: ORG_A,
          ticketId: TICKET_A,
          status: 'PENDING',
        },
        data: expect.objectContaining({
          status: 'UPLOADED',
          uploadedAt: expect.any(Date),
          etag: 'etag-123',
        }),
      }),
    );
  });

  it('removes an invalid uploaded object when its size does not match', async () => {
    attachmentFindFirstMock.mockResolvedValue(pendingAttachment('bad-object'));
    headObjectMock.mockResolvedValue({
      contentLength: 500,
      contentType: 'text/plain',
      etag: 'etag',
      metadata: { 'attachment-id': ATTACHMENT_A },
    });
    deleteObjectMock.mockResolvedValue(undefined);
    attachmentDeleteManyMock.mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .post(completeUrl)
      .set('Authorization', 'Bearer agent-token')
      .expect(409);

    expect(deleteObjectMock).toHaveBeenCalledWith('bad-object');
    expect(attachmentDeleteManyMock).toHaveBeenCalledWith({
      where: { id: ATTACHMENT_A, status: 'PENDING' },
    });
  });

  it('atomically links an uploaded attachment to a message', async () => {
    txTicketFindFirstMock.mockResolvedValue({ id: TICKET_A, status: 'OPEN' });
    txAttachmentFindManyMock.mockResolvedValue([
      { id: ATTACHMENT_A, sizeBytes: 100 },
    ]);
    txMessageCreateMock.mockResolvedValue({ id: MESSAGE_A });
    txAttachmentUpdateManyMock.mockResolvedValue({ count: 1 });
    txMessageFindFirstMock.mockResolvedValue({
      id: MESSAGE_A,
      kind: 'PUBLIC_REPLY',
      authorType: 'MEMBER',
      source: 'MANUAL',
      body: 'See attachment.',
      attachments: [
        {
          id: ATTACHMENT_A,
          originalName: 'hello.txt',
          contentType: 'text/plain',
          sizeBytes: 100,
          status: 'UPLOADED',
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .post(messagesUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        kind: 'PUBLIC_REPLY',
        body: 'See attachment.',
        attachmentIds: [ATTACHMENT_A],
      })
      .expect(201);

    expect(response.body.attachments).toEqual([
      expect.objectContaining({ id: ATTACHMENT_A }),
    ]);
    expect(txAttachmentFindManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: [ATTACHMENT_A] },
        organizationId: ORG_A,
        ticketId: TICKET_A,
        status: 'UPLOADED',
        messageId: null,
      },
      select: { id: true, sizeBytes: true },
    });
    expect(txAttachmentUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: [ATTACHMENT_A] },
        organizationId: ORG_A,
        ticketId: TICKET_A,
        status: 'UPLOADED',
        messageId: null,
      },
      data: { messageId: MESSAGE_A },
    });
  });

  it('rejects an unavailable or already-linked attachment', async () => {
    txTicketFindFirstMock.mockResolvedValue({ id: TICKET_A, status: 'OPEN' });
    txAttachmentFindManyMock.mockResolvedValue([]);

    await request(app.getHttpServer())
      .post(messagesUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        kind: 'PUBLIC_REPLY',
        body: 'Attempt reuse',
        attachmentIds: [ATTACHMENT_A],
      })
      .expect(409);

    expect(txMessageCreateMock).not.toHaveBeenCalled();
  });

  it('rejects messages whose attachments exceed the combined size limit', async () => {
    const attachmentB = '99999999-9999-4999-8999-999999999999';
    const attachmentC = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    txTicketFindFirstMock.mockResolvedValue({ id: TICKET_A, status: 'OPEN' });
    txAttachmentFindManyMock.mockResolvedValue([
      { id: ATTACHMENT_A, sizeBytes: 25 * 1024 * 1024 },
      { id: attachmentB, sizeBytes: 25 * 1024 * 1024 },
      { id: attachmentC, sizeBytes: 1 },
    ]);

    await request(app.getHttpServer())
      .post(messagesUrl)
      .set('Authorization', 'Bearer agent-token')
      .send({
        kind: 'PUBLIC_REPLY',
        body: 'Too much data',
        attachmentIds: [ATTACHMENT_A, attachmentB, attachmentC],
      })
      .expect(400);

    expect(txMessageCreateMock).not.toHaveBeenCalled();
  });

  it('allows a viewer to request a download for a conversation attachment', async () => {
    attachmentFindFirstMock.mockResolvedValue({
      id: ATTACHMENT_A,
      originalName: 'hello.txt',
      contentType: 'text/plain',
      sizeBytes: 100,
      status: 'UPLOADED',
      uploadedAt: new Date(),
      objectKey: 'private-object-key',
      messageId: MESSAGE_A,
    });
    createDownloadUrlMock.mockResolvedValue({
      url: 'https://r2.example/signed-get',
      expiresInSeconds: 300,
    });

    const response = await request(app.getHttpServer())
      .get(downloadUrl)
      .set('Authorization', 'Bearer viewer-token')
      .expect(200);

    expect(response.body.download.url).toBe('https://r2.example/signed-get');
    expect(response.body.attachment).not.toHaveProperty('objectKey');
    expect(createDownloadUrlMock).toHaveBeenCalledWith({
      key: 'private-object-key',
      filename: 'hello.txt',
      contentType: 'text/plain',
    });
  });

  it('never signs a download for an attachment outside the tenant or ticket', async () => {
    attachmentFindFirstMock.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(
        `/v1/organizations/${ORG_A}/tickets/${TICKET_A}/attachments/${FOREIGN_ATTACHMENT}/download`,
      )
      .set('Authorization', 'Bearer viewer-token')
      .expect(404);

    expect(createDownloadUrlMock).not.toHaveBeenCalled();
  });

  it('does not expose download signing through another organization', async () => {
    await request(app.getHttpServer())
      .get(
        `/v1/organizations/${ORG_B}/tickets/${TICKET_A}/attachments/${ATTACHMENT_A}/download`,
      )
      .set('Authorization', 'Bearer viewer-token')
      .expect(404);

    expect(attachmentFindFirstMock).not.toHaveBeenCalled();
    expect(createDownloadUrlMock).not.toHaveBeenCalled();
  });
});
