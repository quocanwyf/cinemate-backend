/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('comments')
@Controller('movies/:movieId/comments') // Endpoint được lồng vào movies
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all comments for a movie' })
  getCommentsByMovie(@Param('movieId', ParseIntPipe) movieId: number) {
    return this.commentsService.getCommentsByMovie(movieId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Post a new comment for a movie' })
  createComment(
    @Request() req,
    @Param('movieId', ParseIntPipe) movieId: number,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    const userId = req.user.id;
    return this.commentsService.createComment(
      userId,
      movieId,
      createCommentDto,
    );
  }
}
