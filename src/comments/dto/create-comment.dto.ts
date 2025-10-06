// src/comments/dto/create-comment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'The content of the comment',
    minLength: 1,
    maxLength: 1000,
    example: 'This movie was amazing!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @ApiProperty({
    description: 'The ID of the parent comment if this is a reply',
    required: false,
    example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
  })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
