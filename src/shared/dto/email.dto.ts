import { ApiProperty } from '@nestjs/swagger';

class DirectionStats {
  @ApiProperty({ example: 12 })
  in: number;

  @ApiProperty({ example: 25 })
  out: number;
}

export class EmailStatsDTO {
  @ApiProperty({ type: DirectionStats })
  today: DirectionStats;

  @ApiProperty({ type: DirectionStats })
  this_week: DirectionStats;

  @ApiProperty({ type: DirectionStats })
  this_month: DirectionStats;

  @ApiProperty({ type: DirectionStats })
  this_year: DirectionStats;
}

class IPInfoDTO {
  @ApiProperty() country: string;
  @ApiProperty() isp: string;
  @ApiProperty() org: string;
}

export class BlacklistIPInfoDTO {
  @ApiProperty({ example: '192.168.1.10' })
  ip: string;

  @ApiProperty({ example: 10 })
  count: number;

  @ApiProperty({ example: new Date().toISOString() })
  lastSeen: Date;

  @ApiProperty({ type: IPInfoDTO, nullable: true })
  info: IPInfoDTO | null;
}

export class MailUserDTO {
  @ApiProperty({ example: 'contact' })
  username: string;

  @ApiProperty({ example: 'user@example.com' })
  recoveryEmail: string;
}
