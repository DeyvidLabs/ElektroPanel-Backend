import * as dotenv from 'dotenv';
dotenv.config({path: '../.env'});
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './features/user/user.service';
import { AuthModule } from './features/auth/auth.module';
import { User } from './database/user.entity';
import { APP_GUARD } from '@nestjs/core';
import { Permission } from './database/permission.entity';
import { PermissionsGuard } from './shared/guards/permissions.guard';
import { UserModule } from './features/user/user.module';
import { PermissionService } from './features/permission/permission.service';
import { PermissionModule } from './features/permission/permission.module';
import { AuthGuard } from './shared/guards/auth.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ProxmoxModule } from './features/components/proxmox/proxmox.module';
import { MailerModule } from './mail/mailer.module';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggingModule } from './logging/logging.module';
import { SystemLog } from './database/systemlog.entity';
import { TorrentsModule } from './features/components/torrents/torrents.module';
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      url: process.env.DATABASE_URL,
      entities: [User, Permission, SystemLog],
      // synchronize: process.env.NODE_ENV === "development",
      synchronize: true,
      // logging: process.env.NODE_ENV === "development",
    }),
    AuthModule,
    UserModule,
    MailerModule,
    PermissionModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    ScheduleModule.forRoot(),
    ProxmoxModule,
    LoggingModule,
    TorrentsModule,
  ],
  providers: [
    UserService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,  // Throttling first
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,  // Permissions second
    },
    PermissionService,
  ]
})
export class AppModule  { }
