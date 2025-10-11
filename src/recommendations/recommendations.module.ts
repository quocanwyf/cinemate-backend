import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { MoviesModule } from 'src/movies/movies.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [MoviesModule, HttpModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
