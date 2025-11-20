/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/chat/chat.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // === LOGIC CHO USER ===

  async findOrCreateConversationForUser(userId: string) {
    // Dùng `upsert` để tìm hoặc tạo mới cuộc trò chuyện cho user
    const conversation = await this.prisma.conversation.upsert({
      where: { userId: userId },
      update: {
        // Nếu cuộc trò chuyện đã bị đóng, mở lại nó
        status: ConversationStatus.OPEN,
      },
      create: {
        userId: userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return conversation;
  }

  // === LOGIC CHO ADMIN ===

  // eslint-disable-next-line @typescript-eslint/require-await
  async getAdminConversations(status: ConversationStatus) {
    return this.prisma.conversation.findMany({
      where: { status: status },
      include: {
        user: {
          select: {
            display_name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });
  }

  async getAdminConversationMessages(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found.`,
      );
    }
    return conversation.messages;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async closeConversation(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
  }
}
