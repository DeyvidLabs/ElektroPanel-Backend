import { Controller, Get, Param, Post } from '@nestjs/common';
import { ProxmoxService } from './proxmox.service';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiBearerAuth('Bearer token')
@ApiTags('proxmox')
@Controller('proxmox')
@SkipThrottle()
export class ProxmoxController {
  constructor(private readonly proxmoxService: ProxmoxService) {}

  @Permissions(['proxmox_read', 'admin'])
  @Get('nodes')
  @ApiOperation({ summary: 'Get all nodes' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved nodes', type: [String] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getNodes() {
    return await this.proxmoxService.getNodes();
  }

  @Permissions(['proxmox_read', 'admin'])
  @Get('nodes/:nodeName')
  @ApiOperation({ summary: 'Get information of a specific node' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved node information', type: String })
  @ApiResponse({ status: 404, description: 'Node not found' })
  async getNode(@Param('nodeName') nodeName: string) {
    return await this.proxmoxService.getNodeInfo(nodeName);
  }

  @Permissions(['proxmox_read', 'admin'])
  @Get('nodes/:nodeName/vms')
  @ApiOperation({ summary: 'Get all VMs of a specific node' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved VMs of the node', type: [String] })
  @ApiResponse({ status: 404, description: 'Node not found' })
  async getVMs(@Param('nodeName') nodeName: string) {
    return await this.proxmoxService.getVMs(nodeName);
  }

  @Permissions(['proxmox_read', 'admin'])
  @Get('nodes/:nodeName/vms/:vmid/status')
  @ApiOperation({ summary: 'Get the status of a specific VM' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved VM status', type: String })
  @ApiResponse({ status: 404, description: 'VM not found' })
  async getVMStatus(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    return await this.proxmoxService.getVMStatus(nodeName, vmid);
  }

  @Permissions(['proxmox_read', 'admin'])
  @Get('nodes/:nodeName/vms/:vmid/config')
  @ApiOperation({ summary: 'Get configuration of a specific VM' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved VM configuration', type: String })
  @ApiResponse({ status: 404, description: 'VM not found' })
  async getVMConfig(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    return await this.proxmoxService.getVMConfig(nodeName, vmid);
  }

  @Permissions(['proxmox_read', 'admin'])
  @Get('nodes/:nodeName/vms/:vmid/storage')
  @ApiOperation({ summary: 'Get storage information of a specific VM' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved storage info', type: String })
  @ApiResponse({ status: 404, description: 'VM not found' })
  async storageVM(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    const storage = await this.proxmoxService.storageVM(nodeName, vmid);
    return storage;
  }

  @Permissions(['proxmox_read', 'proxmox_power'], ['admin'])
  @Post('nodes/:nodeName/vms/:vmid/start')
  @ApiOperation({ summary: 'Start a specific VM' })
  @ApiResponse({ status: 200, description: 'VM started successfully', type: Object })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async startVM(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    await this.proxmoxService.startVM(nodeName, vmid);
    return { message: `VM ${vmid} started successfully` };
  }

  @Permissions('proxmox_read', 'proxmox_power', ['admin'])
  @Post('nodes/:nodeName/vms/:vmid/stop')
  @ApiOperation({ summary: 'Stop a specific VM' })
  @ApiResponse({ status: 200, description: 'VM stopped successfully', type: Object })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async stopVM(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    await this.proxmoxService.stopVM(nodeName, vmid);
    return { message: `VM ${vmid} stopped successfully` };
  }

  @Permissions('proxmox_read', 'proxmox_power', ['admin'])
  @Post('nodes/:nodeName/vms/:vmid/shutdown')
  @ApiOperation({ summary: 'Shutdown a specific VM' })
  @ApiResponse({ status: 200, description: 'VM shutdown successfully', type: Object })
  @ApiResponse({ status: 404, description: 'VM not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async shutdownVM(@Param('nodeName') nodeName: string, @Param('vmid') vmid: number) {
    await this.proxmoxService.shutdownVM(nodeName, vmid);
    return { message: `VM ${vmid} shutdown successfully` };
  }
}
