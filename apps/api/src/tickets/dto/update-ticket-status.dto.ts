import { IsIn } from 'class-validator';

import type { TicketStatus } from '../../generated/prisma/enums.js';

const TICKET_STATUSES = [
  'OPEN',
  'PENDING',
  'RESOLVED',
  'CLOSED',
] as const satisfies readonly TicketStatus[];

export class UpdateTicketStatusDto {
  @IsIn([...TICKET_STATUSES])
  status!: TicketStatus;
}