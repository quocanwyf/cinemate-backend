import { Controller, Get } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MovieDto } from './dto/movie.dto';

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
    return [];
  }
}
