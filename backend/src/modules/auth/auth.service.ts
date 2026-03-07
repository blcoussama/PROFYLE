import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Response } from 'express';
import type { StringValue } from 'ms';

import { User, UserDocument } from '../users/schemas/user.schema';
import { EmailService } from './email.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  // ─── Signup ───────────────────────────────────────────────────────────────

  async signup(dto: SignupDto) {
    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.userModel.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
    });

    await this.emailService.sendVerificationEmail(dto.email, verificationToken);

    return {
      message: 'Account created. Check your email to verify your account.',
    };
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.userModel.findOne({
      emailVerificationToken: dto.token,
      emailVerificationExpiry: { $gt: new Date() },
    });

    if (!user)
      throw new BadRequestException('Invalid or expired verification token');

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpiry = null;
    await user.save();

    return { message: 'Email verified successfully. You can now log in.' };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, res: Response) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const { accessToken, refreshToken } = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

    await this.storeRefreshToken(user._id.toString(), refreshToken);
    this.setRefreshTokenCookie(res, refreshToken);

    return {
      accessToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  async refresh(userId: string, refreshToken: string, res: Response) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Access denied');

    const tokenMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatch) throw new UnauthorizedException('Access denied');

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return { accessToken: tokens.accessToken };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(userId: string, res: Response) {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
    res.clearCookie('RefreshToken');
    return { message: 'Logged out successfully' };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email });

    // Always return the same message — don't reveal if email exists
    if (!user)
      return { message: 'If this email exists, a reset link has been sent.' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

    user.passwordResetToken = resetToken;
    user.passwordResetExpiry = resetExpiry;
    await user.save();

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If this email exists, a reset link has been sent.' };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userModel.findOne({
      passwordResetToken: dto.token,
      passwordResetExpiry: { $gt: new Date() },
    });

    if (!user) throw new BadRequestException('Invalid or expired reset token');

    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    user.refreshToken = null; // Invalidate all sessions after password change
    await user.save();

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.config.get<string>('jwt.accessSecret'),
          expiresIn: this.config.get<StringValue>('jwt.accessExpiry'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<StringValue>('jwt.refreshExpiry'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: hashed });
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('RefreshToken', token, {
      httpOnly: true, // Not accessible from JS — prevents XSS token theft
      secure: this.config.get<string>('nodeEnv') === 'production', // HTTPS only in prod
      sameSite: 'lax', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });
  }
}
