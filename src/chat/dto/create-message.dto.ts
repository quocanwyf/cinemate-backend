// src/chat/dto/create-message.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  // Dành cho Admin: ID của cuộc trò chuyện họ muốn gửi tin nhắn tới
  conversationId?: string;
}
