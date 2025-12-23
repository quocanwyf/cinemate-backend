import { ApiProperty } from '@nestjs/swagger';

export class ShareLinksDto {
  @ApiProperty({
    example: 'https://www.youtube.com/watch?v=abcdefg',
    nullable: true,
  })
  youtubeUrl: string | null;

  @ApiProperty({ example: 'https://youtu.be/abcdefg', nullable: true })
  youtubeShortUrl: string | null;

  @ApiProperty({
    example: 'https://www.youtube.com/embed/abcdefg',
    nullable: true,
  })
  embedUrl: string | null;

  @ApiProperty({ example: 'https://cinemate.app/movies/123' })
  movieUrl: string;

  @ApiProperty({
    example: 'The Movie — watch the trailer: https://youtu.be/abcdefg',
  })
  tweetText: string;
}
