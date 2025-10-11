/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// src/tracking/tracking.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  async recordView(userId: string, movieId: number) {
    // Dùng upsert để tạo mới hoặc cập nhật thời gian xem
    await this.prisma.viewHistory.upsert({
      where: {
        userId_movieId: {
          userId: userId,
          movieId: movieId,
        },
      },
      update: {
        viewed_at: new Date(),
      },
      create: {
        userId: userId,
        movieId: movieId,
      },
    });
    return { message: 'View recorded' };
  }
}
