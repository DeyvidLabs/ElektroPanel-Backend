import { Injectable, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import { LoggingService } from '../../../logging/logging.service';
import { Socket } from 'socket.io';
@Injectable()
export class TorrentsService implements OnModuleInit {
  private readonly baseURL = 'http://192.168.1.200:6691/transmission/rpc';
  client: AxiosInstance;
  sessionId: string | null = null;

  constructor(private loggingService: LoggingService) {
    this.client = axios.create({ baseURL: this.baseURL });
  }

  
  async onModuleInit() {
    await this.syncMissingAddedLogs(); // ora logRepo sarà inizializzato
  }

  /**
   * Internal method to send RPC with sessionId
   */
  private async request(method: string, argumentsData: any = {}) {
    const payload = {
      method,
      arguments: argumentsData,
    };

    try {
      const response = await this.client.post('', payload, {
        headers: this.sessionId ? { 'X-Transmission-Session-Id': this.sessionId } : {},
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        this.sessionId = error.response.headers['x-transmission-session-id'];
        return this.request(method, argumentsData); // Retry
      }
      throw new Error(`Transmission RPC failed: ${error.message}`);
    }
  }

  /**
   * Add a torrent via magnet URL and log info
   */
  async addMagnet(magnetLink: string, downloadDir = '/media/torrents', socket: Socket): Promise<void> {
    try {
      await this.request('torrent-add', {
        filename: magnetLink,
        'download-dir': downloadDir,
      });

      // console.log('✅ Magnet added. Waiting for metadata...');
      await new Promise(resolve => setTimeout(resolve, 7500));

      // Verify the torrent was added
      const torrents = await this.listTorrents();
      const newTorrent = torrents.find((t: any) =>
        t.magnetLink === magnetLink || t.name.includes(magnetLink.split('&')[0])
      );

      // console.log(newTorrent);

      if (!newTorrent) {
        throw new Error('Torrent not found after adding');
      }

      await this.loggingService.logActionFromSocket(socket, {
        service: 'torrents',
        action: 'torrent_added',
        actor: {
          type: 'user',
        },
        target: {
          type: 'torrent',
          name: newTorrent.name,
          id: newTorrent.id,
        },
        metadata: {
          method: 'manual',
          name: newTorrent.name,
          size: this.formatBytes(newTorrent.totalSize)
        },
      });


    } catch (error) {
      console.error('Error adding magnet:', error);
      throw error;
    }
  }

  /**
   * List all torrents
   */
  async listTorrents() {
    const torrents = await this.request('torrent-get', {
      fields: [
        'id',
        'name',
        'status',
        'totalSize',
        'percentDone',
        'addedDate',
        'rateDownload',
        'rateUpload',
        'magnetLink',
        'downloadDir',
      ]
    });
    return torrents.arguments.torrents;
  }


  async listTorrentsByStatus() {
    const all = await this.listTorrents();

    return {
      downloading: all.filter(t => t.status === 4),
      seeding: all.filter(t => t.status === 6),
      paused: all.filter(t => t.status === 0),
      checking: all.filter(t => t.status === 2),
      queued: all.filter(t => t.status === 3 || t.status === 5),
      other: all.filter(t => ![0, 2, 3, 4, 5, 6].includes(t.status)),
      all,
    };
  }

  /**
   * Add a torrent via .torrent file
   */
  //   async addTorrentFile(path: string, downloadDir = '/media/torrents') {
  //     const data = fs.readFileSync(path);
  //     const torrentBase64 = data.toString('base64');

  //     await this.request('torrent-add', {
  //       metainfo: torrentBase64,
  //       'download-dir': downloadDir,
  //     });
  //     console.log('📦 Torrent file added');
  //   }

  /**
   * Pause torrent(s)
   */
  async pauseTorrents(ids: number[] | 'all', socket: Socket): Promise<void> {
    const args = ids === 'all' ? {} : { ids };

    if (ids !== 'all') {
      for (const id of ids) {
        try {
          const info = await this.getTorrentInfo(id);

          await this.loggingService.logActionFromSocket(socket, {
            service: 'torrents',
            action: 'torrent_paused',
            actor: {
              type: 'user',
            },
            target: {
              type: 'torrent',
              id: id.toString(),
              name: info.name,
            },
            metadata: {
              method: 'manual',
              name: info.name,
              size: info.size,
            },
          });
        } catch (err) {
          console.warn(`Failed to log pause for torrent ID ${id}:`, err.message);
        }
      }
    } else {
      await this.loggingService.logActionFromSocket(socket, {
        service: 'torrents',
        action: 'torrent_paused',
        actor: {
          type: 'user',
        },
        target: {
          type: 'all_torrents',
          id: '*'
        },
        metadata: {
          method: 'manual',
        },
      });
    }

    await this.request('torrent-stop', args);
  }


  /**
   * Start torrent(s)
   */
async startTorrents(ids: number[] | 'all', socket: Socket): Promise<void> {
  const args = ids === 'all' ? {} : { ids };

  if (ids !== 'all') {
    for (const id of ids) {
      try {
        const info = await this.getTorrentInfo(id);

        await this.loggingService.logActionFromSocket(socket, {
          service: 'torrents',
          action: 'torrent_started',
          actor: {
            type: 'user',
          },
          target: {
            type: 'torrent',
            id: id.toString(),
            name: info.name,
          },
          metadata: {
            method: 'manual',
            name: info.name,
            size: info.size,
          },
        });
      } catch (err) {
        console.warn(`Failed to log start for torrent ID ${id}:`, err.message);
      }
    }
  } else {
    await this.loggingService.logActionFromSocket(socket, {
      service: 'torrents',
      action: 'torrent_started',
      actor: {
        type: 'user',
      },
      target: {
        type: 'all_torrents',
        id: '*'
      },
      metadata: {
        method: 'manual',
      },
    });
  }

  await this.request('torrent-start', args);
}


  /**
   * Delete torrent(s)
   */
async deleteTorrents(ids: number[] | 'all', socket: Socket): Promise<void> {
  try {
    const args = {
      ...(ids === 'all' ? {} : { ids }),
      'delete-local-data': true,
    };

    if (ids !== 'all') {
      for (const id of ids) {
        try {
          const info = await this.getTorrentInfo(id);

          await this.loggingService.logActionFromSocket(socket, {
            service: 'torrents',
            action: 'torrent_deleted',
            actor: {
              type: 'user',
            },
            target: {
              type: 'torrent',
              id: id.toString(),
              name: info.name,
            },
            metadata: {
              method: 'manual',
              name: info.name,
              size: info.size,
            },
          });
        } catch (err) {
          console.warn(`Skipping logging for torrent ID ${id}:`, err.message);
        }
      }
    } else {
      await this.loggingService.logActionFromSocket(socket, {
        service: 'torrents',
        action: 'torrent_deleted',
        actor: {
          type: 'user',
        },
        target: {
          type: 'all_torrents',
          id: '*'
        },
        metadata: {
          method: 'manual',
        },
      });
    }

    // Perform the actual deletion
    const response = await this.request('torrent-remove', args);
    // console.log('Deleted torrents with files:', true, 'Response:', response);
    // return response;

  } catch (error) {
    console.error('Failed to delete torrents:', error);
    throw error;
  }
}


// In your TorrentsService class

/**
 * Change torrent location
 */
  async changeTorrentLocation(id: number, location: string, socket: Socket): Promise<void> {
    try {
      const info = await this.getTorrentInfo(id);
      
      await this.request('torrent-set-location', {
        ids: [id],
        location,
        move: true // Actually move the files
      });

      await this.loggingService.logActionFromSocket(socket, {
        service: 'torrents',
        action: 'torrent_location_changed',
        actor: {
          type: 'user',
        },
        target: {
          type: 'torrent',
          id: id.toString(),
          name: info.name,
        },
        metadata: {
          oldLocation: info.location || 'Unknown',
          newLocation: location
        },
      });
    } catch (error) {
      console.error(`Failed to change location for torrent ${id}:`, error);
      throw error;
    }
  }

  // Update getTorrentInfo to include location
  async getTorrentInfo(id: number): Promise<{ name: string; size: string; location: string }> {
    const response = await this.request('torrent-get', {
      ids: [id],
      fields: ['name', 'totalSize', 'downloadDir']
    });

    const torrent = response.arguments.torrents[0];
    if (!torrent) {
      throw new Error(`Torrent with ID ${id} not found`);
    }

    return {
      name: torrent.name,
      size: this.formatBytes(torrent.totalSize),
      location: torrent.downloadDir
    };
  }

  /**
   * Sort torrents by a property (client-side)
   */
  async sortTorrents(by: keyof any = 'name', reverse = false) {
    const list = await this.listTorrents();
    return list.sort((a, b) => {
      if (a[by] < b[by]) return reverse ? 1 : -1;
      if (a[by] > b[by]) return reverse ? -1 : 1;
      return 0;
    });
  }

  /**
   * Utility: format bytes
   */
  formatBytes(bytes: number) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unit = 0;
    while (size >= 100 && unit < units.length - 1) {
      size /= 1000;
      unit++;
    }
    return `${size.toFixed(2)} ${units[unit]}`;
  }


  async syncMissingAddedLogs(): Promise<void> {
    // Get all torrents from Transmission
    const torrents = await this.listTorrents();

    // Get IDs of torrents already logged as "torrent_added"
    const logged = await this.loggingService.find({
      where: {
        service: 'torrents',
        action: 'torrent_added',
      },
      select: ['targetId'], // assuming `target` contains { id, name }
    });

    const loggedIds = new Set(logged.map(log => log.targetId));

    // Filter torrents not logged yet
    const missingLogs = torrents.filter(t => !loggedIds.has(t.id.toString()));

    for (const t of missingLogs) {
      await this.loggingService.logDirect({
        service: 'torrents',
        action: 'torrent_added',
        actor: {
          type: 'system',
          id: 'system',
          displayName: 'Transmission Web Interface'
        },
        target: {
          type: 'torrent',
          id: t.id.toString(),
          name: t.name,
        },
        metadata: {
          method: 'sync',
          name: t.name,
          size: this.formatBytes(t.totalSize),
        },
      });
    }

    console.log(`✅ Synced ${missingLogs.length} missing torrent_added logs.`);
  }


}
