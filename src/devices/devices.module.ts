import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DeviceTokenService } from './device-token.service';
import { DevicesController } from './devices.controller';

@Module({
  imports: [PrismaModule],
  providers: [DeviceTokenService],
  controllers: [DevicesController],
  exports: [DeviceTokenService],
})
export class DevicesModule {}
