/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, ValidationPipe } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto'; // ✅ Đổi thành SendMessageDto
import { SenderType } from '@prisma/client';
import { ConversationStatus } from '@prisma/client';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const user = client.data.user;

    if (!user) {
      this.logger.warn('No user data in socket connection');
      client.disconnect();
      return;
    }

    this.logger.log(
      `Client connected: ${client.id}, UserID: ${user.id}, Role: ${user.role}`,
    );

    if (user.role === 'admin') {
      // ✅ Admin join vào admin-room
      client.join('admin-room');

      // ✅ QUAN TRỌNG: Admin phải join TẤT CẢ conversation rooms đang OPEN
      const openConversations = await this.prisma.conversation.findMany({
        where: { status: ConversationStatus.OPEN },
        select: { id: true },
      });

      for (const conv of openConversations) {
        client.join(conv.id);
      }

      this.logger.log(
        `✅ Admin ${user.id} joined admin-room + ${openConversations.length} conversation rooms`,
      );
    } else {
      // ✅ User join vào conversation room của mình
      let conversation = await this.prisma.conversation.findUnique({
        where: { userId: user.id },
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            userId: user.id,
            status: ConversationStatus.OPEN,
          },
        });
        this.logger.log(`Created new conversation: ${conversation.id}`);
      }

      client.join(conversation.id);
      this.logger.log(
        `✅ User ${user.id} joined conversation room: ${conversation.id}`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody(new ValidationPipe()) payload: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; message?: any; error?: string }> {
    try {
      const user = client.data.user;
      const isAdmin = user.role === 'admin';
      const { conversationId, content, attachments } = payload;

      // Validate conversation exists and conversationId is defined
      if (!conversationId) {
        return { success: false, error: 'Conversation ID is required' };
      }

      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      // ✅ Create message
      const newMessage = await this.prisma.message.create({
        data: {
          conversationId: conversationId,
          content,
          attachments: attachments ? JSON.stringify(attachments) : undefined,
          senderType: isAdmin ? SenderType.ADMIN : SenderType.USER,
          userId: isAdmin ? null : user.id,
          adminId: isAdmin ? user.id : null,
        },
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
      });

      // ✅ Update conversation lastMessageAt
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // ✅ QUAN TRỌNG: Emit đến CONVERSATION ROOM (cả user và admin đều ở đây)
      if (conversationId) {
        this.server.to(conversationId).emit('newMessage', newMessage);
      }

      this.logger.log(
        `📨 Message sent to room ${conversationId} by ${isAdmin ? 'Admin' : 'User'}: ${newMessage.id}`,
      );

      return { success: true, message: newMessage };
    } catch (error) {
      this.logger.error('❌ Error sending message:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }
}
