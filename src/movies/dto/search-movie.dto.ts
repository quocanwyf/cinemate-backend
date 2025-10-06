import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchMovieDto {
  @ApiProperty({
    description: 'The search query string',
    example: 'Inception',
  })
  @IsString()
  @IsNotEmpty()
  query: string;
}
