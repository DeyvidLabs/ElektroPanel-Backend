import { Injectable, BadRequestException } from '@nestjs/common';
import { UserService } from '../src/features/user/user.service';
import { PermissionService } from '../src/features/permission/permission.service';
import * as bcrypt from 'bcrypt';
import { Permission } from '../src/database/permission.entity';

@Injectable()
export class UserSeeder {
  constructor(
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  public async seedUser(argv: { email: string; name:string; password: string; permission: string }): Promise<void> {
    const { email, name, password, permission } = argv;
    const permissionNames = permission.split(',').map((name: string) => name.trim().toUpperCase());

    const permissionEntities = await Promise.all(
      permissionNames.map((permissionName) =>
        this.permissionService.findPermission({ name: permissionName })
      )
    );
    
    if (permissionEntities.some(perm => !perm)) {
      console.error(`❌ One or more specified permissions do not exist: ${permissionNames.join(', ')}`);
      const availablePermissions = await this.permissionService.findAll();
      console.info(`Available permissions are: ${availablePermissions.map(perm => perm.name).join(', ')}`);
      return;
    }

    const existingUser = await this.userService.getUserByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User already registered');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    const validPermissions = permissionEntities.filter((perm): perm is Permission => perm !== null);

    const newUser = await this.userService.createUser({
      email,
      password: hashedPassword,
      permissions: validPermissions,
      provider: 'local',
      enabled: true,
      name: name
    });

    console.log(`✅ Created user (${name}) with email: ${email}`);
    console.log(`User ID: ${newUser.id}`);
  }

  public async seedGoogleUser(argv: { email: string; name:string; permission: string }): Promise<void> {
    const { email, name, permission } = argv;
    const permissionNames = permission.split(',').map((name: string) => name.trim().toUpperCase());

    const permissionEntities = await Promise.all(
      permissionNames.map((permissionName) =>
        this.permissionService.findPermission({ name: permissionName })
      )
    );
    
    if (permissionEntities.some(perm => !perm)) {
      console.error(`❌ One or more specified permissions do not exist: ${permissionNames.join(', ')}`);
      const availablePermissions = await this.permissionService.findAll();
      console.info(`Available permissions are: ${availablePermissions.map(perm => perm.name).join(', ')}`);
      return;
    }

    const existingUser = await this.userService.getUserByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User already registered');
    }
    
    const validPermissions = permissionEntities.filter((perm): perm is Permission => perm !== null);

    const newUser = await this.userService.createUser({
      email,
      permissions: validPermissions,
      provider: 'google',
      enabled: true,
      name: name

    });

    console.log(`✅ Created user (${name}) with email: ${email}`);
    console.log(`User ID: ${newUser.id}`);
  }
}

