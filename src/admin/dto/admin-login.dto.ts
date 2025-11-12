// src/admin/dto/admin-login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Email của admin',
    example: 'admin@cinemate.app',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mật khẩu admin (tối thiểu 6 ký tự)',
    minLength: 6,
    example: 'AdminPassword123',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
