/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/auth/auth.service.ts

import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, Prisma } from '@prisma/client';

interface DeviceInfo {
  userAgent: string;
  ip: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_DEVICES = 5;
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly SALT_ROUNDS = 10;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // =================================================================
  //                        PUBLIC API METHODS
  // =================================================================

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

  async login(loginDto: LoginDto, deviceInfo: DeviceInfo) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !user.password_hash ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.cleanupExpiredTokens(user.id);

    return this.generateAndSaveTokens(user, deviceInfo, this.prisma);
  }

  async refreshToken(
    userId: string,
    tokenRecordId: string,
    deviceInfo: DeviceInfo,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Điều này gần như không xảy ra vì Strategy đã check
      throw new UnauthorizedException('User not found');
    }

    // Sử dụng transaction để đảm bảo tính toàn vẹn:
    // hoặc cả hai lệnh (xóa và tạo) đều thành công, hoặc cả hai đều thất bại.
    return this.prisma.$transaction(async (tx) => {
      try {
        // 1. Xóa token cũ trong transaction
        await tx.userRefreshToken.delete({
          where: { id: tokenRecordId, userId: userId },
        });
      } catch (error) {
        // Nếu không tìm thấy token để xóa (lỗi P2025 của Prisma), ném lỗi
        // Điều này xử lý trường hợp token đã bị thu hồi bởi một request khác
        this.logger.warn(
          `Attempt to use a revoked or non-existent refresh token for user ${userId}`,
        );
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // 2. Tạo và lưu cặp token mới trong cùng transaction
      return this.generateAndSaveTokens(user, deviceInfo, tx);
    });
  }

  async validateGoogleUser(profile: any) {
    // ... (Code validateGoogleUser của bạn đã rất tốt, giữ nguyên ở đây)
    // ...
    // Hoặc có thể thêm logic upsert trực tiếp ở đây
    const user = await this.prisma.user.upsert({
      where: { provider_id: profile.providerId },
      update: {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      create: {
        email: profile.email,
        display_name: profile.display_name,
        provider: 'google',
        provider_id: profile.providerId,
        avatar_url: profile.avatar_url,
        is_email_verified: true,
      },
    });
    return user;
  }

  // =================================================================
  //                        PRIVATE HELPER METHODS
  // =================================================================

  public async generateAndSaveTokens(
    user: Pick<User, 'id' | 'email'>,
    deviceInfo: DeviceInfo,
    prismaClient: Prisma.TransactionClient | PrismaService,
  ) {
    const jwtId = crypto.randomUUID();
    const payload = { sub: user.id, email: user.email };
    const refreshPayload = { sub: user.id, jti: jwtId };

    const [accessToken, refreshToken] = await Promise.all([
      // Tạo Access Token
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      }),
      // Tạo Refresh Token
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      this.SALT_ROUNDS,
    );

    // Giới hạn 5 phiên đăng nhập
    const currentTokens = await prismaClient.userRefreshToken.findMany({
      where: { userId: user.id },
      orderBy: { created_at: 'asc' },
    });

    if (currentTokens.length >= this.MAX_DEVICES) {
      const oldestToken = currentTokens[0];
      await prismaClient.userRefreshToken.delete({
        where: { id: oldestToken.id },
      });
    }

    // Lưu hash của refresh token mới vào DB
    await prismaClient.userRefreshToken.create({
      data: {
        userId: user.id,
        token_hash: hashedRefreshToken,
        device_info: JSON.stringify({
          ...deviceInfo,
          timestamp: new Date().toISOString(),
        }),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày sau
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async googleLogin(user: User, deviceInfo: DeviceInfo) {
    await this.cleanupExpiredTokens(user.id);
    return this.generateAndSaveTokens(user, deviceInfo, this.prisma);
  }

  private async cleanupExpiredTokens(userId: string): Promise<void> {
    await this.prisma.userRefreshToken.deleteMany({
      where: {
        userId: userId,
        expires_at: { lt: new Date() },
      },
    });
  }
}
