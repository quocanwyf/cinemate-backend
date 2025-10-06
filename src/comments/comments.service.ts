/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/comments/comments.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  // Lấy tất cả bình luận của một phim (dạng cây)
  async getCommentsByMovie(movieId: number) {
    // Lấy tất cả bình luận của phim
    const comments = await this.prisma.comment.findMany({
      where: { movieId: movieId, is_deleted: false }, // Chỉ lấy comment chưa bị xóa
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
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    comments.forEach((comment) => {
      if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
        commentMap
          .get(comment.parentCommentId)
          .replies.push(commentMap.get(comment.id));
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
}
