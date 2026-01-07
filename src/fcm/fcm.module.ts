import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';

@Module({
  providers: [FcmService],
  exports: [FcmService], // Export để các module khác dùng
})
export class FcmModule {}
