import { forwardRef, Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLog } from '../database/systemlog.entity';
import { LoggingController } from './logging.controller';
import { UserModule } from '../features/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemLog]),
    forwardRef(() => UserModule),
  ],
  providers: [
    LoggingService
  ],
  exports: [LoggingService],
  controllers: [LoggingController],
})
export class LoggingModule {}
