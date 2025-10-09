/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Movie, MovieGenre, Genre } from '@prisma/client';
import { MovieDetailDto } from './dto/movie-detail.dto';

// const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// type MovieWithGenres = Movie & {
//   genres: (MovieGenre & { genre: Genre })[];
// };

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbApiKey: string;
  private readonly CACHE_TTL_HOURS = 24; // Dữ liệu được coi là "tươi" trong 24 giờ

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
    const movies = await this.prisma.movie.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 20,
    });
    const enrichedMovies = await this.enrichAndReturnMovies(movies);

    // Trả về dữ liệu đã chuẩn hóa, bao gồm cả release_date
    return enrichedMovies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average ? movie.vote_average / 2 : null,
    }));
  }

  async getMovieById(movieId: number): Promise<MovieDetailDto> {
    const movieFromDb = await this.prisma.movie.findUnique({
      where: { id: movieId },
      include: { genres: { include: { genre: true } } },
    });

    const isCacheStale =
      !movieFromDb ||
      !movieFromDb.cached_at ||
      new Date().getTime() - movieFromDb.cached_at.getTime() >
        this.CACHE_TTL_HOURS * 60 * 60 * 1000;

    if (isCacheStale) {
      this.logger.log(
        `Cache stale or not found for movie ${movieId}. Fetching from TMDB.`,
      );
      try {
        const freshData = await this.fetchAndSyncMovie(movieId);
        return this.mapToMovieDetailDto(
          freshData.movieDetails,
          freshData.movieVideos,
        );
      } catch (error) {
        if (movieFromDb) {
          this.logger.warn(
            `TMDB fetch failed for movie ${movieId}. Serving stale data from DB.`,
          );
          // Fallback: Nếu fetch lỗi nhưng có dữ liệu cũ, vẫn phục vụ dữ liệu cũ
          return this.mapToMovieDetailDto(movieFromDb, []); // Không có video trong cache
        }
        // Nếu fetch lỗi và không có cache, lúc này mới báo lỗi
        throw error;
      }
    }

    this.logger.log(`Serving movie ${movieId} from cache.`);
    // Dữ liệu cache không có video, nên ta fetch riêng video
    const movieVideos = await this.fetchMovieVideosFromTMDB(movieId);
    return this.mapToMovieDetailDto(movieFromDb, movieVideos);
  }

  private async fetchAndSyncMovie(movieId: number) {
    const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${this.tmdbApiKey}&language=en-US`;
    const videosUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${this.tmdbApiKey}&language=en-US`;

    try {
      const [detailsResponse, videosResponse] = await Promise.all([
        firstValueFrom(this.httpService.get(detailsUrl)),
        firstValueFrom(this.httpService.get(videosUrl)),
      ]);

      const movieDetails = detailsResponse.data;
      const movieVideos = videosResponse.data.results;

      const movieData = {
        title: movieDetails.title,
        overview: movieDetails.overview,
        poster_path: movieDetails.poster_path,
        release_date: movieDetails.release_date
          ? new Date(movieDetails.release_date)
          : null,
        popularity: movieDetails.popularity,
        vote_average: movieDetails.vote_average,
        vote_count: movieDetails.vote_count,
        cached_at: new Date(), // Cập nhật lại thời gian cache
      };

      await this.prisma.movie.upsert({
        where: { id: movieId },
        update: movieData,
        create: { id: movieId, ...movieData },
      });
      this.logger.log(`Upserted movie ID ${movieId} to local DB.`);

      return { movieDetails, movieVideos };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException(
          `Movie with ID ${movieId} not found on TMDB.`,
        );
      }
      this.logger.error(
        `Failed to fetch from TMDB for movie ${movieId}: ${error.message}`,
      );
      throw error; // Ném lỗi để hàm gọi có thể xử lý fallback
    }
  }

  private mapToMovieDetailDto(
    movieData: any,
    videoData: any[],
  ): MovieDetailDto {
    return {
      id: movieData.id,
      title: movieData.title,
      overview: movieData.overview,
      poster_path: movieData.poster_path,
      backdrop_path: movieData.backdrop_path, // Lấy từ TMDB hoặc sẽ là null/undefined
      release_date:
        movieData.release_date?.toISOString() || movieData.release_date,
      vote_average: movieData.vote_average ? movieData.vote_average / 2 : 0,
      genres: movieData.genres?.map((g) => ({ id: g.id, name: g.name })) || [],
      videos: videoData.filter(
        (v) =>
          v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
      ),
    };
  }

  private async fetchMovieVideosFromTMDB(movieId: number): Promise<any[]> {
    try {
      const videosUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${this.tmdbApiKey}&language=en-US`;
      const response = await firstValueFrom(this.httpService.get(videosUrl));
      return response.data.results;
    } catch {
      return []; // Nếu lỗi, trả về mảng rỗng
    }
  }
  // =================================================================
  //                        PRIVATE HELPER METHODS
  // =================================================================

  delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  public normalizeMoviesForList(movies: Movie[]) {
    return movies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average ? movie.vote_average / 2 : null,
    }));
  }

  public async enrichAndReturnMovies(movies: Movie[]): Promise<Movie[]> {
    const moviesToEnrich = movies.filter((movie) => movie.popularity === null);
    if (moviesToEnrich.length === 0) {
      return movies;
    }
    this.logger.log(
      `Queueing ${moviesToEnrich.length} movies for data enrichment...`,
    );
    const chunkSize = 10; // Xử lý 10 phim mỗi lần
    for (let i = 0; i < moviesToEnrich.length; i += chunkSize) {
      const chunk = moviesToEnrich.slice(i, i + chunkSize);
      this.logger.log(
        `Processing chunk ${i / chunkSize + 1}/${Math.ceil(moviesToEnrich.length / chunkSize)}...`,
      );

      const enrichmentPromises = chunk.map((movie) =>
        this.fetchAndUpdateMovie(movie.id).catch((err) => {
          this.logger.error(
            `Error in chunk processing for movie ${movie.id}: ${err.message}`,
          );
          return null;
        }),
      );

      await Promise.all(enrichmentPromises);

      // Thêm một khoảng nghỉ 500ms giữa mỗi chùm để tránh spam API
      if (i + chunkSize < moviesToEnrich.length) {
        await this.delay(500);
      }
    }
    this.logger.log('Enrichment complete. Refetching data from DB...');
    const movieIds = movies.map((m) => m.id);
    const freshMovies = await this.prisma.movie.findMany({
      where: { id: { in: movieIds } },
    });
    return freshMovies.filter((m) => movieIds.includes(m.id));
  }

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
        // Dùng try-catch để tránh crash nếu phim đã bị xóa bởi tiến trình khác
        try {
          await this.prisma.movie.update({
            where: { id: movieId },
            data: { popularity: -1 },
          });
        } catch (updateError) {
          this.logger.error(
            `Could not mark movie ${movieId} as errored: ${updateError.message}`,
          );
        }
      }
    }
  }

  private async cleanupMovieFromDB(movieId: number): Promise<void> {
    try {
      await this.prisma.movieGenre.deleteMany({ where: { movieId: movieId } });
      await this.prisma.watchlist.deleteMany({ where: { movieId: movieId } });
      await this.prisma.rating.deleteMany({ where: { movieId: movieId } });
      await this.prisma.comment.deleteMany({ where: { movieId: movieId } });
      await this.prisma.featuredListMovie.deleteMany({
        where: { movieId: movieId },
      });
      await this.prisma.movie.delete({ where: { id: movieId } });
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
