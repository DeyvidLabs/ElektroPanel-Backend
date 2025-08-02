import { Module } from '@nestjs/common';
import { ProxmoxController } from './proxmox.controller';
import { ProxmoxService } from './proxmox.service';
import { LoggingModule } from '../../../logging/logging.module';

@Module({
  imports: [LoggingModule],
  controllers: [ProxmoxController],
  providers: [ProxmoxService]
})
export class ProxmoxModule {}
