/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
  // ✅ Config values
  private readonly MAX_DEVICES = 5;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;
  private readonly SALT_ROUNDS = 10;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // --- HÀM ĐĂNG KÝ ---
  async register(registerDto: RegisterDto) {
    const { email, password, display_name } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    const newUser = await this.prisma.user.create({
      data: {
        email,
        display_name,
        password_hash: hashedPassword,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = newUser;
    return result;
  }

  // --- HÀM ĐĂNG NHẬP ---
  async login(loginDto: LoginDto, deviceInfo?: DeviceInfo) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordMatching = await bcrypt.compare(
      password,
      String(user.password_hash),
    );

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // ✅ FIX: Cleanup expired tokens trước khi login
    await this.cleanupExpiredTokens(user.id);

    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.getRefreshToken(user.id, deviceInfo),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  // ✅ FIX: Tạo refresh token với proper error handling
  private async getRefreshToken(
    userId: string,
    deviceInfo?: DeviceInfo,
  ): Promise<string> {
    const jwtId = crypto.randomUUID();
    const refreshTokenPayload = { sub: userId, jti: jwtId };

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: refreshSecret,
      expiresIn: `${this.REFRESH_TOKEN_EXPIRY_DAYS}d`,
    });

    const tokenString = String(refreshToken);
    const hashedRefreshToken = await bcrypt.hash(tokenString, this.SALT_ROUNDS);

    // ✅ FIX: Xóa console.log sensitive data
    // Chỉ log trong development nếu cần
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 Creating refresh token for user: ${userId}`);
    }

    // ✅ FIX: Multi-device cleanup - chạy cho cả refresh operation
    const currentTokens = await this.prisma.userRefreshToken.findMany({
      where: {
        userId: userId,
        expires_at: { gte: new Date() }, // Chỉ đếm token còn hiệu lực
      },
      orderBy: { created_at: 'asc' },
    });

    if (currentTokens.length >= this.MAX_DEVICES) {
      const tokensToDelete = currentTokens.slice(
        0,
        currentTokens.length - this.MAX_DEVICES + 1,
      );
      await this.prisma.userRefreshToken.deleteMany({
        where: {
          id: {
            in: tokensToDelete.map((token) => token.id),
          },
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `🧹 Removed ${tokensToDelete.length} old tokens (max ${this.MAX_DEVICES} devices)`,
        );
      }
    }

    // ✅ Lưu token vào DB
    await this.prisma.userRefreshToken.create({
      data: {
        userId: userId,
        token_hash: hashedRefreshToken,
        device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
        expires_at: new Date(
          Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return tokenString;
  }

  // ✅ FIX: Refresh token với transaction để tránh race condition
  async refreshToken(
    userId: string,
    tokenRecordId: string,
    deviceInfo?: DeviceInfo,
  ) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // ✅ FIX: Dùng transaction để đảm bảo atomic operation
    const result = await this.prisma.$transaction(async (tx) => {
      // Xóa token cũ
      await tx.userRefreshToken.delete({
        where: { id: tokenRecordId },
      });

      // Tạo payload cho tokens mới
      const payload = { sub: user.id, email: user.email };

      // Tạo access token mới
      const newAccessToken = await this.jwtService.signAsync(payload);

      // Tạo refresh token mới (phải tạo thủ công vì getRefreshToken dùng this.prisma)
      const jwtId = crypto.randomUUID();
      const refreshTokenPayload = { sub: userId, jti: jwtId };

      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET');
      if (!refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET is not configured');
      }

      const newRefreshToken = await this.jwtService.signAsync(
        refreshTokenPayload,
        {
          secret: refreshSecret,
          expiresIn: `${this.REFRESH_TOKEN_EXPIRY_DAYS}d`,
        },
      );

      const tokenString = String(newRefreshToken);
      const hashedRefreshToken = await bcrypt.hash(
        tokenString,
        this.SALT_ROUNDS,
      );

      // Multi-device cleanup trong transaction
      const currentTokens = await tx.userRefreshToken.findMany({
        where: {
          userId: userId,
          expires_at: { gte: new Date() },
        },
        orderBy: { created_at: 'asc' },
      });

      if (currentTokens.length >= this.MAX_DEVICES) {
        const tokensToDelete = currentTokens.slice(
          0,
          currentTokens.length - this.MAX_DEVICES + 1,
        );
        await tx.userRefreshToken.deleteMany({
          where: {
            id: {
              in: tokensToDelete.map((token) => token.id),
            },
          },
        });
      }

      // Lưu token mới trong transaction
      await tx.userRefreshToken.create({
        data: {
          userId: userId,
          token_hash: hashedRefreshToken,
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          expires_at: new Date(
            Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      });

      return {
        access_token: newAccessToken,
        refresh_token: tokenString,
      };
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Token refreshed for user: ${userId}`);
    }

    return result;
  }

  // ✅ FIX: Cleanup method được sử dụng
  private async cleanupExpiredTokens(userId: string) {
    const deletedCount = await this.prisma.userRefreshToken.deleteMany({
      where: {
        userId: userId,
        expires_at: { lt: new Date() },
      },
    });

    if (deletedCount.count > 0 && process.env.NODE_ENV === 'development') {
      console.log(
        `🧹 Cleaned up ${deletedCount.count} expired tokens for user ${userId}`,
      );
    }

    return deletedCount.count;
  }
}
