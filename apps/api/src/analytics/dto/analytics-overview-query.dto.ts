import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const ANALYTICS_RANGES = ['7d', '30d', '90d'] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export class AnalyticsOverviewQueryDto {
  @ApiProperty({
    type: String,
    required: false,
    enum: [...ANALYTICS_RANGES],
    default: '30d',
  })
  @IsIn([...ANALYTICS_RANGES])
  range: AnalyticsRange = '30d';
}
