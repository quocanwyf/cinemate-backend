// src/movies/dto/movie-detail.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class GenreDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
}

class VideoDto {
  @ApiProperty({ example: '6_20_2024_trailere_1' })
  id: string; // ID của video trên TMDB

  @ApiProperty({ example: 'SUXWAEX2jlg' })
  key: string; // YouTube key

  @ApiProperty({ example: 'YouTube' })
  site: string;

  @ApiProperty({ example: 'Trailer' })
  type: string;
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
  @ApiProperty({ type: [VideoDto] })
  videos: VideoDto[];
}
