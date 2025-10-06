import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({
    description: 'The rating score from 1 to 5',
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}
