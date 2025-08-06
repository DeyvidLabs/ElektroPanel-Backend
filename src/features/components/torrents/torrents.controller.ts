import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { TorrentDTO } from '../../../shared/dto/torrent.dto'; // optional DTO
import { TorrentFromMagnetDTO } from '../../../shared/dto/torrent.dto';
import { TorrentsService } from './torrents.service';

@ApiBearerAuth('Bearer token')
@ApiTags('Torrents')
@Controller('torrents')
@Permissions('torrents_manage')
@SkipThrottle()
export class TorrentsController {
  constructor(private readonly torrentsService: TorrentsService) {}

  // @Get()
  // @ApiOperation({ summary: 'List all torrents from Transmission' })
  // @ApiOkResponse({ type: [TorrentDTO] })
  // async getAll() {
  //   const torrents = await this.torrentsService.listTorrents();
  //   console.log(torrents[0].dateAdded)
  //   return torrents.map((torrent: TorrentDTO) => ({
  //     id: torrent.id,
  //     name: torrent.name,
  //     totalSize: this.torrentsService.formatBytes(torrent.totalSize),
  //     status: torrent.status,
  //     progress: torrent.percentDone * 100,
  //     dateAdded: torrent.addedDate
  //   }));
  // }

  // @Post('start')
  // @ApiOperation({ summary: 'Start specific or all torrents' })
  // @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs or omit for all' })
  // @HttpCode(HttpStatus.OK)
  // async startTorrents(@Query('ids') ids?: string) {
  //   const parsedIds = ids ? ids.split(',').map(Number) : 'all';
  //   return this.torrentsService.startTorrents(parsedIds);
  // }

  // @Post('stop')
  // @ApiOperation({ summary: 'Stop specific or all torrents' })
  // @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs or omit for all' })
  // @HttpCode(HttpStatus.OK)
  // async stopTorrents(@Query('ids') ids?: string) {
  //   const parsedIds = ids ? ids.split(',').map(Number) : 'all';
  //   return this.torrentsService.pauseTorrents(parsedIds);
  // }

  // @Post('addMagnet')
  // @ApiOperation({ summary: 'Add a magnet link' })
  // async addMagnet(@Body() body: TorrentFromMagnetDTO) {
  //   return this.torrentsService.addMagnet(body.magnet, body.downloadDir);
  // }
}
