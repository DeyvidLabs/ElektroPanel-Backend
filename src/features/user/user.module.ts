import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/user.entity';
import { Permission } from '../../database/permission.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtService } from '@nestjs/jwt';
import { UserSeeder } from '../../../scripts/user.seed';
import { PermissionService } from '../permission/permission.service';
import { AuthService } from '../auth/auth.service';
import { MailerModule } from '../../mail/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Permission]),
    MailerModule
  ],
  controllers: [UserController],
  providers: [
    UserService,
    JwtService,
    UserSeeder,
    PermissionService,
    AuthService,
  ],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}