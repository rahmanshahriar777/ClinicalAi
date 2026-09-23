import { Module } from '@nestjs/common';

import { EncountersModule } from '../encounters/encounters.module';
import { IntakeModule } from '../intake/intake.module';

import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({ imports: [IntakeModule, EncountersModule], controllers: [AppointmentsController], providers: [AppointmentsService], exports: [AppointmentsService] })
export class AppointmentsModule {}
