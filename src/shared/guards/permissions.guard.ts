import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserService } from "../../features/user/user.service";
import { PermissionDTO } from "../dto/permission.dto";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<(string | string[])[]>('permissions', context.getHandler());
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
  
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User is not authenticated.');
    }

    const userPermissions: PermissionDTO[] = request.user?.permissions; 
    if (!userPermissions) {
      throw new UnauthorizedException('User permissions not found');
    }

    // Normalize user permissions to uppercase
    const userPermissionSet = new Set(
      userPermissions.map(p => p.name.toUpperCase())
    );

    // Check if user is admin
    const isAdmin = userPermissionSet.has('ADMIN');

    // If user is admin, grant access immediately
    if (isAdmin) {
      return true;
    }

    // Check required permissions
    const hasPermission = (permissions: (string | string[])[]) => {
      return permissions.some(permission =>
        Array.isArray(permission)
          ? permission.every(p => this.checkPermission(p, userPermissionSet)) // Tutti i permessi nel gruppo devono essere soddisfatti
          : this.checkPermission(permission, userPermissionSet) // Permesso singolo
      );
    };

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }


    return true;
  }

  private checkPermission(permission: string, userPermissions: Set<string>): boolean {
    // Exact match
    if (userPermissions.has(permission)) {
      return true;
    }

    // Wildcard matching
    if (permission.includes('*')) {
      const regex = new RegExp(`^${permission.replace(/\*/g, '.*')}$`);
      return Array.from(userPermissions).some(userPerm => regex.test(userPerm));
    }

    return false;
  }
}