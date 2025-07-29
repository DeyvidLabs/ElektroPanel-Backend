// src/shared/ip-block.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BlacklistService {
  private readonly logger = new Logger(BlacklistService.name);

  // Block IP only if it's not already blocked
  async blockIp(ip: string): Promise<boolean> {
    try {
      // Check if the IP is already blocked
      const blockedIps = await this.listBlockedIps();
      if (blockedIps.includes(ip)) {
        this.logger.log(`IP ${ip} is already blocked.`);
        return true; // If already blocked, no need to block again
      }

      // Block the IP
      await execAsync(`iptables -A INPUT -s ${ip} -j DROP`);
      await this.saveRules();
      this.logger.log(`Blocked IP: ${ip}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to block IP ${ip}`, err);
      return false;
    }
  }

  // Unblock IP only if it's currently blocked
  async unblockIp(ip: string): Promise<boolean> {
    try {
      // Check if the IP is already blocked
      const blockedIps = await this.listBlockedIps();
      if (!blockedIps.includes(ip)) {
        this.logger.log(`IP ${ip} is not blocked.`);
        return true; // If already unblocked, no need to unblock again
      }

      // Unblock the IP
      await execAsync(`iptables -D INPUT -s ${ip} -j DROP`);
      await this.saveRules();
      this.logger.log(`Unblocked IP: ${ip}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to unblock IP ${ip}`, err);
      return false;
    }
  }

  // Get list of blocked IPs
  async listBlockedIps(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`iptables -L INPUT -n`);
      return stdout
        .split('\n')
        .filter(line => line.includes('DROP'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[3]; // source IP
        });
    } catch (err) {
      this.logger.error('Failed to list blocked IPs', err);
      return [];
    }
  }

  // Save firewall rules to make the block persistent
  async saveRules(): Promise<void> {
    try {
      await execAsync('netfilter-persistent save'); // Debian/Ubuntu
      // Or: await execAsync('iptables-save > /etc/iptables/rules.v4');
      this.logger.log('Firewall rules saved');
    } catch (err) {
      this.logger.error('Failed to save iptables rules', err);
    }
  }
}
