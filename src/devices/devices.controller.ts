/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DeviceTokenService } from './device-token.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private deviceTokenService: DeviceTokenService) {}

  @Post('register')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async register(@Body() dto: RegisterDeviceDto, @Request() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const token = await this.deviceTokenService.registerToken(
      userId,
      dto.token,
      dto.platform,
      dto.deviceId,
    );
    return { success: true, tokenId: token.id };
  }
}
