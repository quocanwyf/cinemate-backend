/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FileInterceptor } from '@nestjs/platform-express/multer/interceptors/file.interceptor';

@ApiTags('profile') // Đặt tên tag là 'profile' cho gọn
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('profile') // Đổi đường dẫn controller thành /profile
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put()
  @ApiOperation({ summary: 'Update user profile' })
  updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    const userId = req.user.id;
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    const userId = req.user.id;
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Put('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB in bytes
      fileFilter: (req, file, callback) => {
        // Chỉ chấp nhận các file có mimetype là image/jpeg, image/png, image/gif
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          // Nếu không phải, từ chối file với một lỗi
          return callback(
            new BadRequestException(
              'Only image files (jpeg, png, gif) are allowed!',
            ),
            false,
          );
        }
        // Nếu hợp lệ, chấp nhận file
        callback(null, true);
      },
    }),
  ) // Sử dụng Interceptor để xử lý file
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'User avatar image file',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Update user avatar' })
  updateAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    const userId = req.user.id;
    if (!file) {
      throw new BadRequestException('Avatar file is required.');
    }
    return this.usersService.updateAvatar(userId, file);
  }
}
