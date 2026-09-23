import { Global, Module } from '@nestjs/common';

import { ConsentsService } from './consents.service';

@Global()
@Module({ providers: [ConsentsService], exports: [ConsentsService] })
export class ConsentsModule {}
