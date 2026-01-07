import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsHelper } from './notifications.helper';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FcmModule } from 'src/fcm/fcm.module';

@Module({
  imports: [PrismaModule, FcmModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsHelper],
  exports: [NotificationsService, NotificationsHelper], // Để các module khác dùng
})
export class NotificationsModule {}
