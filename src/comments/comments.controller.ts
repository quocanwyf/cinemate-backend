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
  Query,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@Controller('movies/:movieId/comments') // Endpoint được lồng vào movies
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get comments for a movie with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Comments retrieved successfully with pagination',
  })
  getCommentsByMovie(
    @Param('movieId', ParseIntPipe) movieId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? Math.min(parseInt(limit), 50) : 20; // Max 50

    return this.commentsService.getCommentsByMovie(movieId, pageNum, limitNum);
  }

  @Get(':commentId/replies')
  @ApiOperation({ summary: 'Get more replies for a specific comment' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Replies retrieved successfully',
  })
  getRepliesByComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? Math.min(parseInt(limit), 20) : 10;

    return this.commentsService.getRepliesByComment(
      commentId,
      pageNum,
      limitNum,
    );
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
