import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../database/user.entity';
import { Permission } from '../../database/permission.entity';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,    
    private readonly authService: AuthService,
  ) {}

  async createUser(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return await this.userRepository.save(user);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email }, relations: ['permissions'] });
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
    try{
      await this.userRepository.update(id, data);
      const updatedUser = await this.userRepository.findOne({ where: { id } });
      if (!updatedUser) {
        throw new Error('User not found');
      }
      return updatedUser;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException(`Error: Could not update user`);
      }
      throw new InternalServerErrorException('Error: Could not update userr');
    }
  }

  async updatePassword(id: string, currentPassword: string, newPassword: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Case 1: If the user is using Google (google provider)
    if (user.provider === "google") {
      // If the user doesn't have a password, allow them to set one
      if (!user.password) {
        // Hash the new password and save it
        await this.userRepository.update(id, { password: await this.authService.hashPassword(newPassword), provider: "combined" });
        return user;
      }
      // If the user already has a password (combined provider), they are allowed to change it
      else {
        // Verify current password if they have one
        const userPassword = user.password;
        if (!userPassword) {
          throw new BadRequestException('User password not set');
        }
        if (await this.authService.comparePasswords(currentPassword, userPassword)) {
          // Hash and update password
          await this.userRepository.update(id, { password: await this.authService.hashPassword(newPassword) });
          return user;
        } else {
          throw new UnauthorizedException('Current password is incorrect');
        }
      }
    }

    // Case 2: If the user is using a local or combined provider
    if (user.provider === "local" || user.provider === "combined") {
      // Verify the current password
      const userPassword = user.password;
      if (!userPassword) {
        throw new BadRequestException('User password not set');
      }
      if (await this.authService.comparePasswords(currentPassword, userPassword)) {
        // Hash and update password
        await this.userRepository.update(id, { password: await this.authService.hashPassword(newPassword) });
        return user;
      } else {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    return user;
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
