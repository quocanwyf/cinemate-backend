import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'New display name for the user',
    minLength: 1,
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  display_name?: string;
}
