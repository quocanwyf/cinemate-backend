import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateRatingDto } from './dto/create-rating.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('ratings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post(':movieId')
  @HttpCode(HttpStatus.OK) // Trả về 200 OK vì đây là hành động tạo hoặc cập nhật
  @ApiOperation({ summary: 'Rate a movie' })
  @ApiResponse({ status: 200, description: 'Rating submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid score (must be 1-5).' })
  @ApiResponse({ status: 404, description: 'Movie not found.' })
  upsertRating(
    @Request() req,
    @Param('movieId', ParseIntPipe) movieId: number,
    @Body() createRatingDto: CreateRatingDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const userId = req.user.id;
    return this.ratingsService.upsertRating(userId, movieId, createRatingDto);
  }
}
