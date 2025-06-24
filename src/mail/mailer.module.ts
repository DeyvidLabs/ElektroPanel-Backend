// src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

@Module({
  providers: [MailerService],  // Provide the service
  exports: [MailerService],    // Export the service to make it available to other modules
})
export class MailerModule {}
