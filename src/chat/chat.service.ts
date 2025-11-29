import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // === LOGIC CHO USER ===

  async findOrCreateConversationForUser(userId: string) {
    const conversation = await this.prisma.conversation.upsert({
      where: { userId: userId },
      update: {
        status: ConversationStatus.OPEN,
      },
      create: {
        userId: userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                avatar_url: true,
              },
            },
            admin: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },
      },
    });
    return conversation;
  }

  // === LOGIC CHO ADMIN ===

  async getAdminConversations(status: ConversationStatus) {
    return this.prisma.conversation.findMany({
      where: { status: status },
      include: {
        user: {
          select: {
            id: true, // ✅ Thêm id
            display_name: true,
            avatar_url: true,
          },
        },
        messages: {
          // ✅ Thêm messages
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                avatar_url: true,
              },
            },
            admin: {
              select: {
                id: true,
                full_name: true,
              },
            },
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
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                avatar_url: true,
              },
            },
            admin: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
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

  async closeConversation(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
  }
}
