import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

import type { TicketMessageKind } from '../../generated/prisma/enums.js';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '../../attachments/attachment-policy.js';

const MESSAGE_KINDS = [
  'PUBLIC_REPLY',
  'INTERNAL_NOTE',
] as const satisfies readonly TicketMessageKind[];

export class CreateTicketMessageDto {
  @ApiProperty({ type: String, required: true, enum: [...MESSAGE_KINDS] })
  @IsIn([...MESSAGE_KINDS])
  kind!: TicketMessageKind;

  @ApiProperty({
    type: String,
    required: true,
    minLength: 1,
    maxLength: 20_000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  body!: string;
  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    isArray: true,
    items: { type: 'string', format: 'uuid' },
    maxItems: MAX_ATTACHMENTS_PER_MESSAGE,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @IsUUID('4', {
    each: true,
  })
  attachmentIds?: string[];
}
