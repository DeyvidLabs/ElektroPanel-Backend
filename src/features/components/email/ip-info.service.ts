import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConnectionEvent } from '../../../database/connection.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class IpInfoService {
  private readonly logger = new Logger(IpInfoService.name);
  private readonly RATE_LIMIT = 45; // 45 requests per minute
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24 * 14; // 2 weeks cache (in milliseconds)
  private requestCount = 0;
  private lastResetTime = Date.now();
  private isJobRunning = false;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(ConnectionEvent)
    private readonly connectionEventRepo: Repository<ConnectionEvent>,
  ) {}

  // Reset counter every minute
  @Cron('*/1 * * * *') // Every minute at second 0
  resetRequestCount() {
    this.requestCount = 0;
    this.lastResetTime = Date.now();
  }

  // Main update job - runs every 2 minutes
  @Cron("*/2 * * * *") // Every 2 minutes at second 0
  async scheduledIpUpdate() {
    if (this.isJobRunning) {
        this.logger.warn('IP update job is already running, skipping this run');
        return;
    }
    
    this.isJobRunning = true;
    try {
        this.logger.log('IP update started');
        await this.batchUpdateIpInfo(15);
    } finally {
        this.isJobRunning = false;
    }
  }

  private async checkRateLimit() {
    if (this.requestCount >= this.RATE_LIMIT) {
      const timeToWait = 60000 - (Date.now() - this.lastResetTime);
      this.logger.warn(`Rate limit reached. Waiting ${timeToWait}ms`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
      this.resetRequestCount();
    }
  }

  async getIpInfo(ipAddress: string): Promise<{ isp: string; org: string; country: string }> {
    // Check cache first
    const cached = await this.connectionEventRepo.findOne({
      where: { ipAddress },
      select: ['isp', 'org', 'country', 'ipInfoLastUpdated']
    });

    // Return cached data if still valid
    if (cached?.ipInfoLastUpdated && 
        (Date.now() - cached.ipInfoLastUpdated.getTime()) < this.CACHE_TTL) {
      return {
        isp: cached.isp,
        org: cached.org,
        country: cached.country
      };
    }

    await this.checkRateLimit();

    try {
      this.requestCount++;
      const response = await firstValueFrom(
        this.httpService.get(`http://ip-api.com/json/${ipAddress}?fields=isp,org,country`)
      );

      const ipInfo = {
        isp: response.data.isp || 'Unknown ISP',
        org: response.data.org || 'Unknown ORG',
        country: response.data.country || 'Unknown COUNTRY',
        ipInfoLastUpdated: new Date()
      };

      // Update cache
      await this.connectionEventRepo.update(
        { ipAddress },
        ipInfo
      );

      return ipInfo;
    } catch (error) {
      this.logger.error(`Failed to fetch IP info for ${ipAddress}: ${error.message}`);
      return {
        isp: 'Unknown',
        org: 'Unknown',
        country: 'Unknown'
      };
    }
  }

  async batchUpdateIpInfo(limit = 15) {
    this.logger.log(`Starting batch IP info update for ${limit} IPs`);
    
    const twoWeeksAgo = new Date(Date.now() - this.CACHE_TTL);
    
    const ipsToUpdate = await this.connectionEventRepo
      .createQueryBuilder('event')
      .where('event.ipInfoLastUpdated IS NULL OR event.ipInfoLastUpdated < :date', {
        date: twoWeeksAgo
      })
      .orderBy('event.lastTimestamp', 'DESC') // Prioritize recently active IPs
      .limit(limit)
      .getMany();

    this.logger.log(`Found ${ipsToUpdate.length} IPs needing update`);

    for (const ip of ipsToUpdate) {
      try {
        this.logger.debug(`Updating IP: ${ip.ipAddress}`);
        const info = await this.getIpInfo(ip.ipAddress);
        await this.connectionEventRepo.update(
          { id: ip.id },
          { 
            isp: info.isp,
            org: info.org,
            country: info.country,
            ipInfoLastUpdated: new Date() 
          }
        );
        this.logger.debug(`Successfully updated IP: ${ip.ipAddress}`);
      } catch (error) {
        this.logger.error(`Error updating IP ${ip.ipAddress}: ${error.message}`);
      }
    }

    this.logger.log(`Completed batch IP info update`);
  }
}