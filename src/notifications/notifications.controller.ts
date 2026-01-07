/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationsController {
  private logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: [NotificationResponseDto] })
  async list(@Query() q: ListNotificationsDto, @Request() req) {
    try {
      const userId = req.user.id;
      const unreadOnly = q.unread === 'true' || q.unread === '1';
      return await this.notificationsService.listNotifications(
        userId,
        q.page,
        q.limit,
        unreadOnly,
      );
    } catch (error) {
      this.logger.error(`Failed to list notifications: ${error.message}`);
      throw new HttpException(
        'Failed to fetch notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('count')
  async count(@Request() req) {
    try {
      const userId = req.user.id;
      const count = await this.notificationsService.countUnread(userId);
      return { unread: count };
    } catch (error) {
      this.logger.error(`Failed to count unread: ${error.message}`);
      throw new HttpException(
        'Failed to count unread notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/read')
  async markRead(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    try {
      const userId = req.user.id;
      const ok = await this.notificationsService.markAsRead(userId, id);
      return { success: ok };
    } catch (error) {
      this.logger.error(`Failed to mark as read: ${error.message}`);
      throw new HttpException(
        'Failed to mark notification as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('mark-read')
  async markMany(@Body() body: { ids: string[] }, @Request() req) {
    try {
      const userId = req.user.id;
      const count = await this.notificationsService.markManyAsRead(
        userId,
        body.ids || [],
      );
      return { updated: count };
    } catch (error) {
      this.logger.error(`Failed to mark many as read: ${error.message}`);
      throw new HttpException(
        'Failed to mark notifications as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
