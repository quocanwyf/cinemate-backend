/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MoviesService } from 'src/movies/movies.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private moviesService: MoviesService,
    private readonly httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.aiServiceUrl = String(
      this.configService.get<string>('AI_SERVICE_URL'),
    );
    if (!this.aiServiceUrl) {
      throw new Error('AI_SERVICE_URL is not defined');
    }
  }

  // =================================================================
  //                        HÀM CHÍNH (PUBLIC)
  // =================================================================

  async getRecommendationsForUser(userId: string) {
    this.logger.log(`Generating HYBRID recommendations for user: ${userId}`);

    // BƯỚC 1: LẤY CÁC PHIM YÊU THÍCH VÀ CÁC PHIM CHƯA XEM
    const { favoriteMovieIds, unseenMovieIds } =
      await this.getUserProfileAndUnseenMovies(userId);

    // BƯỚC 2: XỬ LÝ KHỞI ĐẦU LẠNH (COLD START)
    if (favoriteMovieIds.length < 3) {
      this.logger.log(
        `User ${userId} has < 3 high ratings. Returning popular movies as fallback.`,
      );
      return this.moviesService.getPopularMovies();
    }

    const candidateIds = unseenMovieIds.slice(0, 450);

    // BƯỚC 3: CHẠY SONG SONG CÁC HỆ THỐNG GỢI Ý
    const [svdRecs, cbfRecs] = await Promise.all([
      // Thay unseenMovieIds bằng candidateIds
      this.getSvdRecommendations(userId, candidateIds),
      this.getContentBasedRecommendations(favoriteMovieIds),
    ]);

    // BƯỚC 4: KẾT HỢP (BLEND) KẾT QUẢ
    const blendedRecs = this.blendRecommendations(svdRecs, cbfRecs);

    const finalRecommendedIds = Array.from(blendedRecs.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .slice(0, 20)
      .map(([movieId]) => movieId);

    if (finalRecommendedIds.length === 0) {
      this.logger.log(
        `No recommendations after blending for user ${userId}. Returning popular movies.`,
      );
      return this.moviesService.getPopularMovies();
    }

    // BƯỚC 5: LẤY THÔNG TIN, LÀM GIÀU DỮ LIỆU VÀ TRẢ VỀ
    const rawRecommendedMovies = await this.prisma.movie.findMany({
      where: { id: { in: finalRecommendedIds } },
    });
    const enrichedMovies =
      await this.moviesService.enrichAndReturnMovies(rawRecommendedMovies);
    const sortedMovies = enrichedMovies.sort(
      (a, b) =>
        finalRecommendedIds.indexOf(a.id) - finalRecommendedIds.indexOf(b.id),
    );

    return this.moviesService.normalizeMoviesForList(sortedMovies);
  }

  // =================================================================
  //                        CÁC HÀM TIỆN ÍCH (PRIVATE)
  // =================================================================

  private async getSvdRecommendations(
    userId: string,
    movieIds: number[],
  ): Promise<{ movieId: number; score: number }[]> {
    if (movieIds.length === 0) return [];
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/recommend/svd/batch`, {
          user_id: userId,
          movie_ids: movieIds,
        }),
      );
      return response.data.data || [];
    } catch (error) {
      this.logger.error(
        `Failed to call SVD AI service: ${error.response?.data?.detail || error.message}`,
      );
      return [];
    }
  }

  private async getContentBasedRecommendations(
    favoriteMovieIds: number[],
  ): Promise<number[]> {
    if (favoriteMovieIds.length === 0) return [];

    // Chỉ lấy tối đa 3 phim để giảm số API calls
    const selectedMovies = favoriteMovieIds.slice(0, 3);

    // Với mỗi phim user thích, gọi API content-based để lấy các phim tương tự
    const recommendationSetsPromises = selectedMovies.map((movieId) =>
      this.fetchContentBasedRecsForMovie(movieId),
    );

    const recommendationSets = await Promise.all(recommendationSetsPromises);

    // Gộp tất cả kết quả và loại bỏ trùng lặp
    const allRecs = new Set(recommendationSets.flat());
    return Array.from(allRecs);
  }

  private async fetchContentBasedRecsForMovie(
    movieId: number,
  ): Promise<number[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.aiServiceUrl}/recommend/content-based/${movieId}?top_n=10`,
        ),
      );
      return response.data.data || [];
    } catch (error) {
      this.logger.error(
        `Failed to call Content-Based AI for movie ${movieId}: ${error.message}`,
      );
      return [];
    }
  }

  private blendRecommendations(
    svdRecs: { movieId: number; score: number }[],
    cbfRecIds: number[],
  ): Map<number, number> {
    const blendedMap = new Map<number, number>();
    const SVD_WEIGHT = 0.7;
    const CBF_WEIGHT = 0.3;

    // Thêm điểm từ SVD
    svdRecs.forEach((rec) => {
      const normalizedScore = (rec.score - 1) / 4; // Chuẩn hóa thang 1-5 về 0-1
      blendedMap.set(
        rec.movieId,
        (blendedMap.get(rec.movieId) || 0) + normalizedScore * SVD_WEIGHT,
      );
    });

    // Thêm điểm từ Content-Based (dựa trên tần suất xuất hiện)
    cbfRecIds.forEach((movieId) => {
      const rankScore = 1.0 * CBF_WEIGHT; // Gán một điểm cố định cho mỗi lần xuất hiện
      blendedMap.set(movieId, (blendedMap.get(movieId) || 0) + rankScore);
    });

    return blendedMap;
  }

  private async getUserProfileAndUnseenMovies(userId: string) {
    const [ratings, watchlist, viewHistory] = await Promise.all([
      this.prisma.rating.findMany({
        where: { userId },
        select: { movieId: true, score: true },
      }),
      this.prisma.watchlist.findMany({
        where: { userId },
        select: { movieId: true },
      }),
      this.prisma.viewHistory.findMany({
        where: { userId },
        select: { movieId: true },
      }),
    ]);

    const highRatedMovies = ratings.filter((r) => r.score >= 4);
    const favoriteMovieIds = highRatedMovies.map((r) => r.movieId);

    const seenOrKnownMovieIds = new Set([
      ...ratings.map((r) => r.movieId),
      ...watchlist.map((w) => w.movieId),
      ...viewHistory.map((v) => v.movieId),
    ]);

    const allMoviesInDb = await this.prisma.movie.findMany({
      select: { id: true },
      orderBy: { popularity: 'desc' },
    });
    const unseenMovieIds = allMoviesInDb
      .map((m) => m.id)
      .filter((id) => !seenOrKnownMovieIds.has(id));

    return { favoriteMovieIds, unseenMovieIds };
  }
}
