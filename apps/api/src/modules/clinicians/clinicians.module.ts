import { Module } from '@nestjs/common';

import { CliniciansController } from './clinicians.controller';

@Module({ controllers: [CliniciansController] })
export class CliniciansModule {}
