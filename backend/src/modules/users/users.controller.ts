import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';
import { UpdateRecruiterProfileDto } from './dto/update-recruiter-profile.dto';
import { UserRole } from './schemas/user.schema';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /users/me ────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMyProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.getMyProfile(userId);
  }

  // ─── PATCH /users/me ──────────────────────────────────────────────────────

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateCandidateProfileDto })
  updateMyProfile(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateCandidateProfileDto | UpdateRecruiterProfileDto,
  ) {
    return this.usersService.updateMyProfile(userId, role, dto);
  }

  // ─── POST /users/me/avatar ────────────────────────────────────────────────

  @Post('me/avatar')
  @ApiOperation({
    summary: 'Upload profile avatar (JPEG, PNG, WebP — max 2MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(userId, file);
  }

  // ─── DELETE /users/me/avatar ──────────────────────────────────────────────

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Delete profile avatar' })
  deleteAvatar(@CurrentUser('userId') userId: string) {
    return this.usersService.deleteAvatar(userId);
  }

  // ─── POST /users/me/cv ────────────────────────────────────────────────────

  @Post('me/cv')
  @ApiOperation({ summary: 'Upload CV PDF (candidates only — max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadCv(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadCv(userId, role, file);
  }

  // ─── GET /users/me/cv-url ─────────────────────────────────────────────────

  @Get('me/cv-url')
  @ApiOperation({
    summary:
      'Get presigned URL to download CV (candidates only — expires in 15 min)',
  })
  getCvPresignedUrl(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.usersService.getCvPresignedUrl(userId, role);
  }

  // ─── DELETE /users/me/cv ──────────────────────────────────────────────────

  @Delete('me/cv')
  @ApiOperation({ summary: 'Delete CV (candidates only)' })
  deleteCv(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.usersService.deleteCv(userId, role);
  }
}
