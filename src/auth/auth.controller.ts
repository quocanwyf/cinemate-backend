/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';

@ApiTags('auth') // Nhóm các API này dưới tag "auth"
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
  @HttpCode(HttpStatus.OK) // Mặc định POST là 201, đổi thành 200 OK cho login
  @ApiOperation({ summary: 'Log in a user' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  login(@Body() loginDto: LoginDto, @Request() req) {
    // Extract device info from request
    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || req.connection?.remoteAddress || 'Unknown',
      timestamp: new Date().toISOString(),
    };

    return this.authService.login(loginDto, deviceInfo);
  }

  @UseGuards(AuthGuard('jwt')) // <-- ÁP DỤNG "NGƯỜI GÁC CỔNG"
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns the user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getProfile(@Request() req) {
    // req.user sẽ chứa thông tin user được trả về từ hàm validate() của JwtStrategy
    return req.user;
  }

  @UseGuards(AuthGuard('jwt-refresh')) // Sử dụng Guard với strategy 'jwt-refresh'
  @ApiBearerAuth()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshTokens(@Request() req) {
    const userId = req.user.sub;
    const refreshToken = req.user.refreshToken;

    // Extract device info for new refresh token
    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || req.connection?.remoteAddress || 'Unknown',
      timestamp: new Date().toISOString(),
    };

    return this.authService.refreshToken(userId, refreshToken, deviceInfo);
  }
}
