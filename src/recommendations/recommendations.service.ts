import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MoviesService } from 'src/movies/movies.service';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private prisma: PrismaService,
    private moviesService: MoviesService,
  ) {}

  async getRecommendationsForUser(userId: string) {
    this.logger.log(
      `Generating V1 (Content-Based) recommendations for user: ${userId}`,
    );

    // BƯỚC 1: Xây dựng "Hồ sơ Sở thích" (User's Taste Profile)
    const highRatedMovies = await this.prisma.rating.findMany({
      where: {
        userId: userId,
        score: { gte: 4 }, // Lấy phim user đánh giá từ 4 sao trở lên
      },
      take: 20,
      orderBy: { created_at: 'desc' },
      select: { movieId: true },
    });

    // NẾU LÀ USER MỚI (KHỞI ĐẦU LẠNH) -> DÙNG LOGIC FALLBACK
    if (highRatedMovies.length < 3) {
      this.logger.log(
        `User ${userId} has < 3 high ratings. Returning popular movies as fallback.`,
      );
      return this.moviesService.getPopularMovies();
    }

    const favoriteMovieIds = highRatedMovies.map((r) => r.movieId);

    // BƯỚC 2: Tìm các thể loại yêu thích nhất
    const favoriteGenres = await this.prisma.movieGenre.findMany({
      where: { movieId: { in: favoriteMovieIds } },
      select: { genreId: true },
    });

    const genreFrequency = favoriteGenres.reduce(
      (acc, curr) => {
        acc[curr.genreId] = (acc[curr.genreId] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    const topGenreIds = Object.entries(genreFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3) // Lấy ra 3 thể loại người dùng thích nhất
      .map(([genreId]) => parseInt(genreId));

    if (topGenreIds.length === 0) {
      this.logger.log(
        `No top genres found for user ${userId}. Returning popular movies.`,
      );
      return this.moviesService.getPopularMovies();
    }

    this.logger.log(`User ${userId}'s top genres: [${topGenreIds.join(', ')}]`);

    // BƯỚC 3: Tìm ứng viên và trả về
    const candidateMovies = await this.prisma.movie.findMany({
      where: {
        genres: {
          some: { genreId: { in: topGenreIds } },
        },
        // Loại trừ những phim người dùng đã xem/đánh giá
        id: { notIn: favoriteMovieIds },
        ratings: { none: { userId: userId } },
      },
      orderBy: {
        popularity: 'desc', // Sắp xếp theo độ phổ biến
      },
      take: 20,
    });

    this.logger.log(
      `Found ${candidateMovies.length} raw recommendations. Enriching data...`,
    );

    const enrichedMovies =
      await this.moviesService.enrichAndReturnMovies(candidateMovies);

    this.logger.log('Enrichment complete. Normalizing for response.');

    return this.moviesService.normalizeMoviesForList(enrichedMovies);
  }
}
