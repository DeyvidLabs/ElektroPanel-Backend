// src/common/services/jwt-verify.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../database/user.entity';
import { UserService } from '../../features/user/user.service';

@Injectable()
export class JwtVerifyService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService
) {}

  // Generic method to verify token
  verifyToken<T extends object = any>(token: string): T {
    try {
      return this.jwtService.verify<T>(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Decode the token without verifying (to get user info)
  decodeToken<T = any>(token: string): T {
    try {
      return this.jwtService.decode<T>(token) as T;
    } catch (error) {
      throw new UnauthorizedException('Error decoding token');
    }
  }

  async getUserFromToken(token: string): Promise<User | null> {
    try {
        const payload = this.decodeToken(token);
        return await this.userService.getUserById(payload.id);
    } catch (error) {
      throw new UnauthorizedException('Error decoding token');
    }
  }
}
