import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';
import { UpdateRecruiterProfileDto } from './dto/update-recruiter-profile.dto';

@Injectable()
export class UsersService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {
    this.region = this.config.get<string>('aws.region')!;
    this.bucket = this.config.get<string>('aws.bucketName')!;
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('aws.accessKeyId')!,
        secretAccessKey: this.config.get<string>('aws.secretAccessKey')!,
      },
    });
  }

  // ─── Get profile ──────────────────────────────────────────────────────────

  async getMyProfile(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(userId)
      .select(
        '-password -refreshToken -emailVerificationToken -emailVerificationExpiry -passwordResetToken -passwordResetExpiry',
      )
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user as UserDocument;
  }

  // ─── Update profile ───────────────────────────────────────────────────────

  async updateMyProfile(
    userId: string,
    role: UserRole,
    dto: UpdateCandidateProfileDto | UpdateRecruiterProfileDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, dto);
    await user.save();

    const updated = await this.userModel
      .findById(userId)
      .select(
        '-password -refreshToken -emailVerificationToken -emailVerificationExpiry -passwordResetToken -passwordResetExpiry',
      )
      .lean()
      .exec();

    return updated as UserDocument;
  }

  // ─── Upload avatar ────────────────────────────────────────────────────────

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG and WebP are allowed.',
      );
    }

    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      throw new BadRequestException('File too large. Maximum size is 2MB.');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete old avatar from S3 if it exists
    if (user.avatarUrl) {
      await this.deleteFromS3(user.avatarUrl);
    }

    const extension = file.mimetype.split('/')[1];
    const key = `avatars/${uuidv4()}.${extension}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const avatarUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    user.avatarUrl = avatarUrl;
    await user.save();

    return { avatarUrl };
  }

  // ─── Delete avatar ────────────────────────────────────────────────────────

  async deleteAvatar(userId: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.avatarUrl) {
      throw new BadRequestException('No avatar to delete.');
    }

    await this.deleteFromS3(user.avatarUrl);
    user.avatarUrl = null;
    await user.save();

    return { message: 'Avatar deleted successfully.' };
  }

  // ─── Upload CV (candidates only) ──────────────────────────────────────────

  async uploadCv(
    userId: string,
    role: UserRole,
    file: Express.Multer.File,
  ): Promise<{ message: string }> {
    if (role !== UserRole.CANDIDATE) {
      throw new ForbiddenException('Only candidates can upload a CV.');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Invalid file type. Only PDF is allowed.');
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new BadRequestException('File too large. Maximum size is 5MB.');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete old CV from S3 if it exists
    if (user.cvKey) {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: user.cvKey }),
      );
    }

    const key = `cvs/${uuidv4()}.pdf`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: 'application/pdf',
      }),
    );

    user.cvKey = key;
    await user.save();

    return { message: 'CV uploaded successfully.' };
  }

  // ─── Get CV presigned URL (candidates only) ───────────────────────────────

  async getCvPresignedUrl(
    userId: string,
    role: UserRole,
  ): Promise<{ url: string; expiresIn: number }> {
    if (role !== UserRole.CANDIDATE) {
      throw new ForbiddenException('Only candidates can access a CV.');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.cvKey) {
      throw new BadRequestException('No CV uploaded yet.');
    }

    const expiresIn = 900; // 15 minutes

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: user.cvKey }),
      { expiresIn },
    );

    return { url, expiresIn };
  }

  // ─── Delete CV (candidates only) ──────────────────────────────────────────

  async deleteCv(userId: string, role: UserRole): Promise<{ message: string }> {
    if (role !== UserRole.CANDIDATE) {
      throw new ForbiddenException('Only candidates can delete a CV.');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.cvKey) {
      throw new BadRequestException('No CV to delete.');
    }

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: user.cvKey }),
    );

    user.cvKey = null;
    await user.save();

    return { message: 'CV deleted successfully.' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async deleteFromS3(avatarUrl: string): Promise<void> {
    // Extract the S3 key from the full URL
    // URL format: https://<bucket>.s3.<region>.amazonaws.com/<key>
    const url = new URL(avatarUrl);
    const key = url.pathname.slice(1); // remove leading "/"

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
