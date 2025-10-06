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
  Put,
  Delete,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateCommentDto } from './dto/update-comment.dto';

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

  @Put(':commentId') // Sẽ là PUT /movies/{movieId}/comments/{commentId}
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update a comment' })
  updateComment(
    @Request() req,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    const userId = req.user.id;
    return this.commentsService.updateComment(
      userId,
      commentId,
      updateCommentDto,
    );
  }

  @Delete(':commentId') // Sẽ là DELETE /movies/{movieId}/comments/{commentId}
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content là phù hợp cho việc xóa
  @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(
    @Request() req,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    const userId = req.user.id;
    return this.commentsService.deleteComment(userId, commentId);
  }
}
