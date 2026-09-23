import { FEATURE_FLAGS, type FeatureFlagKey } from '@app/shared';
import { Inject, Injectable } from '@nestjs/common';

import { FeatureDisabledError } from '../../common/errors/app-error';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 30_000;

/**
 * Feature flags: environment variables provide defaults; FeatureFlag rows
 * override globally (organizationId null) or per organisation. Cached briefly
 * to avoid a DB round-trip on every request.
 */
@Injectable()
export class FeatureFlagsService {
  private cache = new Map<string, { value: boolean; expires: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private envDefault(key: FeatureFlagKey): boolean {
    switch (key) {
      case FEATURE_FLAGS.PATIENT_MESSAGING:
        return this.env.FEATURE_PATIENT_MESSAGING;
      case FEATURE_FLAGS.AI_NOTES:
        return this.env.FEATURE_AI_NOTES;
      case FEATURE_FLAGS.AI_MESSAGE_DRAFTS:
        return this.env.FEATURE_AI_MESSAGE_DRAFTS;
      case FEATURE_FLAGS.SPEECH_TO_TEXT:
        return this.env.FEATURE_SPEECH_TO_TEXT;
      case FEATURE_FLAGS.PATIENT_EDUCATION:
        return this.env.FEATURE_PATIENT_EDUCATION;
      default:
        return false;
    }
  }

  async isEnabled(key: FeatureFlagKey, organizationId?: string): Promise<boolean> {
    const cacheKey = `${key}:${organizationId ?? '*'}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;

    const rows = await this.prisma.featureFlag.findMany({
      where: { key, OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])] },
    });
    const orgRow = rows.find((r) => r.organizationId === organizationId && organizationId);
    const globalRow = rows.find((r) => r.organizationId === null);
    const value = orgRow?.enabled ?? globalRow?.enabled ?? this.envDefault(key);
    this.cache.set(cacheKey, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async assertEnabled(key: FeatureFlagKey, organizationId?: string): Promise<void> {
    if (!(await this.isEnabled(key, organizationId))) throw new FeatureDisabledError(key);
  }

  invalidate(): void {
    this.cache.clear();
  }

  async listEffective(organizationId?: string): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const key of Object.values(FEATURE_FLAGS)) out[key] = await this.isEnabled(key, organizationId);
    return out;
  }
}
