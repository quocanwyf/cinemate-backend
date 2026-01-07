import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  actorId?: string | null;

  @ApiPropertyOptional()
  sourceId?: string | null;

  @ApiPropertyOptional()
  movieId?: number | null;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  body?: string | null;

  @ApiPropertyOptional({ type: Object })
  data?: any;

  @ApiProperty()
  is_read: boolean;

  @ApiPropertyOptional()
  is_sent?: boolean;

  @ApiPropertyOptional()
  sent_at?: Date | null;

  @ApiProperty()
  createdAt: string | Date;

  @ApiPropertyOptional()
  expire_at?: Date | null;
}
