import {
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateTicketAssigneeDto {
  @ValidateIf(
    (_object, value) =>
      value !== null,
  )
  @IsUUID()
  membershipId!: string | null;
}