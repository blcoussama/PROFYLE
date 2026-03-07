import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// Usage in controller:
// @CurrentUser()           → returns the full req.user object
// @CurrentUser('userId')  → returns req.user.userId
// @CurrentUser('email')   → returns req.user.email
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as Record<string, unknown>;
    return data ? user?.[data] : user;
  },
);
