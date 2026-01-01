import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'fcm_device_token_here' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'android' })
  @IsString()
  @IsIn(['android', 'ios', 'web'])
  platform: 'android' | 'ios' | 'web';

  @ApiProperty({ example: 'device-id-optional', required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
