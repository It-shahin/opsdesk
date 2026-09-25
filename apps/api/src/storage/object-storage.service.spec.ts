import {
  ConfigService,
} from '@nestjs/config';

import {
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  ObjectStorageService,
} from './object-storage.service.js';

describe(
  'ObjectStorageService',
  () => {
    const values:
      Record<string, string> = {
        R2_ENDPOINT:
          'https://example.r2.cloudflarestorage.com',

        R2_BUCKET:
          'opsdesk-test',

        R2_ACCESS_KEY_ID:
          'test-access-key',

        R2_SECRET_ACCESS_KEY:
          'test-secret',
      };

    const getOrThrowMock =
      jest.fn(
        (key: string) => {
          const value =
            values[key];

          if (!value) {
            throw new Error(
              `Missing ${key}`,
            );
          }

          return value;
        },
      );

    const config = {
      getOrThrow:
        getOrThrowMock,
    } as unknown as ConfigService;

    it(
      'builds a tenant and ticket scoped attachment key',
      () => {
        const service =
          new ObjectStorageService(
            config,
          );

        const key =
          service.buildAttachmentKey(
            'org-1',
            'ticket-1',
            'attachment-1',
          );

        expect(key).toBe(
          'organizations/org-1/tickets/ticket-1/attachments/attachment-1',
        );
      },
    );

    it(
      'exposes the configured bucket name',
      () => {
        const service =
          new ObjectStorageService(
            config,
          );

        expect(
          service.getBucketName(),
        ).toBe(
          'opsdesk-test',
        );
      },
    );
  },
);