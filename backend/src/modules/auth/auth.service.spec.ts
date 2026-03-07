import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';

import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { User, UserRole } from '../users/schemas/user.schema';

// ─── Auto-mock bcryptjs ────────────────────────────────────────────────────
// Jest remplace hash() et compare() par des jest.fn() — pas de vrai bcrypt
// pendant les tests (pas de calcul CPU, résultat contrôlé)
jest.mock('bcryptjs');

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Crée un faux document Mongoose User avec un save() mockable. */
function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user-id-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: '$2b$12$hashedpassword',
    role: UserRole.CANDIDATE,
    isEmailVerified: true,
    emailVerificationToken: 'valid-token',
    emailVerificationExpiry: new Date(Date.now() + 86_400_000), // +24h
    passwordResetToken: null,
    passwordResetExpiry: null,
    refreshToken: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── Suite principale ──────────────────────────────────────────────────────

describe('AuthService', () => {
  let module: TestingModule;
  let service: AuthService;

  // Mocks des dépendances injectées
  let userModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let emailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };

  // Faux objet Response Express (on vérifie cookie() et clearCookie())
  let mockRes: Partial<Response>;

  beforeEach(async () => {
    // Créer des mocks frais avant chaque test
    userModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-jwt-token'),
    };

    configService = {
      // get() retourne une chaîne générique — suffisant pour nos tests
      get: jest.fn().mockReturnValue('test-value'),
    };

    emailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Valeurs par défaut de bcrypt pour chaque test
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedpassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(async () => {
    await module.close(); // Ferme le TestingModule — évite le "worker process" warning
    jest.clearAllMocks();
  });

  // ─── signup ─────────────────────────────────────────────────────────────

  describe('signup', () => {
    const signupDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password123!',
      role: UserRole.CANDIDATE,
    };

    it('should throw ConflictException if email already in use', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());

      await expect(service.signup(signupDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should hash the password with bcrypt (salt 12)', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue(createMockUser());

      await service.signup(signupDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
    });

    it('should create the user with hashed password and verification token', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue(createMockUser());

      await service.signup(signupDto);

      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: '$2b$12$hashedpassword',
          role: UserRole.CANDIDATE,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          emailVerificationToken: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          emailVerificationExpiry: expect.any(Date),
        }),
      );
    });

    it('should send verification email with the generated token', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue(createMockUser());

      await service.signup(signupDto);

      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        'john@example.com',
        expect.any(String),
      );
    });

    it('should return a success message', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue(createMockUser());

      const result = await service.signup(signupDto);

      expect(result).toEqual({
        message: 'Account created. Check your email to verify your account.',
      });
    });
  });

  // ─── verifyEmail ─────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should throw BadRequestException if token is invalid or expired', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'bad-token' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark email as verified and clear token fields', async () => {
      const userDoc = createMockUser({ isEmailVerified: false });
      userModel.findOne.mockResolvedValue(userDoc);

      await service.verifyEmail({ token: 'valid-token' });

      expect(userDoc.isEmailVerified).toBe(true);
      expect(userDoc.emailVerificationToken).toBeNull();
      expect(userDoc.emailVerificationExpiry).toBeNull();
      expect(userDoc.save).toHaveBeenCalled();
    });

    it('should return a success message', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());

      const result = await service.verifyEmail({ token: 'valid-token' });

      expect(result).toEqual({
        message: 'Email verified successfully. You can now log in.',
      });
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = { email: 'john@example.com', password: 'Password123!' };

    it('should throw UnauthorizedException if user does not exist', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.login(loginDto, mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.login(loginDto, mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      userModel.findOne.mockResolvedValue(
        createMockUser({ isEmailVerified: false }),
      );
      // password matches, but email not verified

      await expect(
        service.login(loginDto, mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return accessToken and user data on success', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(loginDto, mockRes as Response);

      expect(result).toEqual({
        accessToken: 'access-token',
        user: {
          id: 'user-id-123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: UserRole.CANDIDATE,
        },
      });
    });

    it('should set httpOnly refresh token cookie on success', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await service.login(loginDto, mockRes as Response);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'RefreshToken',
        'refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should store hashed refresh token in DB', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await service.login(loginDto, mockRes as Response);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-id-123', {
        refreshToken: '$2b$12$hashedpassword',
      });
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        service.refresh('user-id', 'some-token', mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if no refresh token is stored', async () => {
      userModel.findById.mockResolvedValue(
        createMockUser({ refreshToken: null }),
      );

      await expect(
        service.refresh('user-id', 'some-token', mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if stored token does not match', async () => {
      userModel.findById.mockResolvedValue(
        createMockUser({ refreshToken: '$2b$10$hashed' }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.refresh('user-id', 'wrong-token', mockRes as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return a new accessToken on success', async () => {
      userModel.findById.mockResolvedValue(
        createMockUser({ refreshToken: '$2b$10$hashed' }),
      );
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refresh(
        'user-id-123',
        'valid-refresh-token',
        mockRes as Response,
      );

      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('should rotate refresh token (store new hash and set new cookie)', async () => {
      userModel.findById.mockResolvedValue(
        createMockUser({ refreshToken: '$2b$10$hashed' }),
      );
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      await service.refresh(
        'user-id-123',
        'valid-refresh-token',
        mockRes as Response,
      );

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-id-123', {
        refreshToken: '$2b$12$hashedpassword',
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'RefreshToken',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should clear the refresh token in the database', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.logout('user-id-123', mockRes as Response);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('user-id-123', {
        refreshToken: null,
      });
    });

    it('should clear the RefreshToken cookie', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.logout('user-id-123', mockRes as Response);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('RefreshToken');
    });

    it('should return a success message', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue(undefined);

      const result = await service.logout('user-id-123', mockRes as Response);

      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should return the same message if email is not found (prevents email enumeration)', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'unknown@example.com',
      });

      expect(result).toEqual({
        message: 'If this email exists, a reset link has been sent.',
      });
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should set a reset token and expiry on the user', async () => {
      const userDoc = createMockUser({
        passwordResetToken: null,
        passwordResetExpiry: null,
      });
      userModel.findOne.mockResolvedValue(userDoc);

      await service.forgotPassword({ email: 'john@example.com' });

      expect(userDoc.passwordResetToken).toBeTruthy();
      expect(userDoc.passwordResetExpiry).toBeInstanceOf(Date);
      expect(userDoc.save).toHaveBeenCalled();
    });

    it('should send a password reset email', async () => {
      const userDoc = createMockUser();
      userModel.findOne.mockResolvedValue(userDoc);

      await service.forgotPassword({ email: 'john@example.com' });

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'john@example.com',
        expect.any(String),
      );
    });

    it('should return a success message when email is found', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());

      const result = await service.forgotPassword({
        email: 'john@example.com',
      });

      expect(result).toEqual({
        message: 'If this email exists, a reset link has been sent.',
      });
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should throw BadRequestException if token is invalid or expired', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should hash the new password with bcrypt (salt 12)', async () => {
      const userDoc = createMockUser({
        passwordResetToken: 'valid-token',
        passwordResetExpiry: new Date(Date.now() + 3_600_000),
      });
      userModel.findOne.mockResolvedValue(userDoc);

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPass123!',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!', 12);
    });

    it('should clear reset token, expiry, and refreshToken (invalidate all sessions)', async () => {
      const userDoc = createMockUser({
        passwordResetToken: 'valid-token',
        passwordResetExpiry: new Date(Date.now() + 3_600_000),
        refreshToken: '$2b$10$somehash',
      });
      userModel.findOne.mockResolvedValue(userDoc);

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPass123!',
      });

      expect(userDoc.passwordResetToken).toBeNull();
      expect(userDoc.passwordResetExpiry).toBeNull();
      expect(userDoc.refreshToken).toBeNull();
      expect(userDoc.save).toHaveBeenCalled();
    });

    it('should return a success message', async () => {
      userModel.findOne.mockResolvedValue(
        createMockUser({
          passwordResetToken: 'valid-token',
          passwordResetExpiry: new Date(Date.now() + 3_600_000),
        }),
      );

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPass123!',
      });

      expect(result).toEqual({
        message: 'Password reset successfully. Please log in.',
      });
    });
  });
});
