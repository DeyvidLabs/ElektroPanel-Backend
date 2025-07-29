import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailEvent } from '../../../database/email-event.entity';
import { LogFileState } from '../../../database/log-file-state.entity';
import { LogParserService } from './log-parser.service';
import { ConnectionEvent } from '../../../database/connection.entity';
import { MailUser } from '../../../database/mail-user.entity';
import { BlacklistService } from './blacklist.service';
import { HttpModule } from '@nestjs/axios';
import { IpInfoService } from './ip-info.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailEvent, LogFileState, ConnectionEvent, MailUser]),
    ScheduleModule.forRoot(),
    HttpModule
  ],
  providers: [
    EmailService,
    // LogParserService,
    BlacklistService,
    IpInfoService
  ],
  controllers: [EmailController]
})
export class EmailModule {}
