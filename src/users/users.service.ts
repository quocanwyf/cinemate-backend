import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
}
