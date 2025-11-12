import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateFeaturedListDto {
  @ApiProperty({
    description: 'Tiêu đề của danh sách nổi bật',
    example: 'Top 10 phim hành động 2025',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết về danh sách (tùy chọn)',
    example:
      'Tổng hợp những bộ phim hành động hay nhất năm 2025 được bình chọn bởi cộng đồng.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
