import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';

import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({ imports: [AiModule], controllers: [MessagingController], providers: [MessagingService], exports: [MessagingService] })
export class MessagingModule {}
