import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDisplayNameDTO {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  displayName: string;
}

export class UpdateEmailDTO {
  @ApiProperty({ example: 'new@email.com' })
  @IsEmail()
  newEmail: string;
}

export class EmailExistsDTO {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class UpdatePasswordDTO {
  @ApiProperty({ example: 'currentPassword123' })
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'newPassword456' })
  @MinLength(8)
  newPassword: string;
}

export class DeleteAccountDTO {
  @ApiProperty({ example: 'yourPasswordHere' })
  @IsNotEmpty()
  password: string;
}

export class AdminDeleteAccountDTO {
  @ApiProperty({ example: 'deleteme@example.com' })
  @IsEmail()
  email: string;
}