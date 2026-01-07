/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FcmService } from 'src/fcm/fcm.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private fcmService: FcmService,
  ) {}

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

  /**
   * Tạo notification khi có sự kiện (reply comment, mention...)
   */
  async createNotification(data: {
    userId: string; // người nhận thông báo
    type: NotificationType;
    title: string;
    body?: string;
    actorId?: string; // user trigger (người reply comment)
    sourceId?: string; // commentId
    movieId?: number;
    data?: any; // deeplink, metadata
  }) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          actorId: data.actorId,
          sourceId: data.sourceId,
          movieId: data.movieId,
          data: data.data,
          is_read: false,
          is_sent: false,
        },
      });

      // 🚀 TRIGGER PUSH NOTIFICATION
      await this.sendPushToUser(data.userId, notification);

      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gửi push notification tới user
   */
  private async sendPushToUser(userId: string, notification: any) {
    try {
      // Lấy device tokens của user
      const deviceTokens = await this.prisma.deviceToken.findMany({
        where: { userId, is_active: true },
        select: { token: true },
      });

      if (deviceTokens.length === 0) {
        this.logger.warn(`No active device tokens for user: ${userId}`);
        return;
      }

      // Gửi push notification
      const tokens = deviceTokens.map((d) => d.token);
      const title = String(notification.title || '');
      const body = String(notification.body || '');
      const notificationId = String(notification.id || '');
      const deeplink = String(notification.data?.deeplink || '');

      const successCount = await this.fcmService.sendMulticastNotification(
        tokens,
        title,
        body,
        {
          notificationId,
          deeplink,
        },
      );

      // Mark as sent
      if (successCount > 0) {
        await this.markAsSent(notificationId);
      }
    } catch (error) {
      this.logger.warn(`Failed to send push: ${error.message}`);
      // Không throw - notification vẫn được lưu
    }
  }

  /**
   * Bulk create notifications
   */
  async createNotificationsBulk(
    items: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      body?: string;
      actorId?: string;
      sourceId?: string;
      movieId?: number;
      data?: any;
    }>,
  ) {
    try {
      const notifications = await this.prisma.notification.createMany({
        data: items,
        skipDuplicates: false,
      });
      return notifications;
    } catch (error) {
      this.logger.error(
        `Failed to bulk create notifications: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Mark notification as sent (after FCM push)
   */
  async markAsSent(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        is_sent: true,
        sent_at: new Date(),
      },
    });
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotificationsForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, is_read: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}
