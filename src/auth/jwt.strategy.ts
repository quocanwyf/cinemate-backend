import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Lấy token từ header "Authorization: Bearer <token>"
      ignoreExpiration: false, // Không bỏ qua nếu token đã hết hạn
      secretOrKey: String(configService.get<string>('JWT_SECRET')), // Dùng secret key để xác minh
    });
  }

  // Hàm này sẽ tự động được gọi sau khi token được xác minh thành công
  async validate(payload: { sub: string; email: string }) {
    // Tìm người dùng trong DB dựa trên thông tin trong payload
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Loại bỏ mật khẩu trước khi trả về
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = user;

    // Kết quả trả về của hàm này sẽ được NestJS tự động gắn vào đối tượng `request.user`
    return result;
  }
}
