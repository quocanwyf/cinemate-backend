/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Post,
  Put,
  Delete,
  Req,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthService } from 'src/auth/auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { AdminGuard } from 'src/auth/admin.guard';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { CreateFeaturedListDto } from './dto/create-featured-list.dto';
import { UpdateFeaturedListDto } from './dto/update-featured-list.dto';
import { AdminResponseDto } from './dto/admin-response.dto';
import { AdminRefreshGuard } from 'src/auth/admin-refresh.guard';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  // =========================
  // ADMIN AUTH
  // =========================
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in as an admin' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return this.authService.adminLogin(adminLoginDto);
  }

  @UseGuards(AdminRefreshGuard)
  @ApiBearerAuth()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh admin access token',
    description: 'Send refresh token in Authorization header as Bearer token',
  })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  adminRefresh(@Request() req: any) {
    // req.user.refreshToken được inject từ JwtAdminRefreshStrategy
    return this.authService.adminRefreshToken(req.user.refreshToken);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('auth/me')
  @ApiOperation({ summary: 'Get current admin profile' })
  @ApiResponse({ status: 200, description: 'Admin profile retrieved' })
  async getMe(@Request() req): Promise<AdminResponseDto> {
    return this.adminService.getAdminProfile(req.user.id);
  }

  // =========================
  // USER MANAGEMENT (ADMIN ONLY)
  // =========================
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('dashboard/statistics')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStatistics() {
    return this.adminService.getDashboardStatistics();
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('users')
  @ApiOperation({ summary: 'Get a paginated list of users' })
  getUsers(@Query() paginationQueryDto: PaginationQueryDto) {
    return this.adminService.getUsers(paginationQueryDto);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('users/:id')
  @ApiOperation({ summary: 'Get details of a specific user' })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Ban or Unban a user' })
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, updateUserStatusDto.isActive);
  }

  // =========================
  // FEATURED LIST MANAGEMENT
  // =========================
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('featured-lists')
  @ApiOperation({ summary: 'Get all featured lists' })
  getFeaturedLists() {
    return this.adminService.getFeaturedLists();
  }

  @Get('featured-lists/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a specific featured list' })
  getFeaturedListById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getFeaturedListById(id);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Post('featured-lists')
  @ApiOperation({ summary: 'Create a new featured list' })
  createFeaturedList(@Body() dto: CreateFeaturedListDto, @Req() req: any) {
    const adminId = req.user.id;
    return this.adminService.createFeaturedList(dto, adminId);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Put('featured-lists/:id')
  @ApiOperation({ summary: 'Update an existing featured list' })
  updateFeaturedList(
    @Param('id') id: string,
    @Body() dto: UpdateFeaturedListDto,
  ) {
    return this.adminService.updateFeaturedList(id, dto);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Delete('featured-lists/:id')
  @ApiOperation({ summary: 'Delete a featured list' })
  deleteFeaturedList(@Param('id') id: string) {
    return this.adminService.deleteFeaturedList(id);
  }

  // =========================
  // COMMENT MODERATION
  // =========================
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Get('comments')
  @ApiOperation({ summary: 'Get a paginated list of comments for moderation' })
  getComments(@Query() paginationQueryDto: PaginationQueryDto) {
    return this.adminService.getComments(paginationQueryDto);
  }

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @Delete('comments/:id')
  @ApiOperation({ summary: 'Soft delete a comment (admin moderation)' })
  deleteComment(@Param('id') id: string) {
    return this.adminService.deleteComment(id);
  }
}
