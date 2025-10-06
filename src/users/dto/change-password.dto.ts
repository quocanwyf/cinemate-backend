import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'The current password', example: 'password123' })
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @ApiProperty({ description: 'The new password', example: 'newPassword456' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
