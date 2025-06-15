import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const urls = process.env.GOOGLE_CALLBACK_URLS?.split(',');
    if(!urls) {
      throw new Error('GOOGLE_CALLBACK_URLS environment variable is not set');
    }
    const callbackURL = process.env.NODE_ENV === 'development' ? urls[0] : urls[1];
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, displayName } = profile;
    const user = {
      googleId: id,
      email: emails && emails[0].value,
      name: displayName,
      accessToken,
      refreshToken,
    };
    return done(null, user);
  }
}
