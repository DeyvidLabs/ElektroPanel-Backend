import { Module } from '@nestjs/common';
import { ProxmoxController } from './proxmox.controller';
import { ProxmoxService } from './proxmox.service';

@Module({
  controllers: [ProxmoxController],
  providers: [ProxmoxService]
})
export class ProxmoxModule {}
