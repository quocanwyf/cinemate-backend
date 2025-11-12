import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtAdminRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-admin-refresh',
) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: String(configService.get<string>('JWT_REFRESH_SECRET')),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; email: string }) {
    // Lấy refresh token từ header
    const refreshToken = req
      .get('Authorization')
      ?.replace('Bearer ', '')
      .trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Kiểm tra admin tồn tại
    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    // Trả về payload + refreshToken để controller xử lý
    return {
      id: admin.id,
      email: admin.email,
      refreshToken, // ← Pass refresh token vào req.user
    };
  }
}
