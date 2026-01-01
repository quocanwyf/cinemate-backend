/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  prisma: any;
  async listNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where: any = { userId };
    if (unreadOnly) where.is_read = false;

    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          type: true,
          actorId: true,
          sourceId: true,
          movieId: true,
          title: true,
          body: true,
          data: true,
          is_read: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, is_read: false },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    // Ensure only recipient can mark
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { is_read: true },
    });
    return updated.count > 0;
  }

  async markManyAsRead(userId: string, ids: string[]) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { is_read: true },
    });
    return updated.count;
  }
}
