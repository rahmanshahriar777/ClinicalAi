import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';

import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({ imports: [DocumentsModule], controllers: [PatientsController], providers: [PatientsService], exports: [PatientsService] })
export class PatientsModule {}
