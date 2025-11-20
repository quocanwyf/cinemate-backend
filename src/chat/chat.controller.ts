/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from 'src/auth/admin.guard';
import { AuthGuard } from '@nestjs/passport';
import { ConversationStatus } from '@prisma/client';

@ApiTags('Chat (REST)')
@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // --- ENDPOINTS CHO USER ---

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('conversation')
  @ApiOperation({ summary: "Get the current user's conversation and messages" })
  getUserConversation(@Request() req) {
    const userId = req.user.id;
    return this.chatService.findOrCreateConversationForUser(userId);
  }

  // --- ENDPOINTS CHO ADMIN ---

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('admin/conversations')
  @ApiOperation({ summary: 'Get all conversations (for admin)' })
  @ApiQuery({
    name: 'status',
    enum: ConversationStatus,
    required: false,
    description: 'Filter by status',
  })
  getAdminConversations(
    @Query('status') status: ConversationStatus = ConversationStatus.OPEN,
  ) {
    return this.chatService.getAdminConversations(status);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('admin/conversations/:id/messages')
  @ApiOperation({
    summary: 'Get messages for a specific conversation (for admin)',
  })
  getAdminConversationMessages(@Param('id') id: string) {
    return this.chatService.getAdminConversationMessages(id);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Post('admin/conversations/:id/close')
  @ApiOperation({ summary: 'Close a conversation (for admin)' })
  closeConversation(@Param('id') id: string) {
    return this.chatService.closeConversation(id);
  }
}
