/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/recommendations/recommendations.controller.ts
import { Controller, Get, UseGuards, Request, Param } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MovieDto } from 'src/movies/dto/movie.dto';

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('for-you')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get personalized movie recommendations for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of recommended movies.',
    type: [MovieDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getRecommendations(@Request() req) {
    // Lấy userId từ thông tin user đã được JwtStrategy xử lý
    const userId = req.user.id;

    // Gọi đến service để thực hiện logic AI
    return this.recommendationsService.getRecommendationsForUser(userId);
  }

  @Get('for-user/:userId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-admin'))
  @ApiOperation({
    summary: '[ADMIN] Get personalized recommendations for a specific user',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of recommended movies for the specified user.',
    type: [MovieDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only.' })
  getRecommendationsForUser(@Param('userId') userId: string) {
    // Admin có thể xem recommendations của bất kỳ user nào
    return this.recommendationsService.getRecommendationsForUser(userId);
  }
}
