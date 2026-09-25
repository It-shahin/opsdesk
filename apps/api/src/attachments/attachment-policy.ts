export const MAX_ATTACHMENT_SIZE_BYTES =
  25 * 1024 * 1024;

export const MAX_ATTACHMENTS_PER_MESSAGE =
  10;

export const MAX_MESSAGE_ATTACHMENTS_BYTES =
  50 * 1024 * 1024;

export const PENDING_UPLOAD_MAX_AGE_MS =
  60 * 60 * 1000;

export const UNLINKED_UPLOAD_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

export const ALLOWED_ATTACHMENT_CONTENT_TYPES = [
  'application/pdf',

  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',

  'text/plain',
  'text/csv',

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export type AllowedAttachmentContentType =
  (typeof ALLOWED_ATTACHMENT_CONTENT_TYPES)[number];

const EXTENSIONS_BY_CONTENT_TYPE:
  Record<
    AllowedAttachmentContentType,
    readonly string[]
  > = {
  'application/pdf': [
    '.pdf',
  ],

  'image/jpeg': [
    '.jpg',
    '.jpeg',
  ],

  'image/png': [
    '.png',
  ],

  'image/webp': [
    '.webp',
  ],

  'image/gif': [
    '.gif',
  ],

  'text/plain': [
    '.txt',
  ],

  'text/csv': [
    '.csv',
  ],

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    [
      '.docx',
    ],

  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    [
      '.xlsx',
    ],

  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    [
      '.pptx',
    ],
};

export function normalizeContentType(
  contentType: string,
): string {
  return contentType
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
}

export function isAllowedContentType(
  value: string,
): value is AllowedAttachmentContentType {
  return (
    ALLOWED_ATTACHMENT_CONTENT_TYPES as readonly string[]
  ).includes(
    normalizeContentType(
      value,
    ),
  );
}

export function sanitizeFilename(
  filename: string,
): string {
  let safe = filename
    .normalize('NFKC')
    .replace(
      /[\u0000-\u001f\u007f]/g,
      '',
    )
    .replace(
      /[\\/]/g,
      '_',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();

  safe = safe.replace(
    /^\.+/,
    '',
  );

  if (!safe) {
    safe = 'attachment';
  }

  return safe.slice(
    0,
    200,
  );
}

export function filenameMatchesContentType(
  filename: string,
  contentType: AllowedAttachmentContentType,
): boolean {
  const lower =
    filename.toLowerCase();

  return EXTENSIONS_BY_CONTENT_TYPE[
    contentType
  ].some(
    (extension) =>
      lower.endsWith(
        extension,
      ),
  );
}