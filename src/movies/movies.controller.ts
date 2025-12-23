/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MoviesService } from './movies.service';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MovieDto } from './dto/movie.dto';
import { SearchMovieDto } from './dto/search-movie.dto';
import { MovieDetailDto } from './dto/movie-detail.dto';
import { Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';
import { ShareLinksDto } from './dto/share-response.dto';

@ApiTags('movies') // Nhóm các API này dưới tag "movies"
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('popular')
  @ApiOperation({ summary: 'Get a list of popular movies' })
  @ApiOkResponse({
    description: 'Returns a list of popular movies.',
    type: [MovieDto], // Chỉ định rằng API trả về một mảng các MovieDto
  })
  getPopularMovies() {
    // Gọi đến service để lấy dữ liệu
    return this.moviesService.getPopularMovies();
  }

  @Get('top-rated')
  @ApiOperation({ summary: 'Get a list of top rated movies' })
  @ApiOkResponse({
    description: 'Returns a list of top rated movies.',
    type: [MovieDto],
  })
  getTopRatedMovies() {
    return this.moviesService.getTopRatedMovies();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for movies with optional filters' })
  @ApiOkResponse({ description: 'Results with pagination' })
  async searchMovies(@Query() dto: SearchMovieDto) {
    return this.moviesService.searchWithFilters(dto);
  }

  @Get('random')
  @ApiOperation({ summary: 'Get random movies' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of movies to return (default: 10, max: 50)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Random movies retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          poster_path: { type: 'string', nullable: true },
          backdrop_path: { type: 'string', nullable: true },
          vote_average: { type: 'number', nullable: true },
          release_date: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  })
  async getRandomMovies(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit), 50) : 10;
    return this.moviesService.getRandomMovies(parsedLimit);
  }

  @Get(':id') // Đường dẫn sẽ là /movies/123
  @ApiOperation({ summary: 'Get details for a specific movie' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({
    description: 'Returns the full details of a movie.',
    type: MovieDetailDto,
  })
  async getMovieById(@Param('id', ParseIntPipe) id: number, @Request() req?) {
    console.log('Authenticated user IDdddddddddddddddddđ:', req.user);

    const userId = req?.user?.id || null;
    console.log('Authenticated user IDdddddddddddddddddđ:', userId);
    return this.moviesService.getMovieById(id, userId);
  }

  @Get(':id/share')
  @ApiOperation({ summary: 'Get shareable links for a movie (YouTube + URLs)' })
  @ApiOkResponse({ type: ShareLinksDto })
  async getShareLinks(@Param('id', ParseIntPipe) id: number) {
    const origin = process.env.PUBLIC_APP_URL || undefined;
    return this.moviesService.getShareLinks(id, origin);
  }
}
