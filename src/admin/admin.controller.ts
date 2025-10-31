// src/admin/admin.controller.ts
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
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthService } from 'src/auth/auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { AdminGuard } from 'src/auth/admin.guard';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

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
  adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return this.authService.adminLogin(adminLoginDto);
  }

  // =========================
  // USER MANAGEMENT (ADMIN ONLY)
  // =========================
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
}
