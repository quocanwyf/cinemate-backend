import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Movie } from '@prisma/client';
import { MovieDetailDto } from './dto/movie-detail.dto';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbApiKey: string;

  constructor(
    private prisma: PrismaService,
    private readonly httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.tmdbApiKey = String(this.configService.get<string>('TMDB_API_KEY'));
    if (!this.tmdbApiKey) {
      throw new Error('TMDB_API_KEY is not defined in environment variables');
    }
  }

  // =================================================================
  //                        PUBLIC API METHODS
  // =================================================================

  async getPopularMovies() {
    const movies = await this.prisma.movie.findMany({
      orderBy: { popularity: 'desc' },
      where: { popularity: { not: null } },
      take: 20,
    });

    const enrichedMovies = await this.enrichAndReturnMovies(movies);
    return this.normalizeMoviesForList(enrichedMovies);
  }

  async getTopRatedMovies() {
    const movies = await this.prisma.movie.findMany({
      orderBy: { vote_average: 'desc' },
      where: {
        vote_count: { gte: 100 },
        vote_average: { not: null },
      },
      take: 20,
    });

    const enrichedMovies = await this.enrichAndReturnMovies(movies);
    return this.normalizeMoviesForList(enrichedMovies);
  }

  async searchMovies(query: string) {
    // Lấy dữ liệu đầy đủ từ database
    const movies = await this.prisma.movie.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 20,
    });

    // Làm giàu dữ liệu nếu cần
    const enrichedMovies = await this.enrichAndReturnMovies(movies);

    // Trả về dữ liệu đã chuẩn hóa
    return this.normalizeMoviesForList(enrichedMovies);
  }

  async getMovieById(movieId: number) {
    // BƯỚC 1: Gọi TMDB API để lấy dữ liệu mới nhất
    const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${this.tmdbApiKey}&language=en-US`;
    let movieDetails;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      movieDetails = response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException(`Movie with ID ${movieId} not found.`);
      }
      throw error;
    }

    // BƯỚC 2: Upsert dữ liệu vào database
    await this.prisma.movie.upsert({
      where: { id: movieId },
      update: {
        title: movieDetails.title,
        overview: movieDetails.overview,
        poster_path: movieDetails.poster_path,
        release_date: movieDetails.release_date
          ? new Date(movieDetails.release_date)
          : null,
        popularity: movieDetails.popularity,
        vote_average: movieDetails.vote_average,
        vote_count: movieDetails.vote_count,
      },
      create: {
        id: movieDetails.id,
        title: movieDetails.title,
        overview: movieDetails.overview,
        poster_path: movieDetails.poster_path,
        release_date: movieDetails.release_date
          ? new Date(movieDetails.release_date)
          : null,
        popularity: movieDetails.popularity,
        vote_average: movieDetails.vote_average,
        vote_count: movieDetails.vote_count,
      },
    });

    // BƯỚC 4: Trả về dữ liệu đã format
    const result: MovieDetailDto = {
      id: movieDetails.id,
      title: movieDetails.title,
      overview: movieDetails.overview,
      poster_path: movieDetails.poster_path,
      backdrop_path: movieDetails.backdrop_path,
      release_date: movieDetails.release_date,
      vote_average: movieDetails.vote_average
        ? movieDetails.vote_average / 2
        : 0,
      genres: movieDetails.genres,
    };

    return result;
  }

  // =================================================================
  //                        PRIVATE HELPER METHODS
  // =================================================================

  /**
   * Chuẩn hóa dữ liệu phim cho các API danh sách (chia điểm cho 2).
   */
  private normalizeMoviesForList(movies: Movie[]) {
    return movies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average ? movie.vote_average / 2 : null,
    }));
  }

  /**
   * Làm giàu dữ liệu cho danh sách phim
   */
  private async enrichAndReturnMovies(movies: Movie[]): Promise<Movie[]> {
    const moviesToEnrich = movies.filter((movie) => movie.popularity === null);

    if (moviesToEnrich.length === 0) {
      return movies;
    }

    this.logger.log(`Enriching data for ${moviesToEnrich.length} movies...`);

    // Xử lý song song với error handling
    const enrichmentPromises = moviesToEnrich.map((movie) =>
      this.fetchAndUpdateMovie(movie.id).catch((err) => {
        this.logger.error(`Error enriching movie ${movie.id}: ${err.message}`);
        return null;
      }),
    );

    await Promise.all(enrichmentPromises);

    this.logger.log('Enrichment complete. Refetching data from DB...');

    // Lấy lại dữ liệu đã cập nhật
    const movieIds = movies.map((m) => m.id);
    const freshMovies = await this.prisma.movie.findMany({
      where: {
        id: { in: movieIds },
      },
    });

    return freshMovies;
  }

  /**
   * Lấy và cập nhật thông tin phim từ TMDB
   */
  private async fetchAndUpdateMovie(movieId: number): Promise<void> {
    try {
      const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${this.tmdbApiKey}&language=en-US`;
      const response = await firstValueFrom(this.httpService.get(url));
      const movieDetails = response.data;

      await this.prisma.movie.update({
        where: { id: movieId },
        data: {
          overview: movieDetails.overview || '',
          poster_path: movieDetails.poster_path,
          popularity: movieDetails.popularity ?? 0,
          vote_average: movieDetails.vote_average ?? 0,
          vote_count: movieDetails.vote_count ?? 0,
        },
      });
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(
          `Movie ID ${movieId} not found on TMDB. Cleaning up from local DB.`,
        );
        await this.cleanupMovieFromDB(movieId);
      } else {
        this.logger.error(
          `Failed to fetch/update movie ID ${movieId}. Marking as error.`,
        );
        await this.prisma.movie.update({
          where: { id: movieId },
          data: { popularity: -1 },
        });
      }
    }
  }

  /**
   * Xóa phim và tất cả dữ liệu liên quan khỏi database
   */
  private async cleanupMovieFromDB(movieId: number): Promise<void> {
    try {
      // Xóa theo thứ tự: bảng con trước, bảng cha sau
      await this.prisma.movieGenre.deleteMany({
        where: { movieId: movieId },
      });
      await this.prisma.watchlist.deleteMany({
        where: { movieId: movieId },
      });
      await this.prisma.rating.deleteMany({
        where: { movieId: movieId },
      });
      await this.prisma.comment.deleteMany({
        where: { movieId: movieId },
      });
      await this.prisma.featuredListMovie.deleteMany({
        where: { movieId: movieId },
      });
      await this.prisma.movie.delete({
        where: { id: movieId },
      });

      this.logger.log(
        `Successfully cleaned up movie ID ${movieId} from database`,
      );
    } catch (cleanupError) {
      this.logger.error(
        `Failed to cleanup movie ID ${movieId}: ${cleanupError.message}`,
      );
    }
  }
}
