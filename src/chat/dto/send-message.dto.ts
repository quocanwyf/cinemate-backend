import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ValidateNested,
  IsEnum,
  IsUrl,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// ✅ Tạo class riêng cho Attachment
class AttachmentDto {
  @IsEnum(['image', 'file'])
  type: 'image' | 'file';

  @IsUrl()
  url: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsNumber()
  fileSize: number;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  conversationId?: string;

  // ✅ Validate nested object
  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto;
}
