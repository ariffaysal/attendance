import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Check if user is authenticated via cookie
    const authCookie = request.cookies?.auth_user;
    
    if (!authCookie) {
      throw new UnauthorizedException('Please login to access this resource');
    }
    
    return true;
  }
}
