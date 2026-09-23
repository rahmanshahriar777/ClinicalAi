import { Global, Module } from '@nestjs/common';

import { EscalationsController } from './escalations.controller';
import { EscalationsService } from './escalations.service';

@Global()
@Module({ controllers: [EscalationsController], providers: [EscalationsService], exports: [EscalationsService] })
export class EscalationsModule {}
