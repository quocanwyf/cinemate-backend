/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/comments/comments.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsHelper } from 'src/notifications/notifications.helper';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  private logger = new Logger(CommentsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsHelper: NotificationsHelper,
  ) {}

  // Lấy tất cả bình luận của một phim (dạng cây)
  //  method getCommentsByMovie hiện tại
  async getCommentsByMovie(
    movieId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // STEP 1: Lấy root comments với pagination
    const rootComments = await this.prisma.comment.findMany({
      where: {
        movieId: movieId,
        parentCommentId: null, // Chỉ lấy root comments
        is_deleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            avatar_url: true,
          },
        },
        _count: {
          select: {
            replies: {
              where: { is_deleted: false },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Mới nhất trước
      skip,
      take: limit,
    });

    // STEP 2: Load 3 replies preview cho mỗi root comment
    const commentsWithPreviews = await Promise.all(
      rootComments.map(async (rootComment) => {
        const previewReplies = await this.prisma.comment.findMany({
          where: {
            parentCommentId: rootComment.id,
            is_deleted: false,
          },
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                avatar_url: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' }, // Replies cũ trước
          take: 3, // ⭐ CHỈ LẤY 3 REPLIES ĐẦU
        });

        return {
          ...rootComment,
          replies: previewReplies,
          repliesMetadata: {
            totalReplies: rootComment._count.replies,
            previewCount: previewReplies.length,
            hasMoreReplies: rootComment._count.replies > 3,
            hiddenCount: Math.max(0, rootComment._count.replies - 3),
          },
        };
      }),
    );

    // STEP 3: Pagination metadata
    const totalRootComments = await this.prisma.comment.count({
      where: {
        movieId: movieId,
        parentCommentId: null,
        is_deleted: false,
      },
    });

    return {
      comments: commentsWithPreviews,
      pagination: {
        page,
        limit,
        total: totalRootComments,
        totalPages: Math.ceil(totalRootComments / limit),
        hasNext: page < Math.ceil(totalRootComments / limit),
        hasPrev: page > 1,
      },
    };
  }

  //  method mới cho load more replies
  async getRepliesByComment(
    commentId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const replies = await this.prisma.comment.findMany({
      where: {
        parentCommentId: commentId,
        is_deleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    const totalReplies = await this.prisma.comment.count({
      where: {
        parentCommentId: commentId,
        is_deleted: false,
      },
    });

    return {
      replies,
      pagination: {
        page,
        limit,
        total: totalReplies,
        totalPages: Math.ceil(totalReplies / limit),
        hasNext: page < Math.ceil(totalReplies / limit),
        hasPrev: page > 1,
      },
    };
  }

  // Tạo một bình luận mới
  async createComment(
    userId: string,
    movieId: number,
    createCommentDto: CreateCommentDto,
  ) {
    const { content, parentCommentId } = createCommentDto;

    // Kiểm tra xem phim có tồn tại không
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });
    if (!movie) {
      throw new NotFoundException(`Movie with ID ${movieId} not found.`);
    }

    // Nếu là một reply, kiểm tra xem comment cha có tồn tại không
    if (parentCommentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentCommentId },
      });
      if (!parentComment || parentComment.movieId !== movieId) {
        throw new NotFoundException(
          `Parent comment with ID ${parentCommentId} not found for this movie.`,
        );
      }
    }

    const newComment = await this.prisma.comment.create({
      data: {
        content,
        userId,
        movieId,
        parentCommentId,
      },
      include: {
        // Trả về thông tin user kèm theo
        user: {
          select: {
            id: true,
            display_name: true,
            avatar_url: true,
          },
        },
      },
    });

    // Trigger notification nếu là reply comment
    if (parentCommentId && newComment.id) {
      try {
        await this.notificationsHelper.notifyCommentReply(
          parentCommentId,
          newComment.id,
          userId,
          movieId,
        );
      } catch (error) {
        this.logger.warn(`Failed to send notification: ${error.message}`);
        // Không throw - comment vẫn được tạo
      }
    }

    return newComment;
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You are not allowed to edit this comment');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this comment',
      );
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        is_deleted: true,
        content: '[This comment has been deleted]', // Thay thế nội dung
      },
    });

    return { message: 'Comment deleted successfully' };
  }
}
