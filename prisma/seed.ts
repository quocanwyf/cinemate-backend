import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const dataPath = path.join(__dirname, 'data');
const moviesFilePath = path.join(dataPath, 'movies.csv');
const ratingsFilePath = path.join(dataPath, 'ratings.csv');
const linksFilePath = path.join(dataPath, 'links.csv');

async function readCsv<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function main() {
  console.log('--- Starting Seeding Process ---');

  console.time('🧹 Cleaning database');
  await prisma.movieGenre.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.featuredListMovie.deleteMany();
  await prisma.featuredList.deleteMany();
  await prisma.userRefreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.adminRefreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.movie.deleteMany();
  console.timeEnd('🧹 Cleaning database');

  // =================================================================
  //                        SEEDING GENRES
  // =================================================================
  console.time('🌱 Seeding Genres');
  const moviesFromCsv = await readCsv<{
    movieId: string;
    title: string;
    genres: string;
  }>(moviesFilePath);

  const genresSet = new Set<string>();
  for (const movie of moviesFromCsv) {
    const genres = movie.genres.split('|');
    genres.forEach((genre) => {
      if (genre.trim() !== '' && genre !== '(no genres listed)') {
        genresSet.add(genre.trim());
      }
    });
  }

  const uniqueGenres = Array.from(genresSet);
  const genresToCreate: Prisma.GenreCreateManyInput[] = uniqueGenres.map(
    (name, index) => ({
      id: index + 1,
      name: name,
    }),
  );

  await prisma.genre.createMany({
    data: genresToCreate,
    skipDuplicates: true,
  });
  console.log(`- Seeded ${genresToCreate.length} genres.`);
  console.timeEnd('🌱 Seeding Genres');

  // =================================================================
  //                        SEEDING MOVIES
  // =================================================================
  console.time('🗺️ Creating movieId -> tmdbId map');
  const linksFromCsv = await readCsv<{ movieId: string; tmdbId: string }>(
    linksFilePath,
  );
  const movieIdToTmdbIdMap = new Map<number, number>();
  for (const link of linksFromCsv) {
    if (link.tmdbId) {
      movieIdToTmdbIdMap.set(
        parseInt(link.movieId, 10),
        parseInt(link.tmdbId, 10),
      );
    }
  }
  console.timeEnd('🗺️ Creating movieId -> tmdbId map');

  console.time('🌱 Seeding Movies & MovieGenres');
  const allGenres = await prisma.genre.findMany();
  const genreNameToIdMap = new Map<string, number>();
  allGenres.forEach((g) => genreNameToIdMap.set(g.name, g.id));

  const moviesToCreate: Prisma.MovieCreateManyInput[] = [];
  const movieGenresToCreate: Prisma.MovieGenreCreateManyInput[] = [];

  for (const movie of moviesFromCsv) {
    const movieId = parseInt(movie.movieId, 10);
    const tmdbId = movieIdToTmdbIdMap.get(movieId);

    if (tmdbId) {
      const yearMatch = movie.title.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

      moviesToCreate.push({
        id: tmdbId,
        title: movie.title.replace(/\s*\(\d{4}\)$/, '').trim(),
        release_date: year ? new Date(`${year}-01-01T00:00:00.000Z`) : null,
      });

      const genres = movie.genres.split('|');
      for (const genreName of genres) {
        const genreId = genreNameToIdMap.get(genreName.trim());
        if (genreId) {
          movieGenresToCreate.push({
            movieId: tmdbId,
            genreId: genreId,
          });
        }
      }
    }
  }

  await prisma.movie.createMany({
    data: moviesToCreate,
    skipDuplicates: true,
  });
  console.log(`- Seeded ${moviesToCreate.length} movies.`);

  await prisma.movieGenre.createMany({
    data: movieGenresToCreate,
    skipDuplicates: true,
  });
  console.log(`- Seeded ${movieGenresToCreate.length} movie-genre relations.`);
  console.timeEnd('🌱 Seeding Movies & MovieGenres');

  // =================================================================
  //                        SEEDING USERS
  // =================================================================
  console.time('👤 Seeding Users');
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash('password123', saltRounds);

  const ratingsFromCsv = await readCsv<{
    userId: string;
    movieId: string;
    rating: string;
    timestamp: string;
  }>(ratingsFilePath);
  const userIds = new Set(ratingsFromCsv.map((r) => parseInt(r.userId, 10)));

  const usersToCreate: Prisma.UserCreateManyInput[] = [];
  for (const userId of userIds) {
    usersToCreate.push({
      display_name: `User ${userId}`,
      email: `user${userId}@cinemate.app`,
      password_hash: hashedPassword,
    });
  }

  await prisma.user.createMany({
    data: usersToCreate,
    skipDuplicates: true,
  });
  console.log(`- Seeded ${usersToCreate.length} users.`);
  console.timeEnd('👤 Seeding Users');

  // =================================================================
  //                        SEEDING RATINGS
  // =================================================================
  console.time('🌟 Seeding Ratings');

  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  const userEmailToIdMap = new Map<string, string>();
  allUsers.forEach((u) => userEmailToIdMap.set(u.email!, u.id));

  const ratingsToCreate: Prisma.RatingCreateManyInput[] = [];

  for (const rating of ratingsFromCsv) {
    const userId = parseInt(rating.userId, 10);
    const movieId = parseInt(rating.movieId, 10);
    const score = Math.round(parseFloat(rating.rating));

    const userUuid = userEmailToIdMap.get(`user${userId}@cinemate.app`);
    const tmdbId = movieIdToTmdbIdMap.get(movieId);

    if (userUuid && tmdbId && score >= 1) {
      ratingsToCreate.push({
        userId: userUuid,
        movieId: tmdbId,
        score: score,
      });
    }
  }

  const batchSize = 1000;
  console.log(
    `- Inserting ${ratingsToCreate.length} ratings in batches of ${batchSize}...`,
  );
  for (let i = 0; i < ratingsToCreate.length; i += batchSize) {
    const batch = ratingsToCreate.slice(i, i + batchSize);
    await prisma.rating.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(
      `  - Seeded batch ${i / batchSize + 1}/${Math.ceil(ratingsToCreate.length / batchSize)}...`,
    );
  }

  console.log(`- Seeded ${ratingsToCreate.length} ratings in total.`);
  console.timeEnd('🌟 Seeding Ratings');

  console.log('--- Seeding Finished ---');
}

async function runSeed() {
  try {
    await main();
  } catch (e) {
    console.error('An error occurred during seeding:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('--- Prisma Client Disconnected ---');
  }
}

runSeed();
