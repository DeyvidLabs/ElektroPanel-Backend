import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TorrentsService } from './torrents.service';
import { TorrentDTO } from '../../../shared/dto/torrent.dto';
import { LoggingService } from 'src/logging/logging.service';

@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: ['https://panel.deyvid.dev'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
})
export class TorrentsGateway {
  @WebSocketServer() server: Server;
  private updateInterval: NodeJS.Timeout | null = null;
  private userMap = new Map<string, string>();

  constructor(
    private readonly torrentsService: TorrentsService, 
    private readonly loggingService: LoggingService
  ) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.emitTorrentsUpdate();
  }

  private startLiveUpdatesIfNeeded(torrents: TorrentDTO[]) {
    const isActive = torrents.some(t => [4, 6].includes(t.status));
    if (isActive && !this.updateInterval) {
      this.updateInterval = setInterval(async () => {
        const updated = await this.torrentsService.listTorrents();
        const mapped = updated.map((torrent: TorrentDTO) => ({
          id: torrent.id,
          name: torrent.name,
          totalSize: this.torrentsService.formatBytes(torrent.totalSize),
          totalSizeRaw: torrent.totalSize,
          status: torrent.status,
          progress: torrent.percentDone || 0,
          location: torrent.downloadDir,
          percentDone: Math.round((torrent.percentDone || 0) * 100),
          dateAdded: torrent.addedDate,
          rateDownload: torrent.rateDownload || 0,
          rateUpload: torrent.rateUpload || 0,
          hash: torrent.hash,
          addedBy: this.userMap.get(torrent.id.toString()) || 'Unknown',
        }));

        this.server.emit('torrentsUpdate', mapped);

        const stillActive = updated.some((t: TorrentDTO) => [4, 6].includes(t.status));
        if (!stillActive) {
          clearInterval(this.updateInterval!);
          this.updateInterval = null;
        }
      }, 2000);
    }
  }

  private async emitTorrentsUpdate() {
    const torrents = await this.torrentsService.listTorrents();

    const logs = await this.loggingService.find({
      where: {
        service: 'torrents',
        action: 'torrent_added',
      },
    });

    for (const log of logs) {
      const targetId = log.targetId;
      const actorName = log.actorDisplayName || 'Unknown';
      if (targetId) {
        this.userMap.set(targetId, actorName);
      }
    }

    const mappedTorrents = torrents.map((torrent: TorrentDTO) => ({
      id: torrent.id,
      name: torrent.name,
      totalSize: this.torrentsService.formatBytes(torrent.totalSize),
      totalSizeRaw: torrent.totalSize,
      status: torrent.status,
      progress: torrent.percentDone || 0,
      location: torrent.downloadDir,
      percentDone: Math.round((torrent.percentDone || 0) * 100),
      dateAdded: torrent.addedDate,
      rateDownload: torrent.rateDownload || 0,
      rateUpload: torrent.rateUpload || 0,
      hash: torrent.hash,
      addedBy: this.userMap.get(torrent.id.toString()) || 'Unknown',
    }));

    this.server.emit('torrentsUpdate', mappedTorrents);
    this.startLiveUpdatesIfNeeded(torrents);
  }

  @SubscribeMessage('getTorrents')
  async handleGetTorrents(@ConnectedSocket() client: Socket) {
    await this.emitTorrentsUpdate();
  }

  @SubscribeMessage('addMagnet')
  async handleAddMagnet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { magnetLink: string, downloadDir?: string }
  ) {
    try {
      await this.torrentsService.addMagnet(data.magnetLink, data.downloadDir, client);
      await this.emitTorrentsUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('startTorrents')
  async handleStartTorrents(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ids?: number[] }
  ) {
    const ids = data.ids && data.ids.length > 0 ? data.ids : 'all';
    await this.torrentsService.startTorrents(ids, client);
    await this.emitTorrentsUpdate();
    return { success: true };
  }

  @SubscribeMessage('pauseTorrents')
  async handlePauseTorrents(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ids?: number[] }
  ) {
    const ids = data.ids && data.ids.length > 0 ? data.ids : 'all';
    await this.torrentsService.pauseTorrents(ids, client);
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.emitTorrentsUpdate();
  }

  @SubscribeMessage('changeTorrentLocation')
  async handleChangeLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: number; location: string }
  ) {
    try {
      await this.torrentsService.changeTorrentLocation(data.id, data.location, client);
      await this.emitTorrentsUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('removeTorrents')
  async handleRemoveTorrents(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ids: number[] }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.torrentsService.deleteTorrents(data.ids, client);
      await this.emitTorrentsUpdate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}