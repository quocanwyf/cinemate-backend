/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/movies/dto/search-movie.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsArray,
  IsIn,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class SearchMovieDto {
  @ApiPropertyOptional({
    description: 'Full text query (title/overview)',
    example: 'batman',
  })
  @IsOptional()
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Comma-separated genre IDs or repeated param',
    example: '28,12',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(Number).filter(Boolean);
    return value
      .toString()
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter(Boolean);
  })
  @IsArray()
  @IsInt({ each: true })
  genreIds?: number[];

  @ApiPropertyOptional({
    description: 'Minimum vote_average (DB scale, e.g., 0 means >=0)',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Maximum vote_average', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRating?: number;

  @ApiPropertyOptional({ description: 'Min year (YYYY)', example: 2018 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minYear?: number;

  @ApiPropertyOptional({ description: 'Max year (YYYY)', example: 2023 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxYear?: number;

  @ApiPropertyOptional({
    description: 'Only movies that have a trailer',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
  })
  @IsBoolean()
  hasTrailer?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['popularity', 'rating', 'release_date', 'title'],
    example: 'popularity',
  })
  @IsOptional()
  @IsIn(['popularity', 'rating', 'release_date', 'title'])
  sort?: 'popularity' | 'rating' | 'release_date' | 'title';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
