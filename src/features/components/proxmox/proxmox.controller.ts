import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ProxmoxService } from './proxmox.service';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';

@ApiBearerAuth('Bearer token')
@ApiTags('Proxmox')
@Controller('proxmox')
@SkipThrottle()
export class ProxmoxController {
  constructor(private readonly proxmoxService: ProxmoxService) {}

  @Permissions(['proxmox_read'])
  @ApiOperation({ summary: 'Get all nodes' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved nodes', type: [String] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get('nodes')
  async getNodes() {
    return await this.proxmoxService.getNodes();
  }

  @Permissions(['proxmox_read'])
  @ApiOperation({ summary: 'Get information of a specific node' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved node information', type: String })
  @ApiResponse({ status: 404, description: 'Node not found' })
  @Get('nodes/:nodeName')
  async getNode(@Param('nodeName') nodeName: string) {
    return await this.proxmoxService.getNodeInfo(nodeName);
  }

  @Permissions(['proxmox_read'])
  @ApiOperation({ summary: 'Get all VMs of a specific node' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved VMs of the node', type: [String] })
  @ApiResponse({ status: 404, description: 'Node not found' })
  @Get('nodes/:nodeName/vms')
  async getVMs(@Param('nodeName') nodeName: string) {
    return await this.proxmoxService.getVMs(nodeName);
  }

  @Permissions(['proxmox_read'])
  @ApiOperation({ summary: 'Get the status of a specific VM' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved VM status', type: String })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @Get('nodes/:nodeName/vms/:vmid/status')
  async getVMStatus(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    return await this.proxmoxService.getVMStatus(nodeName, vmid);
  }

  @Permissions(['proxmox_read'])
  @ApiOperation({ summary: 'Get configuration of a specific VM' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved VM configuration', type: String })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @Get('nodes/:nodeName/vms/:vmid/config')
  async getVMConfig(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    return await this.proxmoxService.getVMConfig(nodeName, vmid);
  }

  @Permissions(['proxmox_read'])
  @ApiOperation({ summary: 'Get storage information of a specific VM' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved storage info', type: String })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @Get('nodes/:nodeName/vms/:vmid/storage')
  async storageVM(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    const storage = await this.proxmoxService.storageVM(nodeName, vmid);
    return storage;
  }

  @Permissions(['proxmox_read', 'proxmox_power'])
  @ApiOperation({ summary: 'Start a specific VM' })
  @ApiResponse({ status: 200, description: 'VM started successfully', type: Object })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Post('nodes/:nodeName/vms/:vmid/start')
  @SkipThrottle({ default: false })
  async startVM(@Req() req: Request, @Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    await this.proxmoxService.startVM(nodeName, vmid, req);
    return { message: `VM ${vmid} started successfully` };
  }

  @Permissions(['proxmox_read', 'proxmox_power'])
  @ApiOperation({ summary: 'Stop a specific VM' })
  @ApiResponse({ status: 200, description: 'VM stopped successfully', type: Object })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Post('nodes/:nodeName/vms/:vmid/stop')
  @SkipThrottle({ default: false })
  async stopVM(@Req() req: Request, @Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    await this.proxmoxService.stopVM(nodeName, vmid, req);
    return { message: `VM ${vmid} stopped successfully` };
  }

  @Permissions(['proxmox_read', 'proxmox_power'])
  @ApiOperation({ summary: 'Shutdown a specific VM' })
  @ApiResponse({ status: 200, description: 'VM shutdown successfully', type: Object })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Post('nodes/:nodeName/vms/:vmid/shutdown')
  @SkipThrottle({ default: false })
  async shutdownVM(@Req() req: Request, @Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    await this.proxmoxService.shutdownVM(nodeName, vmid, req);
    return { message: `VM ${vmid} shutdown successfully` };
  }
}
