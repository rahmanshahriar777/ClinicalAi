import { Global, Module } from '@nestjs/common';

import { NotificationDispatcher } from './notification-dispatcher';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService, NotificationDispatcher], exports: [NotificationsService] })
export class NotificationsModule {}
