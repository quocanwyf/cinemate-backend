// src/movies/movies.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config'; // Import ConfigService

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbApiKey: string;

  constructor(
    private prisma: PrismaService,
    private readonly httpService: HttpService,
    private configService: ConfigService, // Inject ConfigService
  ) {
    // Lấy TMDB API Key từ biến môi trường
    this.tmdbApiKey = String(this.configService.get<string>('TMDB_API_KEY'));
  }

  async getPopularMovies() {
    // 1. Lấy dữ liệu thô từ DB
    const moviesFromDb = await this.prisma.movie.findMany({
      orderBy: {
        // Tạm thời sort theo title vì chưa có popularity
        title: 'asc',
      },
      take: 20,
    });

    // 2. Bắt đầu quá trình "làm giàu" dữ liệu mà không block response
    this.enrichMoviesData(moviesFromDb.map((m) => m.id));

    // 3. Trả về ngay lập tức dữ liệu hiện có
    return moviesFromDb;
  }

  // Hàm chạy nền để cập nhật dữ liệu
  private async enrichMoviesData(movieIds: number[]): Promise<void> {
    this.logger.log(
      `Starting data enrichment for ${movieIds.length} movies...`,
    );
    for (const movieId of movieIds) {
      try {
        // Kiểm tra xem phim đã có đủ dữ liệu chưa
        const movieInDb = await this.prisma.movie.findUnique({
          where: { id: movieId },
          select: { poster_path: true, overview: true },
        });

        // Nếu chưa có poster hoặc overview, thì mới gọi API
        if (!movieInDb || !movieInDb.poster_path || !movieInDb.overview) {
          this.logger.log(`Fetching details for movie ID: ${movieId}`);
          const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${this.tmdbApiKey}`;
          const response = await firstValueFrom(this.httpService.get(url));
          const movieDetails = response.data;

          // Cập nhật lại bản ghi trong DB
          await this.prisma.movie.update({
            where: { id: movieId },
            data: {
              overview: movieDetails.overview,
              poster_path: movieDetails.poster_path,
              popularity: movieDetails.popularity,
              vote_average: movieDetails.vote_average,
              vote_count: movieDetails.vote_count,
            },
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch or update movie ID ${movieId}: ${error.message}`,
        );
      }
    }
    this.logger.log('Data enrichment process finished.');
  }
}
