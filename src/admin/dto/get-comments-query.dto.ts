import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetCommentsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    minimum: 1,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search in comment content',
    example: 'great movie',
  })
  @IsOptional()
  @IsString()
  search?: string;

  // ✅ NEW: Filter by movieId
  @ApiPropertyOptional({
    description: 'Filter by movie ID',
    example: 'cm123abc',
  })
  @IsOptional()
  @IsString()
  movieId?: string;

  // ✅ NEW: Filter by userId
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: 'user_123',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  // ✅ NEW: Filter by date range
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601 format)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601 format)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}
