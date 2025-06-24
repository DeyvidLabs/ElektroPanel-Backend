import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDisplayNameDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  displayName: string;
}

export class UpdateEmailDto {
  @ApiProperty({ example: 'new@email.com' })
  @IsEmail()
  newEmail: string;
}

export class UpdatePasswordDto {
  @ApiProperty({ example: 'currentPassword123' })
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'newPassword456' })
  @MinLength(8)
  newPassword: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'yourPasswordHere' })
  @IsNotEmpty()
  password: string;
}

export class AdminDeleteAccountDto {
  @ApiProperty({ example: 'deleteme@example.com' })
  @IsEmail()
  email: string;
}