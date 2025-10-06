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
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  // Lấy tất cả bình luận của một phim (dạng cây)
  async getCommentsByMovie(movieId: number) {
    // Lấy tất cả bình luận của phim
    const comments = await this.prisma.comment.findMany({
      where: { movieId: movieId }, // Chỉ lấy comment chưa bị xóa
      include: {
        // Lấy thông tin người đăng
        user: {
          select: {
            id: true,
            display_name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Sắp xếp theo thời gian cũ nhất -> mới nhất
      },
    });

    // Xây dựng cấu trúc cây cho các bình luận trả lời
    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];

    comments.forEach((comment) => {
      // Nếu comment đã bị xóa, chúng ta chỉ giữ lại những thông tin cần thiết
      // để duy trì cấu trúc cây
      if (comment.is_deleted) {
        commentMap.set(comment.id, {
          id: comment.id,
          content: comment.content,
          is_deleted: true,
          parentCommentId: comment.parentCommentId,
          replies: [],
          // Các trường khác sẽ là undefined
        });
      } else {
        commentMap.set(comment.id, { ...comment, replies: [] });
      }
    });

    comments.forEach((comment) => {
      if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
        const parentInMap = commentMap.get(comment.parentCommentId);
        if (parentInMap) {
          parentInMap.replies.push(commentMap.get(comment.id));
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    return rootComments;
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
