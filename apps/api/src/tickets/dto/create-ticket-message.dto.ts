import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

import type { TicketMessageKind } from '../../generated/prisma/enums.js';
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '../../attachments/attachment-policy.js';

const MESSAGE_KINDS = [
  'PUBLIC_REPLY',
  'INTERNAL_NOTE',
] as const satisfies readonly TicketMessageKind[];

export class CreateTicketMessageDto {
  @IsIn([...MESSAGE_KINDS])
  kind!: TicketMessageKind;

  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  body!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(
    MAX_ATTACHMENTS_PER_MESSAGE,
  )
  @IsUUID('4', {
    each: true,
  })
  attachmentIds?: string[];
}