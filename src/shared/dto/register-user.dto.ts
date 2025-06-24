import { ApiProperty } from '@nestjs/swagger';

export class UserAuthDTO {
  @ApiProperty({ example: 'user@example.com', description: 'The email address of the user' })
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'The name of the user' })
  name: string;

  @ApiProperty({ example: 'strongPassword123', description: 'The password for the user account' })
  password: string;
}
