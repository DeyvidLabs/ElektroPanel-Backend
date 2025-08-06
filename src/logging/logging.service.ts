import { BadRequestException, forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { SystemLog } from '../database/systemlog.entity';
import { ActorType, ServiceType } from '../shared/interfaces/systemlog.interface';
import { UserLoggingDTO } from '../shared/dto/user.dto';
import { Request } from 'express';
import { UserService } from '../features/user/user.service';
import { Socket } from 'socket.io';
import * as cookie from 'cookie';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class LoggingService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {
      console.log('logRepo', this.logRepo); // dovrebbe mostrare Repository{} e non undefined

  }

    // Decode the token without verifying (to get user info)
  decodeToken<T = any>(token: string): T {
      try {
        return this.jwtService.decode<T>(token) as T;
      } catch (error) {
        throw new UnauthorizedException('Error decoding token');
      }
  }

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

  private async extractUserFromSocket(client: Socket): Promise<UserLoggingDTO> {
    const cookies = cookie.parse(client.handshake.headers.cookie || '');
    const token = cookies['access_token'];
    if (!token) throw new UnauthorizedException('No token provided');

    let decodedToken: any;
    try {
      decodedToken = this.decodeToken(token);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userFromDb = await this.userService.getUserById(decodedToken.id); // assuming sub is the user ID in the token

    if (!userFromDb) throw new UnauthorizedException('User not found in the database');

    // Now let's extract the IP address from the headers (similar to your HTTP logic)
    const rawIp =
      client.handshake.headers['cf-connecting-ip'] ||
      client.handshake.headers['x-forwarded-for'] ||
      client.conn.remoteAddress ||
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

  async logActionFromSocket(socket: Socket, options: {
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
  }
  ): Promise<SystemLog> {
    const user = await this.extractUserFromSocket(socket);

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

  async logDirect(options: {
    service: ServiceType;
    action: string;
    actor: {
      type: ActorType;
      id?: string;
      displayName?: string;
    };
    target?: {
      type: string;
      id: string;
      name?: string;
    };
    metadata?: Record<string, any>;
  }
  ): Promise<SystemLog> {

    const log = this.logRepo.create({
      service: options.service,
      action: options.action,
      actorType: options.actor.type,
      actorId: options.actor.id,
      actorDisplayName: options.actor.displayName,
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

  async find(options?: FindManyOptions<SystemLog>): Promise<SystemLog[]> {
    return await this.logRepo.find(options);
  }
}
