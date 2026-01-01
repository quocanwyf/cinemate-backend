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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Query() q: ListNotificationsDto, @Request() req) {
    const userId = req.user.id;
    const unreadOnly = q.unread === 'true' || q.unread === '1';
    return this.notificationsService.listNotifications(
      userId,
      q.page,
      q.limit,
      unreadOnly,
    );
  }

  @Get('count')
  async count(@Request() req) {
    const userId = req.user.id;
    const count = await this.notificationsService.countUnread(userId);
    return { unread: count };
  }

  @Patch(':id/read')
  async markRead(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    const userId = req.user.id;
    const ok = await this.notificationsService.markAsRead(userId, id);
    return { success: ok };
  }

  @Post('mark-read')
  async markMany(@Body() body: { ids: string[] }, @Request() req) {
    const userId = req.user.id;
    const count = await this.notificationsService.markManyAsRead(
      userId,
      body.ids || [],
    );
    return { updated: count };
  }
}
