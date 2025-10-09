/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${this.tmdbApiKey}&language=en-US`;
    const videosUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${this.tmdbApiKey}&language=en-US`;

    let movieDetails;
    let movieVideos;

    try {
      const [detailsResponse, videosResponse] = await Promise.all([
        firstValueFrom(this.httpService.get(detailsUrl)),
        firstValueFrom(this.httpService.get(videosUrl)),
      ]);

      movieDetails = detailsResponse.data;
      movieVideos = videosResponse.data.results;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException(`Movie with ID ${movieId} not found.`);
      }
      throw error;
    }

    const trailer = movieVideos.find(
      (video: any) => video.type === 'Trailer' && video.site === 'YouTube',
    );

    const trailerKey = trailer ? trailer.key : null;

    await this.prisma.movie.upsert({
      where: { id: movieId },
      update: {
        title: movieDetails.title,
        overview: movieDetails.overview,
        poster_path: movieDetails.poster_path,
        backdrop_path: movieDetails.backdrop_path,
        trailer_key: trailerKey,
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
        backdrop_path: movieDetails.backdrop_path,
        trailer_key: trailerKey,
        release_date: movieDetails.release_date
          ? new Date(movieDetails.release_date)
          : null,
        popularity: movieDetails.popularity,
        vote_average: movieDetails.vote_average,
        vote_count: movieDetails.vote_count,
      },
    });
    this.logger.log(`Upserted movie ID ${movieId} to local DB.`);

    const result: MovieDetailDto = {
      id: movieDetails.id,
      title: movieDetails.title,
      overview: movieDetails.overview,
      poster_path: movieDetails.poster_path,
      backdrop_path: movieDetails.backdrop_path,
      trailer: trailerKey
        ? `https://www.youtube.com/watch?v=${trailerKey}`
        : 'https://www.youtube.com',
      release_date: movieDetails.release_date,
      vote_average: movieDetails.vote_average
        ? movieDetails.vote_average / 2
        : 0,
      genres: movieDetails.genres,
    };

    return result;
  }

  async getRandomMovies(limit: number = 10) {
    // Sử dụng raw SQL với ORDER BY RANDOM()
    const movies = await this.prisma.$queryRaw<Movie[]>`
    SELECT * FROM "Movie" 
    WHERE vote_count >= 50 AND vote_average IS NOT NULL
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

    const enrichedMovies = await this.enrichAndReturnMovies(movies);
    this.logger.log(`Retrieved ${enrichedMovies.length} random movies`);
    return this.normalizeMoviesForList(enrichedMovies);
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
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
    }));
  }

  public async enrichAndReturnMovies(movies: Movie[]): Promise<Movie[]> {
    const moviesToEnrich = movies.filter(
      (movie) => movie.popularity === null || movie.backdrop_path === null,
    );
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
      console.log('cc', movieDetails);
      await this.prisma.movie.update({
        where: { id: movieId },
        data: {
          overview: movieDetails.overview || '',
          poster_path: movieDetails.poster_path,
          popularity: movieDetails.popularity ?? 0,
          vote_average: movieDetails.vote_average ?? 0,
          vote_count: movieDetails.vote_count ?? 0,
          release_date: movieDetails.release_date
            ? new Date(movieDetails.release_date)
            : null,
          backdrop_path: movieDetails.backdrop_path,
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

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
