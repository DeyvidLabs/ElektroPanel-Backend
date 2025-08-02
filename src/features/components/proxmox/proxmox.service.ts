import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as dotenv from 'dotenv';
import { LoggingService } from '../../../logging/logging.service';
import { Request } from 'express';
dotenv.config();

@Injectable()
export class ProxmoxService {
  private readonly logger = new Logger(ProxmoxService.name);
  private axiosInstance: AxiosInstance;
  private ticket: string = '';
  private csrfToken: string = '';

  constructor(private loggingService: LoggingService) {
    const proxmoxHost = process.env.PROXMOX_HOST;
    const agent = new https.Agent({ rejectUnauthorized: false });

    this.axiosInstance = axios.create({
      baseURL: proxmoxHost,
      httpsAgent: agent,
    });
  }

  private handleProxmoxError(error: any, context: string) {
    const status = error.response?.status;
    const message = error.response?.statusText || error.message;

    switch (status) {
      case 401:
      case 403:
        throw new UnauthorizedException(`${context}: Not authorized`);
      case 404:
        throw new NotFoundException(`${context}: Not found`);
      case 500:
      case 502:
      case 503:
        throw new BadGatewayException(`${context}: Proxmox error - ${message}`);
      default:
        this.logger.error(`${context}:`, message);
        throw new ServiceUnavailableException(`${context}: Unexpected error`);
    }
  }

  async authenticate() {
    const username = process.env.PROXMOX_USERNAME;
    const password = process.env.PROXMOX_PASSWORD;
    const realm = process.env.PROXMOX_REALM;

    if (!username || !password || !realm) {
      this.logger.error('Missing Proxmox credentials in environment variables');
      throw new InternalServerErrorException('Server misconfigured: missing Proxmox credentials');
    }

    try {
      const response = await this.axiosInstance.post('/api2/json/access/ticket', {
        username,
        password,
        realm,
      });

      const data = response.data?.data;
      if (!data?.ticket || !data?.CSRFPreventionToken) {
        this.logger.error('Proxmox authentication succeeded but missing ticket/token in response');
        throw new UnauthorizedException('Proxmox authentication failed: invalid response structure');
      }

      this.ticket = data.ticket;
      this.csrfToken = data.CSRFPreventionToken;

      this.axiosInstance.defaults.headers.common['Authorization'] = `PVEAuthCookie=${this.ticket}`;
      this.axiosInstance.defaults.headers.common['CSRFPreventionToken'] = this.csrfToken;

      // this.logger.debug('Authenticated with Proxmox successfully');
    } catch (error) {
      const msg = error.response?.statusText || error.message;
      this.logger.error('Proxmox authentication failed:', msg);
      this.handleProxmoxError(error, 'Authentication');
    }
}


  async getNodes() {
    await this.authenticate();
    try {
      const response = await this.axiosInstance.get('/api2/json/nodes');
      return response.data.data;
    } catch (error) {
      this.handleProxmoxError(error, 'Fetching node list');
    }
  }

  async getNodeInfo(node: string) {
    await this.authenticate();
    try {
      const response = await this.axiosInstance.get(`/api2/json/nodes/${node}/status`);
      return response.data.data;
    } catch (error) {
      this.handleProxmoxError(error, `Node "${node}" info`);
    }
  }

  async getVMs(nodeName: string) {
    await this.authenticate();
    try {
      const response = await this.axiosInstance.get(`/api2/json/nodes/${nodeName}/qemu`);
      return response.data.data;
    } catch (error) {
      this.handleProxmoxError(error, `Fetching VMs for node "${nodeName}"`);
    }
  }

  async getVMStatus(nodeName: string, vmid: number) {
    await this.authenticate();
    try {
      const response = await this.axiosInstance.get(`/api2/json/nodes/${nodeName}/qemu/${vmid}/status/current`);
      return response.data.data;
    } catch (error) {
      this.handleProxmoxError(error, `VM ${vmid} status on node "${nodeName}"`);
    }
  }

  async getVMConfig(nodeName: string, vmid: number) {
    await this.authenticate();
    try {
      const response = await this.axiosInstance.get(`/api2/json/nodes/${nodeName}/qemu/${vmid}/config`);
      return response.data.data;
    } catch (error) {
      this.handleProxmoxError(error, `VM ${vmid} config on node "${nodeName}"`);
    }
  }

  async startVM(nodeName: string, vmid: number, req: Request) {
    await this.authenticate();
    try {
      await this.axiosInstance.post(`/api2/json/nodes/${nodeName}/qemu/${vmid}/status/start`);
      this.logger.log(`Started VM ${vmid} on node ${nodeName}`);

      await this.loggingService.logAction(req, {
        service: 'proxmox',
        action: 'vm_started',
        actor: {
          type: 'user',
        },
        target: {
          type: 'vm',
          id: vmid.toString(),
          name: nodeName
        },
        metadata: {
          method: 'manual',
        },
      });

    } catch (error) {
      this.handleProxmoxError(error, `Starting VM ${vmid} on node "${nodeName}"`);
    }
  }

  async stopVM(nodeName: string, vmid: number, req: Request) {
    await this.authenticate();
    try {
      await this.axiosInstance.post(`/api2/json/nodes/${nodeName}/qemu/${vmid}/status/stop`);
      this.logger.log(`Stopped VM ${vmid} on node ${nodeName}`);

      await this.loggingService.logAction(req, {
        service: 'proxmox',
        action: 'vm_stopped',
        actor: {
          type: 'user',
        },
        target: {
          type: 'vm',
          id: vmid.toString(),
          name: nodeName
        },
        metadata: {
          method: 'manual',
        },
      });

    } catch (error) {
      this.handleProxmoxError(error, `Stopping VM ${vmid} on node "${nodeName}"`);
    }
  }

  async shutdownVM(nodeName: string, vmid: number, req: Request,) {
    await this.authenticate();
    try {
      await this.axiosInstance.post(`/api2/json/nodes/${nodeName}/qemu/${vmid}/status/shutdown`);
      this.logger.log(`Shutdown VM ${vmid} on node ${nodeName}`);

      await this.loggingService.logAction(req, {
        service: 'proxmox',
        action: 'vm_shutdown',
        actor: {
          type: 'user',

        },
        target: {
          type: 'vm',
          id: vmid.toString(),
          name: nodeName
        },
        metadata: {
          method: 'manual',
        },
      });

    } catch (error) {
      this.handleProxmoxError(error, `Shutting down VM ${vmid} on node "${nodeName}"`);
    }
  }


  async storageVM(nodeName: string, vmid: number) {
    await this.authenticate();
    try {
      const response = await this.axiosInstance.get(`/api2/json/nodes/${nodeName}/qemu/${vmid}/agent/get-fsinfo`);
      return { status: 'success', result: response.data.data };
    } catch (error) {
      const message = error.response?.statusText || error.message || 'Unknown error occurred';
      this.logger.warn(`Storage info for VM ${vmid} on node ${nodeName} failed: ${message}`);
      return { status: 'error', result: message };
    }
  }
}
