// src/movies/dto/movie-detail.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class GenreDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
}

export class MovieDetailDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  title: string;
  @ApiProperty()
  overview: string;
  @ApiProperty()
  poster_path: string;
  @ApiProperty()
  backdrop_path: string; // Thêm ảnh bìa
  @ApiProperty()
  release_date: string;
  @ApiProperty()
  vote_average: number; // Điểm đã được chuẩn hóa (0-5)
  @ApiProperty({ type: [GenreDto] }) // Mảng các thể loại
  genres: GenreDto[];
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=abcdefg' })
  trailer: string;
  @ApiProperty()
  is_in_watchlist: boolean;
  @ApiProperty({
    example: 4,
    description: 'User rating for this movie (1-5), null if not rated',
    nullable: true,
  })
  user_rating: number | null;
  // Chúng ta sẽ thêm các trường khác như diễn viên, trailer sau
}
