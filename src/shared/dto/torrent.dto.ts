import { IsNotEmpty, IsNumber, IsString, IsOptional, IsIn, IsUUID, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class TorrentDTO {
  @ApiProperty({ description: 'Torrent ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'Torrent name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Status (e.g. downloading, seeding, paused)' })
  @IsNumber()
  status: number;

  @ApiProperty({ description: 'The date the torrent was added' })
  @IsNumber()
  addedDate: number;

  @ApiProperty({ description: 'Total size in bytes' })
  @IsNumber()
  totalSizeRaw: number;

  @ApiProperty({ description: 'Total size formatted' })
  @IsNumber()
  totalSize: number;

  @ApiProperty({ description: 'Download progress (0 to 1)' })
  @IsNumber()
  @IsOptional()
  percentDone: number;

  @ApiProperty({ description: 'Magnet link' })
  @IsString()
  @IsOptional()
  magnetLink?: string;

  @ApiProperty({ description: 'Formatted rate of download (KB/s, MB/s)' })
  @IsString()
  rateDownload?: string;

  @ApiProperty({ description: 'Formatted rate of upload (KB/s, MB/s)' })
  @IsString()
  rateUpload?: string;

  @ApiProperty({ description: 'Path of the torrent' })
  @IsString()
  downloadDir?: string;

  @ApiProperty({ description: 'Hash string of the torrent' })
  @IsString()
  @IsOptional()
  hash?: string;

  @ApiProperty({ description: 'Display name of the user who added the torrent' })
  @IsString()
  addedBy: string;
}

export class TorrentFromMagnetDTO {
  @ApiProperty({ description: 'Magnet URI' })
  magnet: string;

  @ApiProperty({ description: 'Download directory', required: false })
  downloadDir?: string;
}
