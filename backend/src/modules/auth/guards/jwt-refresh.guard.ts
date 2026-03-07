import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Protects the /auth/refresh route — validates the RefreshToken cookie
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
