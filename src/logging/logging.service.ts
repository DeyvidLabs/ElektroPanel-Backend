import { BadRequestException, forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLog } from '../database/systemlog.entity';
import { ActorType, ServiceType } from '../shared/interfaces/systemlog.interface';
import { UserLoggingDTO } from '../shared/dto/user.dto';
import { Request } from 'express';
import { UserService } from '../features/user/user.service';

@Injectable()
export class LoggingService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  private async extractUserFromRequest(req: Request): Promise<UserLoggingDTO> {
    const requestUser = req.user as UserLoggingDTO;
    if (!requestUser) throw new UnauthorizedException('User is not authenticated.');
    
    const userFromDb = await this.userService.getUserById(requestUser.id);
    if (!userFromDb) throw new UnauthorizedException('User is not authenticated.');

    const rawIp =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      '';

    const ip =
      typeof rawIp === 'string' && rawIp.startsWith('::ffff:')
        ? rawIp.replace('::ffff:', '')
        : rawIp?.toString();

    return {
      id: userFromDb.id,
      name: userFromDb.name,
      email: userFromDb.email,
      createdAt: userFromDb.createdAt,
      updatedAt: userFromDb.updatedAt,
      ipAddress: ip,
    };
  }

  async logAction(req: Request, options: {
    service: ServiceType;
    action: string;
    actor: {
      type: ActorType;
      id?: string;
      displayName?: string;
      ip?: string;
    };
    target?: {
      type: string;
      id: string;
      name?: string;
    };
    metadata?: Record<string, any>;
  }): Promise<SystemLog> {
    const user = options.metadata?.payload?.userId
      ? await this.userService.getUserById(options.metadata.payload.userId)
      : await this.extractUserFromRequest(req);

    if(!user){
      throw new BadRequestException("User cannot be null.")
    }

    const log = this.logRepo.create({
      service: options.service,
      action: options.action,
      actorType: options.actor.type,
      actorId: user.id || options.actor.id,
      actorDisplayName: user.name || options.actor.displayName,
      actorIp: user.ipAddress || options.actor.ip,
      targetType: options.target?.type,
      targetId: options.target?.id,
      targetName: options.target?.name,
      metadata: options.metadata ?? {},
    });

    return this.logRepo.save(log);
  }

  async getAllLogs(): Promise<SystemLog[]> {
    return this.logRepo
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .getMany();
  }
}
