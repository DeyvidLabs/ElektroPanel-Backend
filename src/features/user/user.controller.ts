import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  UnauthorizedException,
  Param,
  BadRequestException,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserPrivateDTO, UserPublicDTO, UserResponseDTO } from '../../shared/dto/user.dto';
import {
  UpdateDisplayNameDTO,
  UpdateEmailDTO,
  UpdatePasswordDTO,
  DeleteAccountDTO,
  AdminDeleteAccountDTO,
  EmailExistsDTO
} from '../../shared/dto/user-settings.dto';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { SkipThrottle } from '@nestjs/throttler';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { MailerService } from '../../mail/mailer.service';
import { Response } from 'express';

@ApiBearerAuth('Bearer token')
@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,  
  ) {}

  private getUserFromRequest(req: Request): UserResponseDTO {
    const user = req.user as UserResponseDTO;
    if (!user) throw new UnauthorizedException('User is not authenticated.');
    return user;
  }

  @SkipThrottle()
  @ApiOperation({ summary: "Returns the current user's info." })
  @ApiOkResponse({ description: "Returns a JSON with the user's data" })
  @ApiUnauthorizedResponse({ description: 'Authentication failed' })
  @Get('me')
  async getCurrentUser(@Req() req: Request, @Res() response: Response): Promise<UserPublicDTO | void> {
    const user = this.getUserFromRequest(req);
    const storedUser = await this.userService.getUserById(user.id);
    if(!storedUser){
      response.clearCookie('access_token');
      response.clearCookie('refresh_token');
      return response.redirect(`${process.env.FRONTEND_URL}`);
    }
    response.status(200).json({
      id: user.id,
      name: storedUser.name,
      email: storedUser.email,
      permissions: storedUser.permissions,
      google: storedUser.provider === "google",
    });
  }

  @SkipThrottle()
  @ApiOperation({ summary: "Returns all the users" })
  @ApiOkResponse({ description: "Returns a JSON with the all the user's data" })
  @ApiUnauthorizedResponse({ description: 'Authentication failed' })
  @Get('getAll')
  @Permissions('admin')
  async getAllUsers(@Req() req: Request): Promise<UserPrivateDTO[]> {
    const users = await this.userService.getAllUsers();
    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      provider: user.provider,
      enabled: user.enabled,
      permissions: user.permissions
    }));
  }

  @SkipThrottle()
  @ApiOperation({ summary: "Checks if an email is already in use" })
  @ApiBody({ type: EmailExistsDTO })
  @ApiOkResponse({ description: "Returns true if the email is in use, false otherwise" })
  @ApiUnauthorizedResponse({ description: 'Authentication failed' })
  @Post('emailExists')
  async checkEmailInUse(@Req() req: Request, @Body() dto: { email: string }): Promise<boolean> {
    const user = this.getUserFromRequest(req);
    const existingUser = await this.userService.getUserByEmail(dto.email);
    return !!existingUser && existingUser.id !== user.id;
  }

  @Patch('display-name')
  @ApiOperation({ summary: 'Update display name' })
  @ApiBody({ type: UpdateDisplayNameDTO })
  @ApiOkResponse({ description: 'Display name updated successfully' })
  @Permissions('user')
  async updateDisplayName(@Req() req: Request, @Body() dto: UpdateDisplayNameDTO) {
    const user = this.getUserFromRequest(req);
    await this.userService.updateDisplayName(user.id, dto.displayName, req);
    return { message: 'Display name updated' };
  }

  @Patch('password')
  @ApiOperation({ summary: 'Update password' })
  @ApiBody({ type: UpdatePasswordDTO })
  @ApiOkResponse({ description: 'Password updated successfully' })
  @Permissions('user')
  async updatePassword(@Req() req: Request, @Body() dto: UpdatePasswordDTO) {
    const user = this.getUserFromRequest(req);
    await this.userService.updatePassword(user.id, dto.currentPassword, dto.newPassword, req);
    return { message: 'Password updated' };
  }

  @Delete('delete-email')
  @ApiOperation({ summary: 'Delete account permanently (USER)' })
  @ApiBody({ type: DeleteAccountDTO })
  @ApiOkResponse({ description: 'Mail for account deletion sent successfully' })
  @Permissions('user')
  async deleteAccount(@Req() req: Request, @Body() dto: DeleteAccountDTO) {
    const user = this.getUserFromRequest(req);
    const storedUser = await this.userService.getUserById(user.id);
    if (!storedUser) throw new UnauthorizedException('User not found.');

    const password = dto.password || dto['body']?.password;
    if (!password || !storedUser.password) {
      throw new UnauthorizedException('Password is required.');
    }

    const isPasswordValid = await this.authService.comparePasswords(password, storedUser.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid password.');

    await this.mailerService.sendDeletionEmail(user.email, user.id);
    return { message: 'Deletion email sent. Please check your inbox.' };
  }

  // ✅ NEW ENDPOINT: Get all users where enabled is false
  @Get('awaiting')
  @ApiOperation({ summary: 'Get all disabled users' })
  @ApiOkResponse({
    description: 'Returns all users with enabled = false',
    schema: {
      example: [
        {
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: '2024-12-15T14:12:00Z',
          provider: 'google'
        }
      ]
    }
  })
  @Permissions('admin')
  @SkipThrottle()
  async getDisabledUsers() {
    const users = await this.userService.findUsersByCondition({ enabled: false });
    return users.map(user => ({
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      provider: user.provider,
    }));
  }

  @Patch(':id/toggle-status')
  @Permissions('admin')
  @ApiOperation({ summary: 'Toggle enabled status of a user' })
  @ApiOkResponse({ description: 'User status toggled successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @SkipThrottle()
  async toggleUserStatus(@Param('id') id: string): Promise<void> {
    const user = await this.userService.getUserById(id);
    if (!user) throw new UnauthorizedException('User not found.');

    if (!user.enabled && !user.activatedAt) {
      user.activatedAt = new Date();
      await this.userService.updateUser(id, {
        activatedAt: new Date()
      })
      this.mailerService.sendActivationEmail(user);
    }
    await this.userService.toggleUserStatus(id);
  }

  @Patch(':id/permissions')
  @Permissions('admin')
  @ApiOperation({ summary: 'Update user permissions' })
  @ApiBody({
    schema: {
      example: {
        permissions: ['a5f54f06-3206-463c-8c91-6477107b63b7', 'id-permission-2']
      }
    }
  })
  @ApiOkResponse({ description: 'User permissions updated successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @SkipThrottle()
  async updateUserPermissions(
    @Param('id') userId: string,
    @Body('permissions') permissionIds: string[],
  ): Promise<{ message: string }> {
    await this.userService.updateUserPermissions(userId, permissionIds);
    return { message: 'User permissions updated successfully' };
  }

  @ApiOperation({ summary: 'Request email change (sends confirmation to new email)' })
  @ApiOkResponse({ description: 'Email change request sent. Please verify the new email.' })
  @ApiBadRequestResponse({ description: 'Invalid email or already in use' })
  @Post('email')
  @Permissions('user')
  async requestEmailChange(@Body() body: UpdateEmailDTO, @Req() req, @Res() res: Response) {
    const user = this.getUserFromRequest(req);
    
    const existing = await this.userService.getUserByEmail(body.newEmail);
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const storedUser = await this.userService.getUserById(user.id);
    if (!storedUser) throw new UnauthorizedException('User not found.');

    await this.mailerService.sendMailChange(storedUser.email, user.id, body.newEmail);

    return res.json({ message: 'Email change request sent. Please verify the new email.' });
  }

  @ApiOperation({ summary: 'Deletes the user (ADMIN)' })
  @ApiOkResponse({ description: 'User was deleted successfully' })
  @ApiBadRequestResponse({ description: 'User not found' })
  @Delete('delete')
  @Permissions('admin')
  async deleteByAdmin(@Body() body: AdminDeleteAccountDTO, @Req() req, @Res() res: Response) {
    const user = this.getUserFromRequest(req);

    const existing = await this.userService.getUserByEmail(body.email);
    if (!existing) {
      throw new BadRequestException('User not found');
    }

    const name = existing.name;
    const email = existing.email;
    
    await this.userService.adminDeleteUser(existing.id);
    return res.json({ success: true, message: `The user ${name} with email ${email} was deleted` });
  }

}
