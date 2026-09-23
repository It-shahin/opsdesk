import {
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class ObjectStorageService {
  readonly client: S3Client;

  private readonly bucket:
    string;

  constructor(
    private readonly config:
      ConfigService,
  ) {
    const endpoint =
      this.config.getOrThrow<string>(
        'R2_ENDPOINT',
      );

    const accessKeyId =
      this.config.getOrThrow<string>(
        'R2_ACCESS_KEY_ID',
      );

    const secretAccessKey =
      this.config.getOrThrow<string>(
        'R2_SECRET_ACCESS_KEY',
      );

    this.bucket =
      this.config.getOrThrow<string>(
        'R2_BUCKET',
      );

    this.client =
      new S3Client({
        region: 'auto',

        endpoint,

        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
  }

  getBucketName(): string {
    return this.bucket;
  }

  buildAttachmentKey(
    organizationId: string,
    ticketId: string,
    attachmentId: string,
  ): string {
    return [
      'organizations',
      organizationId,
      'tickets',
      ticketId,
      'attachments',
      attachmentId,
    ].join('/');
  }
}