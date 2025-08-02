import { BadRequestException, ConflictException, forwardRef, Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../database/user.entity';
import { Permission } from '../../database/permission.entity';
import { AuthService } from '../auth/auth.service';
import { LoggingService } from '../../logging/logging.service';
import { Request } from 'express';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,    
    private readonly authService: AuthService,
    private readonly loggingService: LoggingService
  ) {}

  async createUser(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return await this.userRepository.save(user);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email: email }, relations: ['permissions'] });
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id }, relations: ['permissions']  });
    return user;
  }

  async getUserPermissions(id: string): Promise<Permission[] | null> {
    const user = await this.userRepository.findOne({ where: { id }, relations: ['permissions'] });
    return user ? user.permissions : null;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.find({ relations: ['permissions'] });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    try {
      await this.userRepository.update(id, data);
      const updatedUser = await this.userRepository.findOne({ where: { id } });
      if (!updatedUser) throw new Error('User not found');
      return updatedUser;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Error: Could not update user');
      }
      throw new InternalServerErrorException('Error: Could not update user');
    }
  }

  async updateDisplayName(id: string, name: string, req: Request): Promise<User> {
    const oldName = (await this.getUserById(id))?.name;
    const updatedUser = await this.updateUser(id, { name });

    await this.loggingService.logAction(req, {
      service: 'account',
      action: 'user_display_name_changed',
      actor: {
        type: 'user',
      },
      target: {
        type: 'user',
        id: updatedUser.id,
        name: oldName,
      },
      metadata: {
        changedBy: updatedUser.id,
        field: 'name',
      },
    });

    return updatedUser;
  }

  async updateEmail(id: string, payload: { userId: string; email: string; newEmail: string; }, req: Request): Promise<User> {
    const updatedUser = await this.updateUser(id, { email: payload.newEmail });

    await this.loggingService.logAction(req, {
      service: 'account',
      action: 'user_email_changed',
      actor: {
        type: 'user',
      },
      target: {
        type: 'user',
        id: updatedUser.id,
        name: updatedUser.name,
      },
      metadata: {
        changedBy: payload.userId,
        oldEmail: payload.email,
        newEmail: payload.newEmail,
        field: 'email',
        payload: payload
      },
    });

    return updatedUser;
  }

  async updatePassword(id: string, currentPassword: string, newPassword: string, req: Request): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new Error('User not found');

    const hashAndLog = async () => {
      await this.userRepository.update(id, {
        password: await this.authService.hashPassword(newPassword),
        provider: user.provider === 'google' ? 'combined' : user.provider,
      });

      await this.loggingService.logAction(req, {
        service: 'account',
        action: 'user_password_changed',
        actor: {
          type: 'user',
        },
        target: {
          type: 'user',
          id: user.id,
          name: user.name,
        },
        metadata: {
          method: 'manual',
          changedBy: user.id,
        },
      });
    };

    const verifyPassword = async () => {
      if (!user.password) throw new BadRequestException('User password not set');
      const valid = await this.authService.comparePasswords(currentPassword, user.password);
      if (!valid) throw new UnauthorizedException('Current password is incorrect');
    };

    if (user.provider === 'google') {
      if (!user.password) {
        // First password set
        await hashAndLog();
        return user;
      } else {
        await verifyPassword();
        await hashAndLog();
        return user;
      }
    }

    if (user.provider === 'local' || user.provider === 'combined') {
      await verifyPassword();
      await hashAndLog();
      return user;
    }

    throw new BadRequestException('Unsupported provider');
  }


  async adminDeleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }
    await this.userRepository.delete(id);
  }


  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }
    const userPassword = user.password;
    if (!userPassword) {
      throw new Error('User password not set');
    }
    await this.userRepository.delete(id);
  }

  async findUsersByCondition(condition: Partial<User>) {
    return this.userRepository.find({ where: condition });
  }

  async toggleUserStatus(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.enabled = !user.enabled;
    await this.userRepository.save(user);
  }

  async updateUserPermissions(userId: string, permissionIds: string[]): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['permissions'] });
    if (!user) throw new NotFoundException('User not found');

    const permissions = await this.permissionRepository.find({
      where: {
        id: In(permissionIds)
      }
    });
    user.permissions = permissions;
    await this.userRepository.save(user);
  }
  
}
