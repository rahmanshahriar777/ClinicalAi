import type { Notification, NotificationChannel, Prisma } from '@app/db';
import type { NotificationType, Paginated, PaginationQuery } from '@app/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { NotFoundError } from '../../common/errors/app-error';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { JobsService } from '../../infra/jobs/jobs.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

import { NotificationDispatcher } from './notification-dispatcher';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Explicit channels; defaults to the recipient's preferences (patients) or IN_APP+PUSH (staff). */
  channels?: NotificationChannel[];
}

/**
 * Notification engine (blueprint §5.1). Every notification is persisted as
 * an in-app row and fanned out to other channels through queued jobs, so a
 * push/email outage never blocks the clinical workflow.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  onModuleInit(): void {
    this.jobs.register('NOTIFICATION_DISPATCH', ({ notificationId }) => this.dispatcher.dispatch(notificationId));
  }

  async notify(input: NotifyInput): Promise<Notification[]> {
    const channels = input.channels ?? (await this.defaultChannels(input.userId));
    const created: Notification[] = [];
    for (const channel of channels) {
      const n = await this.prisma.notification.create({
        data: { userId: input.userId, type: input.type, channel, title: input.title, body: input.body, data: input.data as Prisma.InputJsonValue | undefined, status: channel === 'IN_APP' ? 'SENT' : 'PENDING', sentAt: channel === 'IN_APP' ? new Date() : null },
      });
      created.push(n);
      if (channel !== 'IN_APP') await this.jobs.enqueue('NOTIFICATION_DISPATCH', { notificationId: n.id });
    }
    return created;
  }

  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
    for (const userId of new Set(userIds)) await this.notify({ ...input, userId });
  }

  async list(userId: string, q: PaginationQuery & { unreadOnly?: boolean }): Promise<Paginated<Notification>> {
    const where: Prisma.NotificationWhereInput = { userId, channel: 'IN_APP', ...(q.unreadOnly ? { readAt: null } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(q) }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundError('Notification', id);
    return this.prisma.notification.update({ where: { id }, data: { readAt: n.readAt ?? new Date(), status: 'READ' } });
  }

  async registerDevice(userId: string, token: string, platform: string): Promise<void> {
    await this.prisma.devicePushToken.upsert({ where: { token }, create: { userId, token, platform }, update: { userId, platform } });
  }

  async removeDevice(userId: string, token: string): Promise<void> {
    await this.prisma.devicePushToken.deleteMany({ where: { userId, token } });
  }

  private async defaultChannels(userId: string): Promise<NotificationChannel[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { patient: true } });
    if (!user) return [];
    if (user.patient) {
      const p = user.patient;
      const ch: NotificationChannel[] = [];
      if (p.notifyInApp) ch.push('IN_APP');
      if (p.notifyPush) ch.push('PUSH');
      if (p.notifyEmail) ch.push('EMAIL');
      if (p.notifySms) ch.push('SMS');
      return ch.length ? ch : ['IN_APP'];
    }
    return ['IN_APP', 'PUSH'];
  }
}
