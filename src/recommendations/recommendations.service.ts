/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/recommendations/recommendations.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MoviesService } from 'src/movies/movies.service';
import { HttpService } from '@nestjs/axios'; // Import HttpService
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private moviesService: MoviesService,
    private readonly httpService: HttpService, // Inject HttpService
    private configService: ConfigService, // Inject ConfigService
  ) {
    // Lấy URL của dịch vụ AI từ biến môi trường
    this.aiServiceUrl = String(
      this.configService.get<string>('AI_SERVICE_URL'),
    );
    if (!this.aiServiceUrl) {
      throw new Error('AI_SERVICE_URL is not defined');
    }
  }

  // Hàm gọi đến dịch vụ AI (SVD)
  private async getSvdRecommendations(
    userId: string,
    movieIds: number[],
  ): Promise<{ movieId: number; score: number }[]> {
    if (movieIds.length === 0) return [];

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/recommend/svd`, {
          user_id: userId,
          movie_ids: movieIds,
        }),
      );
      return response.data.data || [];
    } catch (error) {
      this.logger.error(
        `Failed to call AI service: ${error.response?.data?.detail || error.message}`,
      );
      return []; // Trả về mảng rỗng nếu dịch vụ AI lỗi, không làm sập toàn bộ request
    }
  }

  // HÀM CHÍNH: GET RECOMMENDATIONS
  async getRecommendationsForUser(userId: string) {
    this.logger.log(`Generating HYBRID recommendations for user: ${userId}`);

    // (Chúng ta sẽ implement logic Hybrid sau, giờ chỉ test SVD)

    // 1. Lấy danh sách phim người dùng chưa xem
    const unseenMovieIds = await this.getUnseenMovieIdsForUser(userId);

    // 2. Gọi dịch vụ AI để SVD chấm điểm các phim chưa xem này
    const svdRecs = await this.getSvdRecommendations(userId, unseenMovieIds);

    // 3. Lọc ra top 20 ID từ kết quả SVD
    const topSvdMovieIds = svdRecs.slice(0, 20).map((rec) => rec.movieId);

    if (topSvdMovieIds.length === 0) {
      this.logger.log(
        'No SVD recommendations found, returning popular movies.',
      );
      return this.moviesService.getPopularMovies();
    }

    // 4. Lấy thông tin chi tiết của các phim đó từ DB của chúng ta
    const recommendedMovies = await this.prisma.movie.findMany({
      where: {
        id: { in: topSvdMovieIds },
      },
    });

    // Sắp xếp lại kết quả theo đúng thứ tự của SVD
    const sortedMovies = recommendedMovies.sort(
      (a, b) => topSvdMovieIds.indexOf(a.id) - topSvdMovieIds.indexOf(b.id),
    );

    return this.moviesService.normalizeMoviesForList(sortedMovies);
  }

  // Hàm tiện ích để lấy các phim user chưa xem
  private async getUnseenMovieIdsForUser(userId: string): Promise<number[]> {
    const ratedMovies = await this.prisma.rating.findMany({
      where: { userId },
      select: { movieId: true },
    });
    const ratedMovieIds = new Set(ratedMovies.map((r) => r.movieId));

    // Chỉ lấy những phim có trong bộ trainset của model (để đảm bảo SVD có thể dự đoán)
    // Trong thực tế, có thể lấy tất cả và AI service sẽ tự lọc
    const allMoviesInDb = await this.prisma.movie.findMany({
      select: { id: true },
    });

    return allMoviesInDb
      .map((m) => m.id)
      .filter((id) => !ratedMovieIds.has(id));
  }
}
