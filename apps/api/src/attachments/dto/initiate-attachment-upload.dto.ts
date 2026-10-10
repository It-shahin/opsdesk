import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

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
  @ApiProperty({ type: String, required: true, minLength: 1, maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  originalName!: string;

  @ApiProperty({
    type: String,
    required: true,
    enum: [...ALLOWED_ATTACHMENT_CONTENT_TYPES],
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn([...ALLOWED_ATTACHMENT_CONTENT_TYPES])
  contentType!: string;

  @ApiProperty({
    type: 'integer',
    required: true,
    minimum: 1,
    maximum: MAX_ATTACHMENT_SIZE_BYTES,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_SIZE_BYTES)
  sizeBytes!: number;
}
