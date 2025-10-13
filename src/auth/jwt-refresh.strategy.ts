// src/auth/jwt-refresh.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService, // Inject PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Không chấp nhận token đã hết hạn
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // Yêu cầu truyền `request` vào hàm validate
    } as StrategyOptionsWithRequest);
  }

  /**
   * Hàm này chỉ được gọi sau khi token được xác minh chữ ký và chưa hết hạn.
   * Nhiệm vụ của nó là kiểm tra xem token này có thực sự tồn tại và hợp lệ trong DB hay không.
   */
  async validate(req: Request, payload: { sub: string; jti: string }) {
    const refreshToken = req.get('Authorization')?.replace('Bearer', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Tìm TẤT CẢ các token của user trong DB
    const userTokens = await this.prisma.userRefreshToken.findMany({
      where: {
        userId: payload.sub,
        expires_at: { gt: new Date() }, // Chỉ tìm token còn hiệu lực
      },
    });

    if (!userTokens || userTokens.length === 0) {
      throw new UnauthorizedException(
        'Access Denied. No active sessions found.',
      );
    }

    // Tìm bản ghi token khớp với refresh token được gửi lên
    const tokenRecord = userTokens.find((token) =>
      bcrypt.compareSync(refreshToken, token.token_hash),
    );

    if (!tokenRecord) {
      // Quan trọng: Nếu token JWT hợp lệ nhưng không có trong DB -> có thể là token đã bị sử dụng lại (tấn công)
      // Để bảo mật, thu hồi tất cả các token của user này
      await this.prisma.userRefreshToken.deleteMany({
        where: { userId: payload.sub },
      });
      throw new UnauthorizedException(
        'Refresh token has been revoked. All sessions terminated.',
      );
    }

    // Trả về một object chứa thông tin cần thiết cho Controller
    return {
      userId: payload.sub,
      jwtId: payload.jti,
      tokenRecordId: tokenRecord.id, // ID của bản ghi token, rất quan trọng
    };
  }
}
