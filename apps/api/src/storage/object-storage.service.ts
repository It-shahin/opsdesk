import {
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand
} from '@aws-sdk/client-s3';

import {
  getSignedUrl,
} from '@aws-sdk/s3-request-presigner';

export type StoredObjectMetadata = {
  contentLength:
    number | null;

  contentType:
    string | null;

  etag:
    string | null;

  metadata:
    Record<string, string>;
};

@Injectable()
export class ObjectStorageService {
  private readonly client:
    S3Client;

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

  async createPresignedUploadUrl(
    input: {
      key: string;
      attachmentId: string;
      contentType: string;
    },
  ) {
    const expiresInSeconds =
      5 * 60;

    const command =
      new PutObjectCommand({
        Bucket:
          this.bucket,

        Key:
          input.key,

        ContentType:
          input.contentType,

        Metadata: {
          'attachment-id':
            input.attachmentId,
        },
      });

    const url =
      await getSignedUrl(
        this.client,
        command,
        {
          expiresIn:
            expiresInSeconds,

          unhoistableHeaders:
            new Set([
              'x-amz-meta-attachment-id',
            ]),

          signableHeaders:
            new Set([
              'content-type',
            ]),
        },
      );

    return {
      url,

      method:
        'PUT' as const,

      headers: {
        'Content-Type':
          input.contentType,

        'x-amz-meta-attachment-id':
          input.attachmentId,
      },

      expiresInSeconds,
    };
  }

  async headObject(
    key: string,
  ): Promise<
    StoredObjectMetadata | null
  > {
    try {
      const result =
        await this.client.send(
          new HeadObjectCommand({
            Bucket:
              this.bucket,

            Key:
              key,
          }),
        );

      return {
        contentLength:
          result.ContentLength ??
          null,

        contentType:
          result.ContentType ??
          null,

        etag:
          result.ETag
            ? result.ETag.replace(
                /^"|"$/g,
                '',
              )
            : null,

        metadata:
          result.Metadata ?? {},
      };
    } catch (error) {
      if (
        this.isNotFoundError(
          error,
        )
      ) {
        return null;
      }

      throw error;
    }
  }

  private isNotFoundError(
    error: unknown,
  ): boolean {
    if (
      typeof error !==
        'object' ||
      error === null
    ) {
      return false;
    }

    if (
      '$metadata' in error
    ) {
      const metadata =
        (
          error as {
            $metadata?: {
              httpStatusCode?:
                number;
            };
          }
        ).$metadata;

      return (
        metadata
          ?.httpStatusCode ===
        404
      );
    }

    return false;
  }

  async createPresignedDownloadUrl(
  key: string,
) {
  const expiresInSeconds =
    5 * 60;

  const command =
    new GetObjectCommand({
      Bucket:
        this.bucket,

      Key:
        key,
    });

  const url =
    await getSignedUrl(
      this.client,
      command,
      {
        expiresIn:
          expiresInSeconds,
      },
    );

  return {
    url,
    expiresInSeconds,
  };
}
}