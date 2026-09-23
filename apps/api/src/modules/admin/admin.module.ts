import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [AiModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
