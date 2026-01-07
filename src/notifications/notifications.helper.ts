/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationType } from '@prisma/client';

/**
 * Helper service để tạo notification cho các sự kiện khác nhau
 * Được sử dụng bởi các module khác (comments, ratings, etc.)
 */
@Injectable()
export class NotificationsHelper {
  private logger = new Logger(NotificationsHelper.name);

  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  /**
   * Tạo thông báo khi có người reply comment
   * @param parentCommentId - Comment ID của comment cha
   * @param replyCommentId - Comment ID của reply mới
   * @param replierUserId - User ID của người reply
   * @param movieId - Movie ID
   */
  async notifyCommentReply(
    parentCommentId: string,
    replyCommentId: string,
    replierUserId: string,
    movieId: number,
  ) {
    try {
      // Lấy thông tin comment cha (người chủ comment gốc)
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentCommentId },
        include: {
          user: { select: { display_name: true } },
        },
      });

      if (!parentComment) {
        this.logger.warn(`Parent comment not found: ${parentCommentId}`);
        return;
      }

      // Nếu người reply là chính người tạo comment gốc, không gửi thông báo
      if (parentComment.userId === replierUserId) {
        return;
      }

      // Lấy thông tin người reply
      const replier = await this.prisma.user.findUnique({
        where: { id: replierUserId },
        select: { display_name: true },
      });

      const title = `${replier?.display_name || 'Người dùng'} đã trả lời bình luận của bạn`;
      const body = `Trên phim: ...`; // Có thể lấy tên phim nếu cần

      // Tạo notification
      await this.notificationsService.createNotification({
        userId: parentComment.userId, // Người sẽ nhận thông báo
        type: NotificationType.COMMENT_REPLY,
        title,
        body,
        actorId: replierUserId, // Người reply
        sourceId: replyCommentId, // Comment reply ID
        movieId,
        data: {
          deeplink: `movie/${movieId}/comments/${parentCommentId}`,
          commentId: parentCommentId,
          replyCommentId,
          type: 'COMMENT_REPLY',
        },
      });

      this.logger.log(
        `Notification created for comment reply: ${replyCommentId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to notify comment reply: ${error.message}`);
      // Không throw - notification fail không nên block main flow
    }
  }

  /**
   * Tạo thông báo khi có người mention
   */
  async notifyMention(
    mentionedUserId: string,
    mentionerUserId: string,
    sourceId: string, // commentId hoặc messageId
    movieId?: number,
  ) {
    try {
      const mentioner = await this.prisma.user.findUnique({
        where: { id: mentionerUserId },
        select: { display_name: true },
      });

      const title = `${mentioner?.display_name || 'Người dùng'} đã mention bạn`;

      await this.notificationsService.createNotification({
        userId: mentionedUserId,
        type: NotificationType.MENTION,
        title,
        actorId: mentionerUserId,
        sourceId,
        movieId,
        data: {
          type: 'MENTION',
          sourceId,
        },
      });

      this.logger.log(
        `Mention notification created for user: ${mentionedUserId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to notify mention: ${error.message}`);
    }
  }

  /**
   * Bulk create notifications
   */
  async notifyMultipleUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    body?: string,
    data?: any,
  ) {
    try {
      const notifications = userIds.map((userId) => ({
        userId,
        type,
        title,
        body,
        data,
      }));

      await this.notificationsService.createNotificationsBulk(notifications);
      this.logger.log(`Bulk notifications created for ${userIds.length} users`);
    } catch (error) {
      this.logger.error(
        `Failed to create bulk notifications: ${error.message}`,
      );
    }
  }
}
