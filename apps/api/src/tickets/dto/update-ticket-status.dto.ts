import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import type { TicketStatus } from '../../generated/prisma/enums.js';

const TICKET_STATUSES = [
  'OPEN',
  'PENDING',
  'RESOLVED',
  'CLOSED',
] as const satisfies readonly TicketStatus[];

export class UpdateTicketStatusDto {
  @ApiProperty({ type: String, required: true, enum: [...TICKET_STATUSES] })
  @IsIn([...TICKET_STATUSES])
  status!: TicketStatus;
}
