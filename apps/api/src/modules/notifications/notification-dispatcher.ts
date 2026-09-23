import type { Notification } from '@app/db';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface ChannelAdapter {
  send(n: Notification, recipient: { email: string; phone: string | null; pushTokens: string[] }): Promise<void>;
}

/** Logs instead of sending — the default for dev/test and for channels without a configured provider. */
class LogAdapter implements ChannelAdapter {
  private readonly logger = new Logger('NotificationLog');
  constructor(private readonly channel: string) {}
  async send(n: Notification): Promise<void> {
    // Body is intentionally NOT logged (may contain PHI); only routing metadata.
    this.logger.log({ channel: this.channel, notificationId: n.id, type: n.type, userId: n.userId }, 'notification (log adapter)');
  }
}

/** Expo push service adapter (blueprint §18.3). */
class ExpoPushAdapter implements ChannelAdapter {
  constructor(private readonly accessToken?: string) {}
  async send(n: Notification, r: { pushTokens: string[] }): Promise<void> {
    if (r.pushTokens.length === 0) throw new Error('no push tokens registered');
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}) },
      // Push payloads carry no PHI: a generic title and a deep-link, never the body (blueprint §18.5).
      body: JSON.stringify(r.pushTokens.map((to) => ({ to, title: n.title, body: 'You have a new update in your patient portal.', data: { type: n.type, ...(n.data as object) } }))),
    });
    if (!res.ok) throw new Error(`expo push failed: ${res.status}`);
  }
}

/**
 * Selects the adapter per channel from the environment. Email/SMS providers
 * ship as `log` in this codebase; add adapters (SES, SendGrid, Twilio) here.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly adapters: Record<string, ChannelAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) env: Env,
  ) {
    this.adapters = {
      IN_APP: { send: async () => undefined }, // stored row is the delivery
      PUSH: env.NOTIFY_PUSH_PROVIDER === 'expo' ? new ExpoPushAdapter(env.EXPO_ACCESS_TOKEN) : new LogAdapter('PUSH'),
      EMAIL: new LogAdapter('EMAIL'),
      SMS: new LogAdapter('SMS'),
    };
  }

  async dispatch(notificationId: string): Promise<void> {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId }, include: { user: { select: { email: true, phone: true, pushTokens: { select: { token: true } } } } } });
    if (!n || n.status !== 'PENDING') return;
    try {
      await this.adapters[n.channel]!.send(n, { email: n.user.email, phone: n.user.phone, pushTokens: n.user.pushTokens.map((t) => t.token) });
      await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'SENT', sentAt: new Date() } });
    } catch (err) {
      this.logger.warn({ err: (err as Error).message, notificationId }, 'notification delivery failed');
      await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'FAILED', error: (err as Error).message.slice(0, 500) } });
      throw err; // let the queue retry
    }
  }
}
