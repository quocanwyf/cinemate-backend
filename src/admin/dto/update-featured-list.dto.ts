import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
} from 'class-validator';

export class UpdateFeaturedListDto {
  @ApiPropertyOptional({
    description: 'Tiêu đề mới của danh sách (tùy chọn)',
    example: 'Top phim hành động cập nhật 2025',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Mô tả mới của danh sách (tùy chọn)',
    example: 'Danh sách được cập nhật thêm các phim mới ra rạp.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái xuất bản (true = hiển thị công khai)',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_published?: boolean;

  @ApiPropertyOptional({
    description: 'Danh sách ID phim theo thứ tự hiển thị (tùy chọn)',
    example: [12, 45, 78, 103],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  movieIds?: number[];
}
