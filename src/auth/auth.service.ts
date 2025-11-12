/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { MailService } from 'src/mail/mail.service';
import { OAuth2Client } from 'google-auth-library';
import { AdminLoginDto } from 'src/admin/dto/admin-login.dto';

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
  private readonly googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  // ===========================================================
  //                        REGISTER & LOGIN
  // ===========================================================

  async register(registerDto: RegisterDto) {
    const { email, password, display_name } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
    const newUser = await this.prisma.user.create({
      data: { email, display_name, password_hash: hashedPassword },
    });

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
      throw new UnauthorizedException('Invalid credentials, please try again.');
    }

    if (!user.is_active) {
      throw new UnauthorizedException(
        'Your account has been banned. Please contact support.',
      );
    }

    await this.cleanupExpiredTokens(user.id);
    return this.generateAndSaveTokens(user, deviceInfo, this.prisma);
  }

  // ===========================================================
  //                    REFRESH TOKEN HANDLER
  // ===========================================================

  async refreshToken(
    userId: string,
    tokenRecordId: string,
    deviceInfo: DeviceInfo,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.is_active) {
      throw new UnauthorizedException(
        'Your account has been banned. Please contact support.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.userRefreshToken.delete({
          where: { id: tokenRecordId, userId },
        });
      } catch {
        this.logger.warn(`Revoked refresh token reuse for user ${userId}`);
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      return this.generateAndSaveTokens(user, deviceInfo, tx);
    });
  }

  // ===========================================================
  //                    GOOGLE LOGIN FLOW
  // ===========================================================

  async validateGoogleToken(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload) throw new UnauthorizedException('Invalid Google token');

      const { sub: providerId, email, name, picture } = payload;
      if (!email)
        throw new UnauthorizedException('Email not provided by Google');

      if (!name) {
        throw new UnauthorizedException('Display name not provided by Google');
      }

      return await this.prisma.user.upsert({
        where: { provider_id: providerId },
        update: { display_name: name, avatar_url: picture },
        create: {
          email,
          display_name: name,
          provider: 'google',
          provider_id: providerId,
          avatar_url: picture,
          is_email_verified: true,
        },
      });
    } catch (error) {
      this.logger.error('Google token validation failed', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async googleLogin(user: User, deviceInfo: DeviceInfo) {
    if (!user.is_active) {
      throw new UnauthorizedException(
        'Your account has been banned. Please contact support.',
      );
    }
    await this.cleanupExpiredTokens(user.id);
    return this.generateAndSaveTokens(user, deviceInfo, this.prisma);
  }

  // ===========================================================
  //              PASSWORD RESET & FORGOT PASSWORD
  // ===========================================================

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(
        `Password reset requested for non-existent email: ${email}`,
      );
      return { message: 'If an account exists, an email has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token_hash: hashedToken, expires_at: expires },
    });

    if (!user.email) {
      throw new Error('User email is required');
    }
    await this.mailService.sendPasswordResetEmail(user.email, token);
    return { message: 'Password reset email sent successfully.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { token_hash: hashedToken },
      });

      if (!resetToken || resetToken.expires_at < new Date())
        throw new UnauthorizedException('Invalid or expired token');

      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { password_hash: hashedPassword },
      });

      await tx.passwordResetToken.delete({ where: { id: resetToken.id } });
      await tx.userRefreshToken.deleteMany({
        where: { userId: resetToken.userId },
      });

      return { message: 'Password reset successfully.' };
    });
  }

  // ===========================================================
  //                TOKEN MANAGEMENT HELPERS
  // ===========================================================

  public async generateAndSaveTokens(
    user: Pick<User, 'id' | 'email'>,
    deviceInfo: DeviceInfo,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const jwtId = crypto.randomUUID();
    const payload = { sub: user.id, email: user.email };
    const refreshPayload = { sub: user.id, jti: jwtId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      this.SALT_ROUNDS,
    );

    const currentTokens = await prismaClient.userRefreshToken.findMany({
      where: { userId: user.id },
      orderBy: { created_at: 'asc' },
    });

    if (currentTokens.length >= this.MAX_DEVICES) {
      await prismaClient.userRefreshToken.delete({
        where: { id: currentTokens[0].id },
      });
    }

    await prismaClient.userRefreshToken.create({
      data: {
        userId: user.id,
        token_hash: hashedRefreshToken,
        device_info: JSON.stringify({
          ...deviceInfo,
          timestamp: new Date().toISOString(),
        }),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  private async cleanupExpiredTokens(userId: string) {
    await this.prisma.userRefreshToken.deleteMany({
      where: { userId, expires_at: { lt: new Date() } },
    });
  }

  // === HÀM MỚI CHO ADMIN LOGIN ===
  async adminLogin(adminLoginDto: AdminLoginDto) {
    const { email, password } = adminLoginDto;

    const admin = await this.prisma.admin.findUnique({ where: { email } });

    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Tạo payload cho Admin token
    // Chúng ta có thể thêm một trường `role` để phân biệt
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: 'admin', // Dấu hiệu nhận biết đây là token của Admin
    };

    // Tạo Access Token (có thể dùng chung secret hoặc secret riêng)
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '1h', // Cho Admin token sống lâu hơn
    });

    // Admin không cần Refresh Token phức tạp, chỉ cần Access Token
    return {
      access_token: accessToken,
    };
  }
}
