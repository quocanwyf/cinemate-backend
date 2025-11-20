/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { SocketAuthAdapter } from './chat/socket-auth.adapter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lấy các service cần thiết từ app
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  // Sử dụng WebSocket adapter đã được xác thực
  app.useWebSocketAdapter(
    new SocketAuthAdapter(app, jwtService, configService),
  );

  // Thêm logging để debug
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://cinemate-admin.vercel.app',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('CineMate API')
    .setDescription(
      'The official API documentation for the CineMate application.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
