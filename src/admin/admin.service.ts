/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { Prisma } from '@prisma/client';
import { CreateFeaturedListDto } from './dto/create-featured-list.dto';
import { UpdateFeaturedListDto } from './dto/update-featured-list.dto';
import { MoviesService } from 'src/movies/movies.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private moviesService: MoviesService,
  ) {}

  // =============================
  // === USER MANAGEMENT SECTION ==
  // =============================

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
        skip,
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
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdminProfile(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        full_name: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        // ========== COUNTS ==========
        _count: {
          select: {
            comments: true,
            watchlists: true,
            ratings: true,
            ViewHistory: true,
            userRefreshTokens: true,
          },
        },

        // ========== COMMENTS (10 gần nhất) ==========
        comments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          where: { is_deleted: false },
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                poster_path: true,
              },
            },
            _count: {
              select: { replies: true },
            },
          },
        },

        // ========== WATCHLIST (12 phim gần nhất) ==========
        watchlists: {
          take: 12,
          orderBy: { created_at: 'desc' },
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                poster_path: true,
                release_date: true,
                vote_average: true,
              },
            },
          },
        },

        // ========== RATINGS (12 đánh giá gần nhất) ==========
        ratings: {
          take: 12,
          orderBy: { updated_at: 'desc' },
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                poster_path: true,
                vote_average: true,
              },
            },
          },
        },

        // ========== VIEW HISTORY (10 phim xem gần nhất) ==========
        ViewHistory: {
          take: 10,
          orderBy: { viewed_at: 'desc' },
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                poster_path: true,
                release_date: true,
              },
            },
          },
        },

        // ========== ACTIVE SESSIONS ==========
        userRefreshTokens: {
          where: {
            expires_at: { gt: new Date() },
          },
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            device_info: true,
            created_at: true,
            expires_at: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    // Loại bỏ password_hash
    const { password_hash, ...result } = user;
    return result;
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    const user = await this.getUserById(userId);
    return this.prisma.user.update({
      where: { id: user.id },
      data: { is_active: isActive },
    });
  }

  // =====================================
  // === FEATURED LIST MANAGEMENT SECTION ==
  // =====================================

  async createFeaturedList(dto: CreateFeaturedListDto, adminId: string) {
    return this.prisma.featuredList.create({
      data: {
        title: dto.title,
        description: dto.description,
        ownerId: adminId,
      },
    });
  }

  //  HÀM UPDATE FEATURED LIST (phiên bản nâng cao)
  async updateFeaturedList(listId: string, dto: UpdateFeaturedListDto) {
    const { movieIds, ...listData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // B1: Kiểm tra list có tồn tại
      const listExists = await tx.featuredList.findUnique({
        where: { id: listId },
      });
      if (!listExists) {
        throw new NotFoundException(
          `Featured list with ID ${listId} not found.`,
        );
      }

      // B2: Nếu có movieIds thì kiểm tra + enrich dữ liệu
      if (movieIds) {
        const uniqueMovieIds = [...new Set(movieIds)];

        // 🔹 Lấy phim trong DB
        const moviesInDb = await tx.movie.findMany({
          where: { id: { in: uniqueMovieIds } },
        });

        // 🔹 Dùng service enrich dữ liệu (nếu thiếu)
        await this.moviesService.enrichAndReturnMovies(moviesInDb);

        // 🔹 Kiểm tra lại phim hợp lệ sau khi enrich
        const validMovies = await tx.movie.findMany({
          where: { id: { in: uniqueMovieIds } },
          select: { id: true },
        });

        if (validMovies.length !== uniqueMovieIds.length) {
          const validIds = new Set(validMovies.map((m) => m.id));
          const notFoundIds = uniqueMovieIds.filter((id) => !validIds.has(id));
          throw new BadRequestException(
            `The following movie IDs were not found: ${notFoundIds.join(', ')}`,
          );
        }

        // 🔹 Cập nhật list và movie relations
        return tx.featuredList.update({
          where: { id: listId },
          data: {
            ...listData,
            movies: {
              deleteMany: {}, // Xóa liên kết cũ
              create: uniqueMovieIds.map((movieId, index) => ({
                movieId,
                display_order: index,
              })),
            },
          },
          include: {
            movies: {
              include: { movie: true },
              orderBy: { display_order: 'asc' },
            },
          },
        });
      } else {
        // Không có movieIds -> chỉ update metadata
        return tx.featuredList.update({
          where: { id: listId },
          data: { ...listData },
        });
      }
    });
  }

  async getFeaturedLists() {
    return this.prisma.featuredList.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { movies: true } },
      },
    });
  }

  async getFeaturedListById(listId: string) {
    const list = await this.prisma.featuredList.findUnique({
      where: { id: listId },
      include: {
        // Include các bản ghi trong bảng trung gian
        movies: {
          // Sắp xếp các phim theo thứ tự đã lưu
          orderBy: {
            display_order: 'asc',
          },
          // Từ bảng trung gian, include tiếp thông tin chi tiết của phim
          include: {
            movie: true, // Lấy toàn bộ thông tin phim từ bảng Movie
          },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Featured list with ID ${listId} not found.`);
    }

    // "Làm giàu" dữ liệu trước khi trả về nếu cần
    const moviesInList = list.movies.map((item) => item.movie);
    const enrichedMovies =
      await this.moviesService.enrichAndReturnMovies(moviesInList);

    // Thay thế phim cũ bằng phim đã được làm giàu
    list.movies.forEach((item) => {
      const enrichedVersion = enrichedMovies.find(
        (em) => em.id === item.movieId,
      );
      if (enrichedVersion) {
        item.movie = enrichedVersion;
      }
    });

    return list;
  }

  async deleteFeaturedList(listId: string) {
    try {
      await this.prisma.featuredList.delete({ where: { id: listId } });
      return { message: 'Featured list deleted successfully' };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `Featured list with ID ${listId} not found.`,
        );
      }
      throw error;
    }
  }

  // =====================================
  // === COMMENT MODERATION SECTION ======
  // =====================================

  async getComments(paginationQueryDto: PaginationQueryDto) {
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

    const whereClause: Prisma.CommentWhereInput = {
      is_deleted: false,
      ...(search && {
        content: { contains: search, mode: Prisma.QueryMode.insensitive },
      }),
    };

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, display_name: true, email: true },
          },
          movie: {
            select: { id: true, title: true },
          },
        },
      }),
      this.prisma.comment.count({ where: whereClause }),
    ]);

    return {
      data: comments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteComment(commentId: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: {
        is_deleted: true,
        content: '[This comment has been removed by an administrator]',
      },
    });
  }

  async getDashboardStatistics() {
    // Đếm tổng số users
    const totalUsers = await this.prisma.user.count();

    // Đếm users active (is_active = true)
    const activeUsers = await this.prisma.user.count({
      where: { is_active: true },
    });

    // Đếm tổng số movies
    const totalMovies = await this.prisma.movie.count();

    // Đếm tổng số ratings
    const totalRatings = await this.prisma.rating.count();

    // Đếm tổng số comments
    const totalComments = await this.prisma.comment.count();

    // Đếm comments pending (is_deleted = false)
    const pendingComments = await this.prisma.comment.count({
      where: { is_deleted: false },
    });

    // Lấy 5 users mới nhất
    const recentUsers = await this.prisma.user.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        display_name: true,
        created_at: true,
      },
    });

    return {
      totalUsers,
      activeUsers,
      totalMovies,
      totalRatings,
      totalComments,
      pendingComments,
      recentUsers,
    };
  }
}
