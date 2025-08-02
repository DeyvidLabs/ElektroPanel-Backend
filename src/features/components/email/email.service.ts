// src/services/mail.service.ts
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear,
  endOfYear, format, eachDayOfInterval
} from 'date-fns';
import { EmailEvent } from '../../../database/email-event.entity';
import { ConnectionEvent } from '../../../database/connection.entity';
import { MailUser } from '../../../database/mail-user.entity';
import { UserLoggingDTO } from '../../../shared/dto/user.dto';
import { LoggingService } from '../../../logging/logging.service';
import { Request } from 'express';

export interface IEmailHistory {
  daily: { date: Date; in: number; out: number }[];
  weekly: { weekStart: Date; weekEnd: Date; in: number; out: number }[];
  monthly: { monthStart: Date; monthEnd: Date; in: number; out: number }[];
  yearly: { yearStart: Date; yearEnd: Date; in: number; out: number }[];
}

export interface IBlacklistIPInfo {
  address: string;
  count: number;
  lastSeen: Date;
  blacklisted: boolean;
  info?: {
    isp: string;
    org: string;
    country: string;
  };
}

export interface IEmailUser {
  username: string;
  recoveryEmail: string;
}


@Injectable()
export class EmailService {
  private readonly DOMAIN = '@deyvid.dev';

  constructor(
    @InjectRepository(EmailEvent)
    private readonly emailEventRepo: Repository<EmailEvent>,
    @InjectRepository(ConnectionEvent)
    private readonly connectionEventRepo: Repository<ConnectionEvent>,
    @InjectRepository(MailUser)
    private readonly mailRepo: Repository<MailUser>,
    private readonly loggingService: LoggingService
  ) { }

  async getEmailHistory(): Promise<IEmailHistory> {
    const now = new Date();
    const startDate = subDays(now, 365);

    // Recupera tutti gli eventi rilevanti
    const fromEvents = await this.emailEventRepo.find({
      where: {
        eventType: 'from',
        timestamp: Between(startDate, now)
      }
    });

    const toEvents = await this.emailEventRepo.find({
      where: {
        eventType: 'to',
        timestamp: Between(startDate, now)
      }
    });

    // Mappa per raggruppare per giorno
    const dailyMap = new Map<string, { in: number; out: number }>();

    // Elabora le email in entrata
    fromEvents.forEach(event => {
      if (!event.data.endsWith(this.DOMAIN)) return;

      const dateKey = format(event.timestamp, 'yyyy-MM-dd');
      const stats = dailyMap.get(dateKey) || { in: 0, out: 0 };

      // Trova l'evento "to" corrispondente
      const matchingTo = toEvents.find(
        to => to.queueId === event.queueId && !to.data.endsWith(this.DOMAIN)
      );

      if (matchingTo) stats.out++;
      dailyMap.set(dateKey, stats);
    });

    // Elabora le email in uscita
    toEvents.forEach(event => {
      if (!event.data.endsWith(this.DOMAIN)) return;

      const dateKey = format(event.timestamp, 'yyyy-MM-dd');
      const stats = dailyMap.get(dateKey) || { in: 0, out: 0 };

      // Trova l'evento "from" corrispondente
      const matchingFrom = fromEvents.find(
        from => from.queueId === event.queueId && !from.data.endsWith(this.DOMAIN)
      );

      if (matchingFrom) stats.in++;
      dailyMap.set(dateKey, stats);
    });

    // Calcola gli intervalli
    const daily = this.calculateDailyStats(dailyMap, now);
    const weekly = this.calculateWeeklyStats(dailyMap, now);
    const monthly = this.calculateMonthlyStats(dailyMap, now);
    const yearly = this.calculateYearlyStats(dailyMap, now);

    return { daily, weekly, monthly, yearly };
  }


  async getMaliciousIPs(limit = 100): Promise<IBlacklistIPInfo[]> {
    const result = await this.connectionEventRepo
      .createQueryBuilder('connection')
      .select([
        'connection.ipAddress AS address',
        'connection.blacklisted AS blacklisted',
        'connection.isp AS isp',
        'connection.org AS org',
        'connection.country AS country',
        'SUM(connection.amount) AS count',
        'MAX(connection.lastTimestamp) AS lastSeen'
      ])
      .groupBy('connection.ipAddress, connection.blacklisted, connection.isp, connection.org, connection.country')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map(row => ({
      address: row.address,
      count: parseInt(row.count, 10),
      lastSeen: new Date(row.lastSeen),
      blacklisted: row.blacklisted,
      info: {
        isp: row.isp || 'Unknown',
        org: row.org || 'Unknown',
        country: row.country || 'Unknown'
      }
    }));
  }

  async toggleIPAddressBlacklist(ipAddress: string, status: boolean, req: Request): Promise<void> {
    const ipAddressDatabase = await this.connectionEventRepo.findOne({ where: { ipAddress } });
    if( !ipAddressDatabase ) {
      throw new Error('IP address not found');
    }
    ipAddressDatabase.blacklisted = status;
    await this.connectionEventRepo.save(ipAddressDatabase);
    await this.loggingService.logAction(req, {
      service: 'email',
      action: status ? 'ip_blacklisted' : 'ip_unblacklisted',
      actor: {
        type: 'user',
      },
      target: {
        type: 'IP',
        id: ipAddress,
        name: ipAddress,
      },
      metadata: {
        status: status ? 'blacklisted' : 'unblacklisted',
      },
    });
  }
  

  async getAllUsers(limit = 100): Promise<IEmailUser[]> {
    const result = await this.mailRepo
      .createQueryBuilder('user')
      .select(['user.username', 'user.recoveryEmail'])
      .limit(limit)
      .getRawMany();

    return result.map(row => ({
      username: row.user_username,
      recoveryEmail: row.user_recoveryEmail
    }));
  }


  private calculateDailyStats(
    dailyMap: Map<string, { in: number; out: number }>,
    endDate: Date
  ) {
    const days = eachDayOfInterval({
      start: subDays(endDate, 6),
      end: endDate
    });

    return days.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const stats = dailyMap.get(key) || { in: 0, out: 0 };
      return {
        date: day,
        in: stats.in,
        out: stats.out
      };
    });
  }

  private calculateWeeklyStats(
    dailyMap: Map<string, { in: number; out: number }>,
    endDate: Date
  ) {
    const weeks: { weekStart: Date; weekEnd: Date; in: number; out: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const weekEnd = subDays(endDate, i * 7);
      const weekStart = subDays(weekEnd, 6);

      let inCount = 0;
      let outCount = 0;

      const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
      daysInWeek.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        const stats = dailyMap.get(key) || { in: 0, out: 0 };
        inCount += stats.in;
        outCount += stats.out;
      });

      weeks.push({
        weekStart,
        weekEnd,
        in: inCount,
        out: outCount
      });
    }
    return weeks.reverse();
  }

  private calculateMonthlyStats(
    dailyMap: Map<string, { in: number; out: number }>,
    endDate: Date
  ) {
    const months: { monthStart: Date; monthEnd: Date; in: number; out: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const monthEnd = subDays(endDate, i * 30);
      const monthStart = subDays(monthEnd, 29);

      let inCount = 0;
      let outCount = 0;

      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      daysInMonth.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        const stats = dailyMap.get(key) || { in: 0, out: 0 };
        inCount += stats.in;
        outCount += stats.out;
      });

      months.push({
        monthStart,
        monthEnd,
        in: inCount,
        out: outCount
      });
    }
    return months.reverse();
  }

  private calculateYearlyStats(
    dailyMap: Map<string, { in: number; out: number }>,
    endDate: Date
  ) {
    const years: { yearStart: Date; yearEnd: Date; in: number; out: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const yearEnd = subDays(endDate, i * 365);
      const yearStart = subDays(yearEnd, 364);

      let inCount = 0;
      let outCount = 0;

      const daysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd });
      daysInYear.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        const stats = dailyMap.get(key) || { in: 0, out: 0 };
        inCount += stats.in;
        outCount += stats.out;
      });

      years.push({
        yearStart,
        yearEnd,
        in: inCount,
        out: outCount
      });
    }
    return years.reverse();
  }
}
