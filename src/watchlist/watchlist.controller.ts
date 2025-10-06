/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('watchlist')
@ApiBearerAuth() // Yêu cầu JWT cho tất cả các API trong controller này
@UseGuards(AuthGuard('jwt')) // Áp dụng Guard cho tất cả các API
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get user watchlist' })
  getWatchlist(@Request() req) {
    const userId = req.user.id;
    return this.watchlistService.getWatchlist(userId);
  }

  @Post(':movieId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a movie to watchlist' })
  @ApiResponse({ status: 201, description: 'Movie added.' })
  @ApiResponse({ status: 404, description: 'Movie not found.' })
  addMovieToWatchlist(
    @Request() req,
    @Param('movieId', ParseIntPipe) movieId: number,
  ) {
    const userId = req.user.id;
    return this.watchlistService.addMovieToWatchlist(userId, movieId);
  }

  @Delete(':movieId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a movie from watchlist' })
  @ApiResponse({ status: 200, description: 'Movie removed.' })
  @ApiResponse({ status: 404, description: 'Movie not in watchlist.' })
  removeMovieFromWatchlist(
    @Request() req,
    @Param('movieId', ParseIntPipe) movieId: number,
  ) {
    const userId = req.user.id;
    return this.watchlistService.removeMovieFromWatchlist(userId, movieId);
  }
}
