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

// Định nghĩa một kiểu dữ liệu cho user object sau khi qua các Guard
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

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

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
    const userId = req.user.userId;
    const tokenRecordId = req.user.tokenRecordId;

    if (!tokenRecordId) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || 'Unknown',
    };

    return this.authService.refreshToken(userId, tokenRecordId, deviceInfo);
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req: AuthenticatedRequest) {
    return req.user;
  }

  // =================================================================
  //                        GOOGLE OAUTH ENDPOINTS
  // =================================================================

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 login flow' })
  async googleAuth() {
    // Passport-google-oauth20 sẽ tự động xử lý việc chuyển hướng
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback handler' })
  async googleAuthRedirect(@Request() req: express.Request & { user: any }) {
    const googleProfile = req.user;
    if (!googleProfile) {
      throw new UnauthorizedException('Google authentication failed.');
    }

    // Tìm hoặc tạo user trong DB
    const userInDb = await this.authService.validateGoogleUser(googleProfile);

    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || 'Unknown',
    };

    // Sử dụng method dedicated cho Google OAuth
    return this.authService.googleLogin(userInDb, deviceInfo);
  }

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

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired reset token.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}
