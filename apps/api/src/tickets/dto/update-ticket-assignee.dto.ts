import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateTicketAssigneeDto {
  @ApiProperty({
    type: String,
    required: true,
    nullable: true,
    format: 'uuid',
    description:
      'Assignable membership in this organization; null clears the assignee. VIEWER memberships cannot be assigned.',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  membershipId!: string | null;
}
