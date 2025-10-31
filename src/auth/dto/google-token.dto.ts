// src/auth/dto/google-token.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleTokenDto {
  @ApiProperty({
    description: 'Google ID token obtained from client-side Google Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjM...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
