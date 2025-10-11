/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/tracking/tracking.controller.ts
import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';

@ApiTags('tracking')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('view/:movieId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record that a user has viewed a movie detail page',
  })
  recordMovieView(
    @Request() req,
    @Param('movieId', ParseIntPipe) movieId: number,
  ) {
    const userId = req.user.id;
    return this.trackingService.recordView(userId, movieId);
  }
}
