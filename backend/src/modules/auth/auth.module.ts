import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    // Register User model for this module (Mongoose)
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),

    // Passport — required for @UseGuards(AuthGuard(...))
    PassportModule,

    // JwtModule without global config — each signAsync call passes its own secret
    JwtModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, JwtAccessStrategy, JwtRefreshStrategy],
  // Export JwtAuthGuard-related so other modules can protect their routes
  exports: [JwtAccessStrategy, JwtRefreshStrategy],
})
export class AuthModule {}
