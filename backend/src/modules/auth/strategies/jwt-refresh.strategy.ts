import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      // Extract refresh token from httpOnly cookie (not Authorization header)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string>)?.['RefreshToken'] ?? null,
      ]),
      // ! asserts non-null — Joi validation guarantees this exists at startup
      secretOrKey: config.get<string>('jwt.refreshSecret')!,
      // `as const` helps TypeScript resolve the StrategyOptionsWithRequest overload
      passReqToCallback: true as const,
    });
  }

  // Called after signature verified — req.user gets { userId, refreshToken }
  validate(req: Request, payload: { sub: string }) {
    const refreshToken = (req.cookies as Record<string, string>)?.[
      'RefreshToken'
    ];
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

    // Return both userId and the raw token — service will compare against DB hash
    return { userId: payload.sub, refreshToken };
  }
}
