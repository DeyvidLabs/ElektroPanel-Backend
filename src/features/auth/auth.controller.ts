import { Controller, Post, Body, Get, BadRequestException, UnauthorizedException, Res, UseGuards, Req, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBadRequestResponse, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { UserAuthDTO } from '../../shared/dto/register-user.dto';
import { UserService } from '../user/user.service';
import { Request, Response } from 'express';
import { PermissionService } from '../permission/permission.service';
import { Public } from '../../shared/decorators/public.decorator';
import { GoogleOAuthGuard } from '../../shared/guards/google-oauth.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { MailerService } from '../../mail/mailer.service';

@ApiTags('Auth')
@Controller('auth')
@Public()
@SkipThrottle()
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private permissionService: PermissionService,
    private mailerService: MailerService,
  ) {}

  @ApiOperation({ summary: 'Logs out a user' })
  @ApiOkResponse({ description: 'User has been logged out successfully.' })
  @Post('logout') 
  async logout(@Res() response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');

    return response.json({ message: 'User has been logged out successfully.' });
  }

  @ApiOperation({ summary: 'Registers a new user' })
  @ApiCreatedResponse({ description: 'The user has been successfully created.' })
  @ApiBadRequestResponse({ description: 'User already registered' })
  @ApiBody({ type: UserAuthDTO })
  @Post('register')
  async register(@Body() body: UserAuthDTO, @Res() response: Response){
    const existingUser = await this.userService.getUserByEmail(body.email);
    if (existingUser) {
      throw new BadRequestException('User already registered');
    }
  
    const hashedPassword = await this.authService.hashPassword(body.password);
    const userRole = await this.permissionService.findPermission({ name: 'USER' });
    await this.userService.createUser({ 
      email: body.email, 
      name: body.name,
      password: hashedPassword,
      permissions: userRole ? [userRole] : [],
      provider: 'local',
      enabled: false
    });

    // const verificationToken = await this.authService.generateVerificationToken(newUser); // short-lived token

    // await this.authService.sendVerificationEmail(newUser.email, newUser.id, verificationToken);
    return response.status(200).json({
      message: 'User registered successfully. Wait until someone enables your account.'
    })

    // return { success: true, message: 'User registered successfully. Wait until someone enables your account.' };
    // return response.redirect(`${process.env.FRONTEND_URL || 'https://panel.deyvid.dev'}/?message=User registered successfully. Wait until someone enables your account.`);
  }

  @ApiOperation({ summary: 'Log in for an existing user' })
  @ApiCreatedResponse({ description: 'Login was successful.' })
  @ApiBadRequestResponse({ description: 'User does not exist' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or different login method' })
  @ApiBody({ type: UserAuthDTO })
  @Post('login')
  async login(@Body() body: UserAuthDTO, @Res() response: Response, @Req() request: Request) {
    const existingUser = await this.userService.getUserByEmail(body.email);
    if (!existingUser) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!existingUser.enabled) {
      throw new UnauthorizedException('Invalid email or password');
    }
  
    if (!existingUser.password && existingUser.provider && existingUser.provider === 'google') {
      throw new UnauthorizedException(
        'Please login via google.'
      );
    }
  
    if (!body.password || !existingUser.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.authService.comparePasswords(body.password, existingUser.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
  
    const token = await this.authService.generateJwtToken(existingUser);
    const refreshToken = await this.authService.generateRefreshToken(existingUser);

    const { accessTokenOptions, refreshTokenOptions } = this.authService.getCookieOptions();
  
    response.cookie('access_token', token, accessTokenOptions);
    response.cookie('refresh_token', refreshToken, refreshTokenOptions);

    /* 
      This happens only if a user registers via google, then sets a password (if u provide this functionality) so now the user can login via google and via password
      The user has to go from provider=google to provider=combined cause now has the googleId and the password
    */
    if (existingUser.provider && (existingUser.provider === 'google')) {
      await this.userService.updateUser(existingUser.id, {
        provider: 'combined',
     });
    }

    const ipRaw = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    const ip = Array.isArray(ipRaw)
      ? ipRaw[0]
      : typeof ipRaw === 'string'
        ? ipRaw.split(',')[0].trim()
        : ipRaw;

    if (existingUser.ipAddress !== ip) {
      await this.userService.updateUser(existingUser.id, {
        ipAddress: ip,
      });
    }
  
    return response.json({ success: true, message: 'Login successful.' });
    // return response.redirect(`${process.env.FRONTEND_URL || 'https://panel.deyvid.dev'}/dashboard`);
  }

  @SkipThrottle()
  @ApiOperation({ summary: "Checks the validity of the user's access token" })
  @ApiOkResponse({ description: 'The token is valid' })
  @ApiUnauthorizedResponse({ description: 'User is not authenticated.' })
  @Get('validate')
  async validateToken(@Req() request, @Res() response) {
    const accessToken = request.cookies?.access_token;
    try{
      await this.authService.verifyJwtToken(accessToken);
      return response.json({ success: true });
    }
    catch(error){
      const refreshToken = request.cookies?.refresh_token;

      if (!accessToken && !refreshToken) {
        throw new UnauthorizedException('User is not authenticated.');
      }

      try {
        const { token: newAccessToken, refreshToken: newRefreshToken } = await this.authService.refreshTokens(refreshToken);
        const { accessTokenOptions, refreshTokenOptions } = this.authService.getCookieOptions();
    
        response.cookie('access_token', newAccessToken, accessTokenOptions);
        response.cookie('refresh_token', newRefreshToken, refreshTokenOptions);
        
        await this.authService.verifyJwtToken(newAccessToken);
        return response.json({ success: true });
      } catch (error) {
        throw new UnauthorizedException('User is not authenticated.');
      }
    }
  }

  @ApiOperation({ summary: 'Redirects to Google authentication' })
  @ApiOkResponse({ description: 'Successfully authenticated with Google.' })
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() { }

  @ApiOperation({ summary: 'Handles Google authentication callback' })
  @ApiOkResponse({ description: 'Google authentication was successful.' })
  @ApiUnauthorizedResponse({ description: 'Authentication failed' })
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthRedirect(@Req() req, @Res() response: Response) {
    const user = await this.userService.getUserByEmail(req.user.email);
    if (!user) {
      const userRole = await this.permissionService.findPermission({ name: 'USER' });

      await this.userService.createUser({ 
        email: req.user.email, 
        provider: 'google',
        googleId: req.user.googleId,
        permissions: userRole ? [userRole] : [],
        enabled: false,
        name: req.user.name || req.user.email.split('@')[0]
      });
      const message = encodeURIComponent('Account registered. Wait for admin approval.');
      return response.redirect(`${process.env.FRONTEND_URL || 'https://panel.deyvid.dev'}/?message=${message}`);
    }
    else {
      if(!user.googleId){
        await this.userService.updateUser(user.id, {
          googleId: req.user.googleId,
       });
      }
      if(user.password && user.provider !== "combined") {
        await this.userService.updateUser(user.id, {
          provider: 'combined',
       });
      }
    }

    if (!user.enabled) {
      const message = encodeURIComponent('Account already registered. Wait for admin approval.');
      return response.redirect(`${process.env.FRONTEND_URL || 'https://panel.deyvid.dev'}/?error=${message}`);
    }
  
    const token = await this.authService.generateJwtToken(user);
    const refreshToken = await this.authService.generateRefreshToken(user);

    const { accessTokenOptions, refreshTokenOptions } = this.authService.getCookieOptions();
  
    response.cookie('access_token', token, accessTokenOptions);
    response.cookie('refresh_token', refreshToken, refreshTokenOptions);

    const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ip = Array.isArray(ipRaw)
      ? ipRaw[0]
      : typeof ipRaw === 'string'
        ? ipRaw.split(',')[0].trim()
        : ipRaw;

    if (user.ipAddress !== ip) {
      await this.userService.updateUser(user.id, {
        ipAddress: ip,
      });
    }
  
    return response.redirect(`${process.env.FRONTEND_URL}/dashboard` || 'https://panel.deyvid.dev/error?message=Authentication with google was successful, but could not redirect' );
  }


  // @ApiOperation({ summary: 'Verifies a user email using a token' })
  // @ApiOkResponse({ description: 'Email verified successfully' })
  // @ApiBadRequestResponse({ description: 'Invalid or expired verification token' })
  // @Get('verify-email')
  // async verifyEmail(@Query('token') token: string, @Res() res: Response) {
  //   try {
  //     const payload = await this.authService.verifyEmailToken(token);

  //     const user = await this.userService.getUserById(payload.userId);
  //     if (!user) {
  //       throw new BadRequestException('User not found');
  //     }

  //     if (user.enabled) {
  //       return res.redirect(`${process.env.FRONTEND_URL || 'https://panel.deyvid.dev'}/error?message=Email already verified`);
  //     }

  //     await this.userService.updateUser(user.id, { enabled: true });

  //     return res.redirect(`${process.env.FRONTEND_URL || 'https://panel.deyvid.dev'}/dashboard`);
  //   } catch (err) {
  //     return res.redirect(`${process.env.FRONTEND_URL || 'https://panel.deyvid.dev'}/error?message=Invalid or expired verification link`);
  //   }
  // }

  @Get('delete-account')
  @ApiOperation({ summary: 'Deletes user account via email link' })
  @ApiOkResponse({ description: 'Account deleted successfully' })
  @ApiBadRequestResponse({ description: 'Invalid or expired deletion token' })
  async deleteByLink(@Query('token') token: string, @Res() res: Response) {
    try {
      const payload = await this.mailerService.verifyToken(token);

      const user = await this.userService.getUserById(payload.userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // await this.userService.deleteUser(user.id); // Assumi che `deleteUser` accetti ID + password
      await this.userService.updateUser(user.id, { enabled: false, deleted: true });
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      return res.redirect(`${process.env.FRONTEND_URL}`);
    } catch (err) {
      return res.redirect(`${process.env.FRONTEND_URL}/error?message=Invalid or expired deletion link`);
    }
  }

  @ApiOperation({ summary: 'Request email change (sends confirmation to new email)' })
  @ApiOkResponse({ description: 'Email change request sent. Please verify the new email.' })
  @ApiBadRequestResponse({ description: 'Invalid email or already in use' })
  @Get('change-email')
  async updateEmail(@Req() req: Request, @Query('token') token: string, @Res() res: Response) {
    const payload = await this.mailerService.verfiyEmailtoken(token);
    const user = await this.userService.getUserById(payload.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    await this.userService.updateEmail(user.id, payload, req);
    return res.redirect(`${process.env.FRONTEND_URL}/?message=Mail was changed, login again to proceed.`);
  }

}
