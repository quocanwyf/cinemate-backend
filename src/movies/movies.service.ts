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
    this.logger.log(`Upserted movie ID ${movieId} to local DB.`);

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

  private normalizeMoviesForList(movies: Movie[]) {
    return movies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average ? movie.vote_average / 2 : null,
    }));
  }

  private async enrichAndReturnMovies(movies: Movie[]): Promise<Movie[]> {
    const moviesToEnrich = movies.filter((movie) => movie.popularity === null);
    if (moviesToEnrich.length === 0) {
      return movies;
    }
    this.logger.log(`Enriching data for ${moviesToEnrich.length} movies...`);
    const enrichmentPromises = moviesToEnrich.map((movie) =>
      this.fetchAndUpdateMovie(movie.id).catch((err) => {
        this.logger.error(`Error enriching movie ${movie.id}: ${err.message}`);
        return null;
      }),
    );
    await Promise.all(enrichmentPromises);
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
