import { Test, TestingModule } from '@nestjs/testing';
import { ProxmoxController } from './proxmox.controller';

describe('ProxmoxController', () => {
  let controller: ProxmoxController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProxmoxController],
    }).compile();

    controller = module.get<ProxmoxController>(ProxmoxController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
