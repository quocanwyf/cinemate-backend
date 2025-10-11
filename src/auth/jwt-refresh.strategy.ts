/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService, // ✅ FIX: Inject PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);
  }

  async validate(req: Request, payload: { sub: string; jti: string }) {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const refreshToken = authHeader.replace('Bearer ', '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    // ✅ FIX: Query tokens với proper error handling
    const userTokens = await this.prisma.userRefreshToken.findMany({
      where: {
        userId: payload.sub,
        expires_at: { gte: new Date() }, // ✅ FIX: Chỉ lấy token chưa hết hạn
      },
    });

    if (!userTokens || userTokens.length === 0) {
      throw new UnauthorizedException('No valid refresh tokens found');
    }

    // ✅ FIX: Tối ưu - dùng bcrypt.compare (async) thay vì compareSync
    let tokenRecord: (typeof userTokens)[0] | null = null;
    for (const token of userTokens) {
      const isMatch = await bcrypt.compare(refreshToken, token.token_hash);
      if (isMatch) {
        tokenRecord = token;
        break;
      }
    }

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or invalid',
      );
    }

    // ✅ Trả về đầy đủ thông tin
    return {
      userId: payload.sub,
      jwtId: payload.jti,
      refreshToken,
      tokenRecordId: tokenRecord.id,
    };
  }
}
