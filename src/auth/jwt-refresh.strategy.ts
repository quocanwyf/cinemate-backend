/* eslint-disable @typescript-eslint/no-unsafe-return */
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
  constructor(private configService: ConfigService) {
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');

    // Validate secret exists
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const authHeader = req.get('Authorization');

    // Validate Authorization header exists
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header not found');
    }

    const refreshToken = authHeader.replace('Bearer', '').trim();

    // Validate refresh token exists
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Trả về cả payload và chính refresh token
    return { ...payload, refreshToken };
  }
}
