import {
  Transform,
} from 'class-transformer';

import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MAX_ATTACHMENT_SIZE =
  25 * 1024 * 1024;

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
  @IsString()
  @MinLength(1)
  @MaxLength(127)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_SIZE)
  sizeBytes!: number;
}