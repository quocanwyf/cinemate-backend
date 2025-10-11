import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface DeviceInfo {
  userAgent: string;
  ip: string;
  timestamp: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // --- HÀM ĐĂNG KÝ ---
  async register(registerDto: RegisterDto) {
    const { email, password, display_name } = registerDto;

    // 1. Kiểm tra xem email đã tồn tại chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 2. Hash mật khẩu
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Tạo người dùng mới trong database
    const newUser = await this.prisma.user.create({
      data: {
        email,
        display_name,
        password_hash: hashedPassword,
      },
    });

    // 4. Trả về thông tin người dùng (loại bỏ mật khẩu)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = newUser;
    return result;
  }

  // --- HÀM ĐĂNG NHẬP ---
  async login(loginDto: LoginDto, deviceInfo?: DeviceInfo) {
    const { email, password } = loginDto;

    // 1. Tìm người dùng bằng email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. So sánh mật khẩu
    const isPasswordMatching = await bcrypt.compare(
      password,
      String(user.password_hash),
    );

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Nếu mật khẩu đúng, tạo JWT payload
    const payload = { sub: user.id, email: user.email };

    // 4. Ký và tạo access_token
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.getRefreshToken(user.id, deviceInfo),
    ]);

    // 5. Trả về access_token
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  // Tạo refresh token mới và lưu bản hash của nó vào database với multi-device support
  private async getRefreshToken(
    userId: string,
    deviceInfo?: DeviceInfo,
  ): Promise<string> {
    const refreshTokenPayload = { sub: userId };

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    const tokenString = String(refreshToken);
    const hashedRefreshToken = await bcrypt.hash(tokenString, 10);

    // === CHÍNH SÁCH ĐA THIẾT BỊ: TỐI ĐA 5 THIẾT BỊ ===

    // 1. Kiểm tra số lượng thiết bị hiện tại
    const currentTokens = await this.prisma.userRefreshToken.findMany({
      where: { userId: userId },
      orderBy: { created_at: 'asc' },
    });

    // 2. Nếu đã đạt giới hạn (5 thiết bị), xóa thiết bị cũ nhất
    if (currentTokens.length >= 5) {
      const tokensToDelete = currentTokens.slice(0, currentTokens.length - 4);
      await this.prisma.userRefreshToken.deleteMany({
        where: {
          id: {
            in: tokensToDelete.map((token) => token.id),
          },
        },
      });
    }

    // 3. Tạo token mới cho thiết bị hiện tại
    await this.prisma.userRefreshToken.create({
      data: {
        userId: userId,
        token_hash: hashedRefreshToken,
        device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return tokenString;
  }

  // Xác thực refresh token cũ → Xóa cũ → Cấp access token và refresh token mới
  async refreshToken(
    userId: string,
    refreshToken: string,
    deviceInfo?: DeviceInfo,
  ) {
    // 1. Tìm user và các token của họ
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRefreshTokens: true },
    });
    if (!user) throw new UnauthorizedException('Access Denied');

    // 2. Tìm token hợp lệ trong DB và so sánh
    const activeRefreshToken = user.userRefreshTokens.find((tokenRecord) =>
      bcrypt.compareSync(refreshToken, tokenRecord.token_hash),
    );

    if (!activeRefreshToken) throw new UnauthorizedException('Access Denied');

    // 3. Xóa chỉ refresh token hiện tại (không xóa tất cả để support multi-device)
    await this.prisma.userRefreshToken.delete({
      where: { id: activeRefreshToken.id },
    });

    // 4. Tạo cặp token mới
    const payload = { sub: user.id, email: user.email };
    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.getRefreshToken(user.id, deviceInfo),
    ]);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }
}
