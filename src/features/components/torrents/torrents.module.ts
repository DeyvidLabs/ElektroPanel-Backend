import { forwardRef, Module } from '@nestjs/common';
import { TorrentsController } from './torrents.controller';
import { TorrentsService } from './torrents.service';
import { TorrentsGateway } from './torrents.gateway';
import { LoggingModule } from '../../../logging/logging.module';
import { UserModule } from '../../../features/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLog } from '../../../database/systemlog.entity';

@Module({
  imports: [    
    TypeOrmModule.forFeature([SystemLog]), // <-- QUESTA è LA CHIAVE
    LoggingModule,
    UserModule,

  ],
  controllers: [TorrentsController],
  providers: [TorrentsService, TorrentsGateway],
  exports: [TorrentsService],

})
export class TorrentsModule {}
