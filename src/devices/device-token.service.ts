/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DeviceTokenService {
  private logger = new Logger(DeviceTokenService.name);
  constructor(private prisma: PrismaService) {}

  // Upsert token: if exists update userId/platform/is_active, else create
  async registerToken(
    userId: string,
    token: string,
    platform: string,
    deviceId?: string,
  ) {
    // Deactivate any record that had same token but different user (optional)
    // Use upsert by unique token
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId,
        platform,
        is_active: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        is_active: true,
      },
    });
  }

  async deactivateToken(token: string) {
    return this.prisma.deviceToken.updateMany({
      where: { token },
      data: { is_active: false },
    });
  }

  async getActiveTokensForUser(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId, is_active: true },
    });
  }
}
