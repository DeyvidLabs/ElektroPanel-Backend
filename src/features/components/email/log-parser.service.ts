import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as zlib from 'zlib';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogFileState } from '../../../database/log-file-state.entity';
import { EmailEvent } from '../../../database/email-event.entity';
import { stat, readdir } from 'fs/promises';
import { ConnectionEvent } from '../../../database/connection.entity';

@Injectable()
export class LogParserService implements OnModuleInit {
  private readonly logger = new Logger(LogParserService.name);
  private readonly LOG_DIR = '/var/log';
  private readonly POLL_INTERVAL = 5 * 60 * 1000; // 5 minuti
  private fileLocks: Map<string, boolean> = new Map();
  private pollTimer: NodeJS.Timeout;
  private queueMap: Map<string, { from?: string; to?: string }> = new Map();


  constructor(
    @InjectRepository(LogFileState)
    private readonly logFileStateRepo: Repository<LogFileState>,
    @InjectRepository(EmailEvent)
    private readonly emailEventRepo: Repository<EmailEvent>,
    @InjectRepository(ConnectionEvent)
    private readonly connectionEventRepo: Repository<ConnectionEvent>,
  ) { }

  async onModuleInit() {
    try {
      await this.processExistingFiles();
      this.startPolling();
      this.logger.log('Log parser initialized with periodic polling');
    } catch (error) {
      this.logger.error('Initialization error', error.stack);
    }
  }

  onApplicationShutdown() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  private startPolling() {
    this.pollTimer = setInterval(() => {
      this.pollLogFiles().catch(error => {
        this.logger.error(`Polling error: ${error.message}`);
      });
    }, this.POLL_INTERVAL);

    this.logger.log(`Started polling every ${this.POLL_INTERVAL / 1000} seconds`);
  }

  private async pollLogFiles() {
    this.logger.debug('Starting periodic log scan');
    try {
      const files = await readdir(this.LOG_DIR);
      const logFiles = files
        .filter(name => name.startsWith('mail.log'))
        .sort((a, b) => this.sortLogFiles(a, b));

      for (const file of logFiles) {
        const fullPath = path.join(this.LOG_DIR, file);
        await this.processFile(fullPath);
      }
    } catch (error) {
      this.logger.error(`Error during polling: ${error.message}`);
    }
  }

  private async processExistingFiles() {
    await this.pollLogFiles();
  }

  private sortLogFiles(a: string, b: string): number {
    const getNum = (name: string) => {
      const numPart = name.replace('mail.log', '')
        .replace('.gz', '')
        .replace('.', '');
      return numPart ? parseInt(numPart) : 0;
    };

    return getNum(a) - getNum(b);
  }

  private async processFile(filePath: string) {
    if (this.fileLocks.get(filePath)) {
      this.logger.debug(`Skipping locked file: ${filePath}`);
      return;
    }

    this.fileLocks.set(filePath, true);
    const fileName = path.basename(filePath);

    try {
      const stats = await stat(filePath);
      const inode = stats.ino;
      let state = await this.logFileStateRepo.findOne({
        where: { fileName, inode }
      });

      // Gestione rotazione file o nuovo file
      if (!state) {
        const oldStates = await this.logFileStateRepo.find({ where: { fileName } });

        // Elimina stati vecchi per lo stesso filename (rotazione)
        for (const oldState of oldStates) {
          if (oldState.inode !== inode) {
            this.logger.warn(`Deleting old state for rotated file: ${fileName} (inode ${oldState.inode})`);
            await this.logFileStateRepo.delete(oldState.id);
          }
        }

        // Crea nuovo stato
        state = this.logFileStateRepo.create({
          fileName,
          inode,
          lastReadPosition: 0,
          lastModified: stats.mtime
        });
        this.logger.log(`Created new state for file: ${fileName}`);
      }

      // Controlla se il file è stato troncato
      if (state.lastReadPosition > stats.size) {
        this.logger.warn(`File truncated: ${fileName} (${state.lastReadPosition} > ${stats.size}). Resetting position`);
        state.lastReadPosition = 0;
      }

      // Processa solo se ci sono nuovi dati
      if (stats.size > state.lastReadPosition) {
        const stream = this.createLogStream(filePath, Number(state.lastReadPosition));
        const rl = readline.createInterface({ input: stream });
        let position = Number(state.lastReadPosition);
        let lineCount = 0;
        let lastProcessedPosition = position;

        for await (const line of rl) {
          const byteLength = Buffer.byteLength(line) + 1;
          await this.parseLine(line);
          position += byteLength;
          lastProcessedPosition = position;
          lineCount++;
        }

        // Aggiorna solo se abbiamo letto nuove righe
        if (lineCount > 0) {
          state.lastReadPosition = lastProcessedPosition;
          state.lastModified = stats.mtime;
          state.lastChecked = new Date();
          await this.logFileStateRepo.save(state);
          this.logger.log(`Processed ${lineCount} lines from ${fileName} (up to ${lastProcessedPosition} bytes)`);
        }
      } else {
        this.logger.debug(`No new data in ${fileName}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`File disappeared during processing: ${filePath}`);
      } else {
        this.logger.error(`Error processing ${filePath}: ${error.message}`);
      }
    } finally {
      this.fileLocks.delete(filePath);
    }
  }

  private createLogStream(fullPath: string, startPosition = 0): NodeJS.ReadableStream {
    const stream = fs.createReadStream(fullPath, {
      start: startPosition,
      autoClose: true
    });

    if (fullPath.endsWith('.gz')) {
      return stream.pipe(zlib.createGunzip());
    }
    return stream;
  }

  private async parseLine(line: string) {
    const timestamp = this.parseLogDate(line);
    if (!timestamp) return;

    const queueId = this.extractQueueId(line);
    const emailEvent = line.match(/(?:from=<([^>]+)>|to=<([^>]+)>|disconnect from .*?(\d+\.\d+\.\d+\.\d+))/);

    if (emailEvent) {
      try {
        if (emailEvent[1] && queueId) {
          await this.saveEmailEvent(queueId, 'from', emailEvent[1], timestamp, line);
        }
        else if (emailEvent[2] && queueId) {
          await this.saveEmailEvent(queueId, 'to', emailEvent[2], timestamp, line);
        }
        else if (emailEvent[3]) {
          await this.saveEmailEvent("", 'connect', emailEvent[3], timestamp, line);
        }
      } catch (error) {
        this.logger.warn(`Error saving event: ${error.message}`, line);
      }
    }
  }

  private async saveEmailEvent(
    queueId: string,
    type: 'from' | 'to' | 'connect',
    data: string,
    timestamp: Date,
    rawLine: string
  ) {
    if ((type === 'from' || type === 'to') && (data === 'root' || data === 'root@deyvid.dev')) {
      this.logger.debug(`Skipping internal email ${queueId}: ${data} ${rawLine}`);
      return;
    }
    if (type === 'from' || type === 'to') {
      const current = this.queueMap.get(queueId) || {};
      current[type] = data;
      this.queueMap.set(queueId, current);

      // Se abbiamo sia from che to, controlliamo se sono entrambi interni
      if (current.from && current.to) {
        const isInternal =
          current.from.endsWith('@deyvid.dev') &&
          current.to.endsWith('@deyvid.dev');

        if (isInternal) {
          this.logger.debug(`Skipping internal email ${queueId}: ${current.from} -> ${current.to}`);
          this.queueMap.delete(queueId);
          return;
        }
      }
    }
    if (type === 'connect') {
      const existingConnection = await this.connectionEventRepo
        .createQueryBuilder('connection')
        .where('connection.ipAddress = :ipAddress', { ipAddress: data })
        .getOne();

      if (!existingConnection) {
        const newConnection = this.connectionEventRepo.create({
          ipAddress: data,
          amount: 1,
          lastTimestamp: timestamp,
          blacklisted: false,
        });

        await this.connectionEventRepo.save(newConnection);
      } else {
        existingConnection.amount = Number(existingConnection.amount) + 1;
        existingConnection.lastTimestamp = timestamp;

        await this.connectionEventRepo.save(existingConnection);
      }
      return;
    }
    const existingEvent = await this.emailEventRepo
      .createQueryBuilder('event')
      .where('event.queueId = :queueId', { queueId })
      .andWhere('event.eventType = :type', { type })
      .andWhere('event.data = :data', { data })
      .andWhere('ABS(TIMESTAMPDIFF(SECOND, event.timestamp, :timestamp)) <= 1', { timestamp })
      .getOne();

    if (existingEvent) return;

    const event = this.emailEventRepo.create({
      queueId,
      eventType: type,
      data,
      timestamp,
      rawLine
    });

    try {
      await this.emailEventRepo.insert(event);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry')) {
        this.logger.debug(`Duplicate event ignored: ${event.queueId} - ${event.eventType} - ${event.data} - ${event.timestamp} - ${event.rawLine}`);
      } else {
        throw err;
      }
    }
  }


  private parseLogDate(line: string): Date | null {
    const dateMatch = line.match(/^([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/);
    if (!dateMatch) return null;

    const dateStr = dateMatch[1];
    const now = new Date();
    const currentYear = now.getFullYear();

    try {
      const logDate = new Date(`${dateStr} ${currentYear}`);
      logDate.setMilliseconds(0);

      if (isNaN(logDate.getTime())) return null;

      // Se la data del log è nel futuro, usa l'anno precedente
      if (logDate > now) {
        logDate.setFullYear(currentYear - 1);
      }

      return logDate;
    } catch {
      return null;
    }
  }

  private extractQueueId(line: string): string | null {
    const queueIdRegex = /postfix\/\w+\[\d+\]:\s+([A-F0-9]{10,20}):/;
    const match = line.match(queueIdRegex);
    return match ? match[1] : null;
  }
}