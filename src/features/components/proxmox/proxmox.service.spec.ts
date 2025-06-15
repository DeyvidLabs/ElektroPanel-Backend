import { Test, TestingModule } from '@nestjs/testing';
import { ProxmoxService } from './proxmox.service';

describe('ProxmoxService', () => {
  let service: ProxmoxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProxmoxService],
    }).compile();

    service = module.get<ProxmoxService>(ProxmoxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
