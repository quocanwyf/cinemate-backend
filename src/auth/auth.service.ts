import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // --- HÀM ĐĂNG KÝ ---
  async register(registerDto: RegisterDto) {
    const { email, password, display_name } = registerDto;

    // 1. Kiểm tra xem email đã tồn tại chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 2. Hash mật khẩu
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Tạo người dùng mới trong database
    const newUser = await this.prisma.user.create({
      data: {
        email,
        display_name,
        password_hash: hashedPassword,
      },
    });

    // 4. Trả về thông tin người dùng (loại bỏ mật khẩu)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = newUser;
    return result;
  }

  // --- HÀM ĐĂNG NHẬP ---
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Tìm người dùng bằng email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. So sánh mật khẩu
    const isPasswordMatching = await bcrypt.compare(
      password,
      String(user.password_hash),
    );

    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Nếu mật khẩu đúng, tạo JWT payload
    const payload = { sub: user.id, email: user.email };

    // 4. Ký và tạo access_token
    const accessToken = await this.jwtService.signAsync(payload);

    // TODO: Logic tạo và lưu Refresh Token sẽ được thêm ở đây sau

    // 5. Trả về access_token
    return {
      access_token: accessToken,
    };
  }
}
