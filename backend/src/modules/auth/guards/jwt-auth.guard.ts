import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Protects routes that require a valid access token (Authorization: Bearer ...)
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {}
