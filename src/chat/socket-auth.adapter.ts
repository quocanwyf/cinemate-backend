/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ServerOptions, Server } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';

export class SocketAuthAdapter extends IoAdapter {
  constructor(
    private app: INestApplicationContext,
    private jwtService: JwtService,
    private configService: any,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    server.use(async (socket, next) => {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers['authorization']?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }

      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET'),
        });

        if (!payload.sub) {
          return next(new Error('Authentication error: Invalid payload'));
        }

        const prisma = this.app.get(PrismaService);

        // ✅ Kiểm tra User trước
        if (payload.role !== 'admin') {
          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
              id: true,
              display_name: true,
              avatar_url: true,
            },
          });

          if (user) {
            socket.data.user = { ...user, role: 'user' };
            return next();
          }
        }

        // ✅ Nếu không phải user, kiểm tra Admin
        const admin = await prisma.admin.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        });

        if (admin) {
          socket.data.user = {
            id: admin.id,
            display_name: admin.full_name || admin.email,
            avatar_url: null,
            role: 'admin',
          };
          return next();
        }

        return next(new Error('Authentication error: User not found'));
      } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
      }
    });

    return server;
  }
}
