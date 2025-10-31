// src/admin/dto/update-user-status.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'Trạng thái active của user', example: true })
  @IsBoolean()
  isActive: boolean;
}
