export const MAX_ATTACHMENT_SIZE_BYTES =
  25 *
  1024 *
  1024;

export const MAX_ATTACHMENTS_PER_MESSAGE =
  10;

export const MAX_MESSAGE_ATTACHMENTS_BYTES =
  50 *
  1024 *
  1024;

export const ALLOWED_ATTACHMENT_CONTENT_TYPES =
  new Set([
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
  ]);

export const ATTACHMENT_ACCEPT =
  [
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.txt',
    '.csv',
    '.docx',
    '.xlsx',
    '.pptx',
  ].join(',');

export function validateFiles(
  files:
    File[],
): string | null {
  if (
    files.length >
    MAX_ATTACHMENTS_PER_MESSAGE
  ) {
    return 'A message can contain at most 10 attachments.';
  }

  let total =
    0;

  for (
    const file
    of files
  ) {
    const contentType =
      file.type
        .split(
          ';',
          1,
        )[0]
        .trim()
        .toLowerCase();

    if (
      !ALLOWED_ATTACHMENT_CONTENT_TYPES
        .has(
          contentType,
        )
    ) {
      return `${file.name} is not an allowed file type.`;
    }

    if (
      file.size >
      MAX_ATTACHMENT_SIZE_BYTES
    ) {
      return `${file.name} exceeds the 25 MB limit.`;
    }

    total +=
      file.size;
  }

  if (
    total >
    MAX_MESSAGE_ATTACHMENTS_BYTES
  ) {
    return 'Attachments exceed the 50 MB total limit.';
  }

  return null;
}