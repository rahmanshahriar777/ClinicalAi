import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AccessModule } from './access/access.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { FeatureFlagsModule } from './infra/feature-flags/feature-flags.module';
import { JobsModule } from './infra/jobs/jobs.module';
import { LoggerModule } from './infra/logger/logger.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { requestContextMiddleware } from './infra/request-context/request-context.middleware';
import { StorageModule } from './infra/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CliniciansModule } from './modules/clinicians/clinicians.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { EscalationsModule } from './modules/escalations/escalations.module';
import { HealthModule } from './modules/health/health.module';
import { IntakeModule } from './modules/intake/intake.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PatientsModule } from './modules/patients/patients.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    JobsModule.forRoot(),
    FeatureFlagsModule,
    StorageModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AccessModule,
    AuditModule,
    AuthModule,
    ConsentsModule,
    NotificationsModule,
    EscalationsModule,
    AiModule,
    PatientsModule,
    CliniciansModule,
    AppointmentsModule,
    IntakeModule,
    EncountersModule,
    DocumentsModule,
    MessagingModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware, requestContextMiddleware).forRoutes('*');
  }
}
