import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../../modules/auth/auth.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no role restriction
    }

    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    let user = request.user;

    if (!user) {
      const authCookie = request.cookies?.auth_user;
      if (!authCookie) {
        throw new UnauthorizedException('Please login to access this resource');
      }
      user = await this.authService.validateUser(authCookie);
      if (!user) {
        throw new UnauthorizedException('Please login to access this resource');
      }
      request.user = user;
    }

    if (!user.role) {
      throw new ForbiddenException('Missing role information');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
