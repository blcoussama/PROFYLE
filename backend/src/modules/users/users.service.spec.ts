import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { UsersService } from './users.service';
import { User, UserRole } from './schemas/user.schema';

// ─── Module-level mocks ───────────────────────────────────────────────────────

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
  DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234'),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user-id-123',
    firstName: 'Oussama',
    lastName: 'Belcadi',
    email: 'test@example.com',
    role: UserRole.CANDIDATE,
    isEmailVerified: true,
    avatarUrl: null as string | null,
    cvKey: null as string | null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockFile(mimetype: string, size: number): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test-file',
    encoding: '7bit',
    mimetype,
    size,
    buffer: Buffer.from('fake-content'),
    stream: new Readable(),
    destination: '',
    filename: '',
    path: '',
  };
}

// Chain helpers for Mongoose findById
function withSelectChain(returnValue: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(returnValue),
      }),
    }),
  };
}

function withExecChain(returnValue: unknown) {
  return { exec: jest.fn().mockResolvedValue(returnValue) };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let module: TestingModule;
  let service: UsersService;
  let userModel: { findById: jest.Mock };
  let mockS3Send: jest.Mock;
  let mockGetSignedUrl: jest.Mock;

  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      const values: Record<string, string> = {
        'aws.region': 'eu-west-3',
        'aws.bucketName': 'test-bucket',
        'aws.accessKeyId': 'test-key-id',
        'aws.secretAccessKey': 'test-secret-key',
      };
      return values[key] ?? null;
    }),
  };

  beforeEach(async () => {
    userModel = { findById: jest.fn() };

    module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Access private s3 instance directly — most reliable with ts-jest
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    mockS3Send = (service as any).s3.send as jest.Mock;
    mockS3Send.mockResolvedValue({});

    mockGetSignedUrl = getSignedUrl as jest.Mock;
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ─── getMyProfile ──────────────────────────────────────────────────────────

  describe('getMyProfile', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      userModel.findById.mockReturnValue(withSelectChain(null));

      await expect(service.getMyProfile('user-id-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user profile without sensitive fields', async () => {
      const mockUser = createMockUser();
      userModel.findById.mockReturnValue(withSelectChain(mockUser));

      const result = await service.getMyProfile('user-id-123');

      expect(result).toEqual(mockUser);
      expect(userModel.findById).toHaveBeenCalledWith('user-id-123');
    });
  });

  // ─── updateMyProfile ───────────────────────────────────────────────────────

  describe('updateMyProfile', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      userModel.findById.mockReturnValue(withExecChain(null));

      await expect(
        service.updateMyProfile('user-id-123', UserRole.CANDIDATE, {
          headline: 'Dev',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return the updated profile', async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser, headline: 'Full-Stack Developer' };

      userModel.findById
        .mockReturnValueOnce(withExecChain(mockUser))
        .mockReturnValueOnce(withSelectChain(updatedUser));

      const result = await service.updateMyProfile(
        'user-id-123',
        UserRole.CANDIDATE,
        { headline: 'Full-Stack Developer' },
      );

      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(updatedUser);
    });
  });

  // ─── uploadAvatar ──────────────────────────────────────────────────────────

  describe('uploadAvatar', () => {
    it('should throw BadRequestException for invalid mimetype', async () => {
      const file = createMockFile('application/pdf', 1024);

      await expect(service.uploadAvatar('user-id-123', file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if file exceeds 2MB', async () => {
      const file = createMockFile('image/jpeg', 3 * 1024 * 1024);

      await expect(service.uploadAvatar('user-id-123', file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const file = createMockFile('image/jpeg', 1024);
      userModel.findById.mockReturnValue(withExecChain(null));

      await expect(service.uploadAvatar('user-id-123', file)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should upload avatar and return avatarUrl', async () => {
      const file = createMockFile('image/png', 1024);
      const mockUser = createMockUser();
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      const result = await service.uploadAvatar('user-id-123', file);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(result.avatarUrl).toBe(
        'https://test-bucket.s3.eu-west-3.amazonaws.com/avatars/test-uuid-1234.png',
      );
      expect(mockUser.save).toHaveBeenCalledTimes(1);
    });

    it('should delete old avatar from S3 before uploading new one', async () => {
      const file = createMockFile('image/jpeg', 1024);
      const oldAvatarUrl =
        'https://test-bucket.s3.eu-west-3.amazonaws.com/avatars/old-uuid.jpg';
      const mockUser = createMockUser({ avatarUrl: oldAvatarUrl });
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      await service.uploadAvatar('user-id-123', file);

      // First call: DeleteObjectCommand (old), Second call: PutObjectCommand (new)
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });
  });

  // ─── deleteAvatar ──────────────────────────────────────────────────────────

  describe('deleteAvatar', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      userModel.findById.mockReturnValue(withExecChain(null));

      await expect(service.deleteAvatar('user-id-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if no avatar exists', async () => {
      const mockUser = createMockUser({ avatarUrl: null });
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      await expect(service.deleteAvatar('user-id-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete avatar from S3 and clear avatarUrl', async () => {
      const avatarUrl =
        'https://test-bucket.s3.eu-west-3.amazonaws.com/avatars/some-uuid.jpg';
      const mockUser = createMockUser({ avatarUrl });
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      const result = await service.deleteAvatar('user-id-123');

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(mockUser.avatarUrl).toBeNull();
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Avatar deleted successfully.');
    });
  });

  // ─── uploadCv ─────────────────────────────────────────────────────────────

  describe('uploadCv', () => {
    it('should throw ForbiddenException for non-candidate role', async () => {
      const file = createMockFile('application/pdf', 1024);

      await expect(
        service.uploadCv('user-id-123', UserRole.RECRUITER, file),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-PDF file', async () => {
      const file = createMockFile('image/jpeg', 1024);

      await expect(
        service.uploadCv('user-id-123', UserRole.CANDIDATE, file),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file exceeds 5MB', async () => {
      const file = createMockFile('application/pdf', 6 * 1024 * 1024);

      await expect(
        service.uploadCv('user-id-123', UserRole.CANDIDATE, file),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const file = createMockFile('application/pdf', 1024);
      userModel.findById.mockReturnValue(withExecChain(null));

      await expect(
        service.uploadCv('user-id-123', UserRole.CANDIDATE, file),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upload CV and save cvKey', async () => {
      const file = createMockFile('application/pdf', 1024);
      const mockUser = createMockUser();
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      const result = await service.uploadCv(
        'user-id-123',
        UserRole.CANDIDATE,
        file,
      );

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(mockUser.cvKey).toBe('cvs/test-uuid-1234.pdf');
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('CV uploaded successfully.');
    });

    it('should delete old CV from S3 before uploading new one', async () => {
      const file = createMockFile('application/pdf', 1024);
      const mockUser = createMockUser({ cvKey: 'cvs/old-uuid.pdf' });
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      await service.uploadCv('user-id-123', UserRole.CANDIDATE, file);

      // First call: DeleteObjectCommand (old), Second call: PutObjectCommand (new)
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });
  });

  // ─── getCvPresignedUrl ────────────────────────────────────────────────────

  describe('getCvPresignedUrl', () => {
    it('should throw ForbiddenException for non-candidate role', async () => {
      await expect(
        service.getCvPresignedUrl('user-id-123', UserRole.RECRUITER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userModel.findById.mockReturnValue(withExecChain(null));

      await expect(
        service.getCvPresignedUrl('user-id-123', UserRole.CANDIDATE),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no CV uploaded', async () => {
      const mockUser = createMockUser({ cvKey: null });
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      await expect(
        service.getCvPresignedUrl('user-id-123', UserRole.CANDIDATE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return presigned URL with 15 min expiry', async () => {
      const mockUser = createMockUser({ cvKey: 'cvs/test-uuid-1234.pdf' });
      userModel.findById.mockReturnValue(withExecChain(mockUser));
      mockGetSignedUrl.mockResolvedValue('https://presigned.example.com/cv');

      const result = await service.getCvPresignedUrl(
        'user-id-123',
        UserRole.CANDIDATE,
      );

      expect(result.url).toBe('https://presigned.example.com/cv');
      expect(result.expiresIn).toBe(900);
    });
  });

  // ─── deleteCv ─────────────────────────────────────────────────────────────

  describe('deleteCv', () => {
    it('should throw ForbiddenException for non-candidate role', async () => {
      await expect(
        service.deleteCv('user-id-123', UserRole.RECRUITER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userModel.findById.mockReturnValue(withExecChain(null));

      await expect(
        service.deleteCv('user-id-123', UserRole.CANDIDATE),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no CV to delete', async () => {
      const mockUser = createMockUser({ cvKey: null });
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      await expect(
        service.deleteCv('user-id-123', UserRole.CANDIDATE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete CV from S3 and clear cvKey', async () => {
      const mockUser = createMockUser({ cvKey: 'cvs/test-uuid-1234.pdf' });
      userModel.findById.mockReturnValue(withExecChain(mockUser));

      const result = await service.deleteCv('user-id-123', UserRole.CANDIDATE);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(mockUser.cvKey).toBeNull();
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('CV deleted successfully.');
    });
  });
});
