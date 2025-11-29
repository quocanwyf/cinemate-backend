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
  UploadedFile,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AdminGuard } from 'src/auth/admin.guard';
import { AuthGuard } from '@nestjs/passport';
import { ConversationStatus } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@ApiTags('Chat (REST)')
@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private cloudinaryService: CloudinaryService, // ✅ Đã có service này rồi!
  ) {}

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

  @Post('upload')
  // @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async uploadChatFile(
    @UploadedFile() file: Express.Multer.File,
    // @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // ✅ Sử dụng CloudinaryService đã có
    const uploadResult = await this.cloudinaryService.uploadImage(file);

    return {
      url: uploadResult.secure_url,
      fileName: file.originalname,
      fileSize: file.size,
      type: file.mimetype.startsWith('image') ? 'image' : 'file',
    };
  }
}
