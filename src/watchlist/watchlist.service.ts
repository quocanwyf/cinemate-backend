/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/watchlist/watchlist.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) {}

  // Lấy toàn bộ watchlist của một user
  async getWatchlist(userId: string) {
    const watchlist = await this.prisma.watchlist.findMany({
      where: { userId: userId },
      // Dùng `include` để lấy cả thông tin chi tiết của phim
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            poster_path: true,
            release_date: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc', // Sắp xếp theo phim mới thêm gần đây nhất
      },
    });

    // Trả về một mảng các object movie
    return watchlist.map((item) => item.movie);
  }

  // Thêm một phim vào watchlist
  async addMovieToWatchlist(userId: string, movieId: number) {
    // Kiểm tra xem phim có tồn tại không
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });
    if (!movie) {
      throw new NotFoundException(`Movie with ID ${movieId} not found.`);
    }

    // Dùng `upsert` để tránh lỗi nếu người dùng thêm lại phim đã có
    await this.prisma.watchlist.upsert({
      where: {
        userId_movieId: {
          userId: userId,
          movieId: movieId,
        },
      },
      update: {}, // Không cần cập nhật gì
      create: {
        userId: userId,
        movieId: movieId,
      },
    });

    return { message: 'Movie added to watchlist successfully.' };
  }

  // Xóa một phim khỏi watchlist
  async removeMovieFromWatchlist(userId: string, movieId: number) {
    try {
      await this.prisma.watchlist.delete({
        where: {
          userId_movieId: {
            userId: userId,
            movieId: movieId,
          },
        },
      });
      return { message: 'Movie removed from watchlist successfully.' };
    } catch (error) {
      // Bắt lỗi nếu người dùng cố xóa một phim không có trong list
      if (error.code === 'P2025') {
        // Mã lỗi của Prisma khi không tìm thấy bản ghi để xóa
        throw new NotFoundException(
          `Movie with ID ${movieId} not found in watchlist.`,
        );
      }
      throw error;
    }
  }
}
