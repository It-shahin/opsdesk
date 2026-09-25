import {
  Transform,
} from 'class-transformer';

import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  ALLOWED_ATTACHMENT_CONTENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../attachment-policy.js';

export class InitiateAttachmentUploadDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  originalName!: string;

  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .trim()
          .toLowerCase()
      : value,
  )
  @IsIn([
    ...ALLOWED_ATTACHMENT_CONTENT_TYPES,
  ])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(
    MAX_ATTACHMENT_SIZE_BYTES,
  )
  sizeBytes!: number;
}