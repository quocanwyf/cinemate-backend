import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address for registration',
    example: 'jane.smith@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password for account security',
    example: 'mySecurePassword123',
    minLength: 6,
    maxLength: 50,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  password: string;

  @ApiProperty({
    description: 'Display name for the user profile',
    example: 'Jane Smith',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Display name must be a string' })
  @IsNotEmpty({ message: 'Display name cannot be empty' })
  @MinLength(1, { message: 'Display name must be at least 1 character long' })
  @MaxLength(100, { message: 'Display name must not exceed 100 characters' })
  display_name: string;
}
