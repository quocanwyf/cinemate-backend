/* eslint-disable @typescript-eslint/no-unused-vars */
// src/admin/admin.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { Prisma } from '@prisma/client'; // <-- Add this import

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // --- USER MANAGEMENT ---

  async getUsers(paginationQueryDto: PaginationQueryDto) {
    const { page, limit, search } = paginationQueryDto;
    if (page === undefined || limit === undefined) {
      throw new BadRequestException('Page and limit parameters are required.');
    }
    if (page < 1 || limit < 1) {
      throw new BadRequestException(
        'Page and limit must be positive integers.',
      );
    }
    const skip = (page - 1) * limit;

    const whereClause = search
      ? {
          OR: [
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            {
              display_name: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {};

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    const usersWithoutPassword = users.map(
      ({ password_hash, ...user }) => user,
    );

    return {
      data: usersWithoutPassword,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Có thể include thêm dữ liệu nếu cần
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }
    const { password_hash, ...result } = user;
    return result;
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    // Kiểm tra user tồn tại
    const user = await this.getUserById(userId);

    return this.prisma.user.update({
      where: { id: user.id },
      data: { is_active: isActive },
    });
  }
}
