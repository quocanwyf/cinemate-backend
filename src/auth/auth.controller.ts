/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleTokenDto } from './dto/google-token.dto';

// ✅ Kiểu dữ liệu cho req.user sau khi qua Guard
interface AuthenticatedRequest extends Request {
  ip: string;
  get: any;
  user: {
    userId: string;
    email: string;
    refreshToken?: string;
    tokenRecordId?: string;
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ================== REGISTER ==================
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // ================== LOGIN ==================
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in a user' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access_token and refresh_token.',
  })
  login(@Body() loginDto: LoginDto, @Request() req: express.Request) {
    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || 'Unknown',
    };
    return this.authService.login(loginDto, deviceInfo);
  }

  // ================== REFRESH TOKEN ==================
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiBearerAuth()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Returns new access_token and refresh_token.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or revoked refresh token.',
  })
  async refreshTokens(@Request() req: AuthenticatedRequest) {
    const { userId, tokenRecordId } = req.user;

    if (!tokenRecordId) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || 'Unknown',
    };

    return this.authService.refreshToken(userId, tokenRecordId, deviceInfo);
  }

  // ================== PROFILE ==================
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req: AuthenticatedRequest) {
    return req.user;
  }

  // =================================================================
  //                   GOOGLE OAUTH2 (for web)
  // =================================================================

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 login flow (Web)' })
  async googleAuth() {
    // Passport-google-oauth20 sẽ tự động redirect đến Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Handle Google OAuth2 callback (Web)' })
  async googleAuthRedirect(@Request() req: express.Request & { user: any }) {
    const googleProfile = req.user;
    if (!googleProfile) {
      throw new UnauthorizedException('Google authentication failed.');
    }

    const userInDb = await this.authService.validateGoogleToken(googleProfile);

    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || 'Unknown',
    };

    return this.authService.googleLogin(userInDb, deviceInfo);
  }

  // =================================================================
  //                   GOOGLE ID TOKEN LOGIN (for Mobile)
  // =================================================================

  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in/Sign up with Google ID Token (for Mobile)',
  })
  async googleTokenLogin(
    @Body() googleTokenDto: GoogleTokenDto,
    @Request() req: express.Request,
  ) {
    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || 'Unknown',
    };

    // 1️⃣ Xác thực token Google và upsert user
    const user = await this.authService.validateGoogleToken(
      googleTokenDto.idToken,
    );

    // 2️⃣ Tạo và lưu cặp token của CineMate
    return this.authService.generateAndSaveTokens(user, deviceInfo);
  }

  // ================== FORGOT PASSWORD ==================
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'User with this email not found.',
  })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  // ================== RESET PASSWORD ==================
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired reset token.',
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}
