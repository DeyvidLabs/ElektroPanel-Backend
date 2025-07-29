import { IsBoolean, IsDate, IsEmail, IsISO8601, IsOptional, isString, IsString, IsUUID, Length } from 'class-validator';
import { Permission } from '../../database/permission.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDTO {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Length(8, 255)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  googleId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  provider?: string;

  permissions: Permission[];
}

export class UpdateUserDTO {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(8, 255)
  password?: string;

  @IsOptional()
  @IsString()
  googleId?: string;

  @IsString()
  @Length(1, 50)
  provider?: string;

  @IsOptional()
  permissions?: Permission[];
}

export class UserResponseDTO {
  @IsUUID()
  id: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  googleId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  permissions: Permission[];

  createdAt: Date;
  updatedAt: Date;
}

export class UserPublicDTO {
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  google: boolean;

  permissions: Permission[];
}

export class UserPrivateDTO {
  @IsUUID()
  id: string;
  
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: new Date().toISOString() })
  createdAt: Date; // No @IsDate() needed for output DTO

  @ApiProperty({ example: 'google' })
  @IsString()
  provider: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  enabled: boolean;

  permissions: Permission[];
}

