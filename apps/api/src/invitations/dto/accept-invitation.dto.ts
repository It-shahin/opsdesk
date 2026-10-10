import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({
    type: String,
    required: true,
    minLength: 32,
    maxLength: 256,
    description: 'Invitation secret. Never log or publish it.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}
