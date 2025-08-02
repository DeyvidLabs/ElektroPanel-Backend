import { Controller, Get, Post, Delete, Body, Query, UnauthorizedException, Req } from '@nestjs/common';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { EmailStatsDTO, BlacklistIPInfoDTO, MailUserDTO } from '../../../shared/dto/email.dto';
import { IBlacklistIPInfo, IEmailHistory, EmailService } from './email.service';
import { BlacklistService } from './blacklist.service';
import { Request } from 'express';
@ApiBearerAuth('Bearer token')
@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly blacklistService: BlacklistService,
  ) {}

  @Permissions(['email_read'])
  @ApiOperation({ summary: 'Get email statistics (in/out) for various time ranges' })
  @ApiResponse({
    status: 200,
    description: 'Returns daily, weekly, monthly and yearly email statistics',
    type: EmailStatsDTO,
  })
  @Get('history')
  async getEmailHistory(): Promise<IEmailHistory> {
    return this.emailService.getEmailHistory();
  }

  @Permissions(['email_read'])
  @ApiOperation({ summary: 'Get IPs that attempted connections and may be blacklisted' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of IPs with connection attempt counts and metadata',
    type: [BlacklistIPInfoDTO],
  })
  @Get('malicious')
  async getMaliciousIPs(): Promise<IBlacklistIPInfo[]> {
    return this.emailService.getMaliciousIPs();
  }

  @Permissions(['email_read'])
  @ApiOperation({ summary: 'Get the registered email users' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of email users with their recovery emails',
    type: [MailUserDTO],
  })
  @Get('users')
  async getAllUsers() {
    return this.emailService.getAllUsers();
  }

  @Permissions(['email_blacklist'])
  @ApiOperation({ summary: 'Blacklist an IP via iptables' })
  @ApiQuery({ name: 'ip', required: true, description: 'IP address to blacklist', example: '192.168.1.10' })
  @ApiResponse({ status: 200, description: 'IP successfully blacklisted' })
  @Post('blacklist')
  async blacklistIp(@Req() req: Request, @Query('ip') ip: string): Promise<{ message: string }> {
    const blacklisted = await this.blacklistService.blockIp(ip);
    if (blacklisted) {
      await this.emailService.toggleIPAddressBlacklist(ip, true, req); // Set IP as blacklisted in DB
      return { message: `IP ${ip} has been successfully blacklisted` };
    } else {
      return { message: `Failed to block IP ${ip}` };
    }
  }

  @Permissions(['email_blacklist'])
  @ApiOperation({ summary: 'Unblacklist an IP via iptables' })
  @ApiQuery({ name: 'ip', required: true, description: 'IP address to unblock', example: '192.168.1.10' })
  @ApiResponse({ status: 200, description: 'IP successfully unblocked' })
  @Delete('blacklist')
  async unblacklistIp(@Req() req: Request, @Query('ip') ip: string): Promise<{ message: string }> {
    const unblacklisted = await this.blacklistService.unblockIp(ip);
    if (unblacklisted) {
      await this.emailService.toggleIPAddressBlacklist(ip, false, req); // Set IP as unblacklisted in DB
      return { message: `IP ${ip} has been successfully unblocked` };
    } else {
      return { message: `Failed to unblock IP ${ip}` };
    }
  }
}
