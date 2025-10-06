import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  // Tạo hoặc cập nhật một đánh giá
  async upsertRating(
    userId: string,
    movieId: number,
    createRatingDto: CreateRatingDto,
  ) {
    const { score } = createRatingDto;

    // Kiểm tra xem phim có tồn tại không
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });
    if (!movie) {
      throw new NotFoundException(`Movie with ID ${movieId} not found.`);
    }

    // Dùng `upsert` để xử lý cả hai trường hợp:
    // 1. Nếu user chưa từng rate phim này -> tạo mới (create)
    // 2. Nếu user đã rate rồi -> cập nhật lại điểm (update)
    const rating = await this.prisma.rating.upsert({
      where: {
        userId_movieId: {
          userId: userId,
          movieId: movieId,
        },
      },
      update: {
        score: score,
      },
      create: {
        userId: userId,
        movieId: movieId,
        score: score,
      },
    });

    return rating;
  }

  // (Có thể thêm các hàm khác sau này, ví dụ: lấy rating của một user cho một phim)
}
