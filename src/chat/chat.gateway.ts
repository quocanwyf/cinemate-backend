/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { CreateMessageDto } from './dto/create-message.dto';
import { SenderType } from '@prisma/client';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const user = client.data.user;

    if (!user) {
      this.logger.error('No user data in socket');
      client.disconnect();
      return;
    }

    this.logger.log(
      `Client connected: ${client.id}, UserID: ${user.id}, Role: ${user.role}`,
    );

    if (user.role === 'admin') {
      client.join('admin_room');
      this.logger.log(`Admin ${user.id} joined admin_room`);
      return;
    }

    // User logic
    let conversation = await this.prisma.conversation.findUnique({
      where: { userId: user.id },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { userId: user.id },
      });
    }

    client.join(conversation.id);
    this.logger.log(`User ${user.id} joined room: ${conversation.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody(new ValidationPipe()) payload: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; message?: any; error?: string }> {
    const user = client.data.user;

    if (!user?.id) {
      this.logger.error('Message rejected: No user data');
      return { success: false, error: 'No user data' };
    }

    const { content } = payload;

    if (!content?.trim()) {
      return { success: false, error: 'Empty content' };
    }

    let conversationId: string;
    const isAdmin = user.role === 'admin';

    // ✅ Xác định conversationId
    if (!isAdmin) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { userId: user.id },
      });

      if (!conversation) {
        this.logger.error(`User ${user.id} has no conversation`);
        return { success: false, error: 'No conversation found' };
      }

      conversationId = conversation.id;
    } else {
      if (!payload.conversationId) {
        this.logger.error(
          `Admin ${user.id} sent message without conversationId`,
        );
        return { success: false, error: 'conversationId required for admin' };
      }
      conversationId = payload.conversationId;
    }

    try {
      // ✅ Tạo message data
      const messageData: any = {
        content: content.trim(),
        conversationId,
        senderType: isAdmin ? SenderType.ADMIN : SenderType.USER,
      };

      if (isAdmin) {
        messageData.adminId = user.id;
      } else {
        messageData.userId = user.id;
      }

      // ✅ Lưu message
      const newMessage = await this.prisma.message.create({
        data: messageData,
        include: {
          user: !isAdmin
            ? {
                select: {
                  id: true,
                  display_name: true,
                  avatar_url: true,
                },
              }
            : undefined,
          admin: isAdmin
            ? {
                select: {
                  id: true,
                  full_name: true,
                },
              }
            : undefined,
        },
      });

      // ✅ Update conversation
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // ✅ Phát tin nhắn
      this.server.to(conversationId).emit('newMessage', newMessage);
      this.server.to('admin_room').emit('newMessage', newMessage);

      this.logger.log(
        `✅ Message from ${user.role} ${user.id} sent to ${conversationId}`,
      );

      return { success: true, message: newMessage };
    } catch (error) {
      this.logger.error('Error creating message:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }
}
