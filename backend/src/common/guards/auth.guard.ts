import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    
    // Check if user is authenticated via cookie
    const authCookie = request.cookies?.auth_user;
    
    if (!authCookie) {
      throw new UnauthorizedException('Please login to access this resource');
    }

    const user = await this.authService.validateUser(authCookie);
    if (!user) {
      throw new UnauthorizedException('Please login to access this resource');
    }

    request.user = user;
    return true;
  }
}
