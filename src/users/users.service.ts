import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        display_name: dto.display_name,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = updatedUser;
    return result;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { oldPassword, newPassword } = dto;

    // 1. Lấy thông tin user, bao gồm cả password_hash
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // (Kiểm tra này gần như không bao giờ xảy ra vì đã qua JwtGuard)
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.password_hash) {
      throw new UnauthorizedException(
        'Cannot change password for social login account',
      );
    }

    // 2. So sánh mật khẩu cũ
    const isPasswordMatching = await bcrypt.compare(
      oldPassword,
      user.password_hash,
    );
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Old password does not match');
    }

    // 3. Hash mật khẩu mới và cập nhật
    const saltRounds = 10;
    const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newHashedPassword,
      },
    });

    return { message: 'Password changed successfully' };
  }
}
