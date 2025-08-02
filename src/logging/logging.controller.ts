import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../shared/decorators/permissions.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { LoggingService } from './logging.service';
import { SystemLog } from '../database/systemlog.entity';

@ApiBearerAuth('Bearer token')
@Controller('logging')
@ApiTags('Permission')
@Permissions('admin')
@SkipThrottle()
export class LoggingController {
    constructor(private readonly loggingService: LoggingService) {}

    @Get()
    @ApiOperation({ summary: 'Get all logs' })
    @ApiOkResponse({ description: 'List of logs', type: SystemLog })
    async getAllLogs() {
      return this.loggingService.getAllLogs();
    }
}
