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
      `Starting data validation & enrichment for ${movieIds.length} movies...`,
    );

    for (const movieId of movieIds) {
      try {
        const movieInDb = await this.prisma.movie.findUnique({
          where: { id: movieId },
          select: { poster_path: true, overview: true },
        });

        // Chỉ gọi API nếu phim còn thiếu dữ liệu
        if (!movieInDb || !movieInDb.poster_path || !movieInDb.overview) {
          this.logger.log(`Fetching details for movie ID: ${movieId}`);
          const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${this.tmdbApiKey}`;

          const response = await firstValueFrom(this.httpService.get(url));
          const movieDetails = response.data;

          await this.prisma.movie.update({
            where: { id: movieId },
            data: {
              overview: movieDetails.overview,
              poster_path: movieDetails.poster_path,
              popularity: movieDetails.popularity,
              vote_average: movieDetails.vote_average,
              vote_count: movieDetails.vote_count,
              // Có thể cập nhật thêm các trường khác nếu muốn
              title: movieDetails.title,
              release_date: movieDetails.release_date
                ? new Date(movieDetails.release_date)
                : null,
            },
          });
        }
      } catch (error) {
        // Xử lý lỗi một cách cụ thể hơn
        if (error.response && error.response.status === 404) {
          // Nếu lỗi là 404, có nghĩa là phim này không tồn tại trên TMDB
          this.logger.warn(
            `Movie ID ${movieId} not found on TMDB. Deleting from local DB.`,
          );

          // Xóa các bản ghi phụ thuộc trước
          await this.prisma.movieGenre.deleteMany({
            where: { movieId: movieId },
          });
          await this.prisma.watchlist.deleteMany({
            where: { movieId: movieId },
          });
          await this.prisma.rating.deleteMany({ where: { movieId: movieId } });
          await this.prisma.comment.deleteMany({ where: { movieId: movieId } });
          // ... (thêm các bảng phụ thuộc khác nếu có)

          // Sau đó xóa bản ghi phim gốc
          await this.prisma.movie.delete({ where: { id: movieId } });
        } else {
          // Đối với các lỗi khác (lỗi mạng, hết rate limit...), chỉ ghi log
          this.logger.error(
            `Failed to fetch/update movie ID ${movieId}: ${error.message}`,
          );
        }
      }
    }
    this.logger.log('Data enrichment process finished.');
  }
}
