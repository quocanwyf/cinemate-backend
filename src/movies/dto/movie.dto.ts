import { ApiProperty } from '@nestjs/swagger';

export class MovieDto {
  @ApiProperty({ example: 603692 })
  id: number;

  @ApiProperty({ example: 'John Wick: Chapter 4' })
  title: string;

  @ApiProperty({ example: '/hac2Lq6hD2Hh1M32w02p8V3YcFl.jpg' })
  poster_path: string;

  @ApiProperty({ example: 4.3 })
  vote_average: number;
}
