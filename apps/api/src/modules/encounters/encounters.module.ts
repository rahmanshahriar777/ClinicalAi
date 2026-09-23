import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';

import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';

@Module({ imports: [AiModule, DocumentsModule], controllers: [EncountersController], providers: [EncountersService], exports: [EncountersService] })
export class EncountersModule {}
