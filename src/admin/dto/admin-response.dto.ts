// src/admin/dto/admin-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class AdminResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the admin',
    example: 'a3f1c2b0-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
    type: String,
    format: 'uuid',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@example.com',
    type: String,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Full name of the admin (nullable)',
    example: 'Nguyen Van A',
    type: String,
    nullable: true,
    required: false,
  })
  @IsString()
  full_name: string | null;
}
