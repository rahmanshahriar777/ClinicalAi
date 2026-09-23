import { DEFAULT_PROMPTS, type PromptTemplateDef } from '@app/ai';
import type { PromptTemplate } from '@app/db';
import type { AiWorkflow, UpsertPromptTemplateInput } from '@app/shared';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { NotFoundError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Versioned prompt registry (blueprint §15.1). Code-defined defaults are
 * seeded as global (organizationId=null) active templates on boot; admins can
 * publish new versions per organisation. Every AI invocation records the
 * exact name+version it used.
 */
@Injectable()
export class PromptRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PromptRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedDefaults();
    } catch (err) {
      // Database may be unavailable in unit-test contexts; the API can still boot and will retry lazily.
      this.logger.warn({ err: (err as Error).message }, 'prompt seeding skipped');
    }
  }

  async seedDefaults(): Promise<void> {
    for (const p of DEFAULT_PROMPTS) {
      const exists = await this.prisma.promptTemplate.findFirst({ where: { organizationId: null, name: p.name, version: p.version } });
      if (exists) continue;
      const hasActive = await this.prisma.promptTemplate.findFirst({ where: { organizationId: null, workflow: p.workflow, isActive: true } });
      await this.prisma.promptTemplate.create({ data: { organizationId: null, name: p.name, workflow: p.workflow, version: p.version, systemPrompt: p.systemPrompt, userTemplate: p.userTemplate, description: p.description, isActive: !hasActive } });
      this.logger.log(`seeded prompt ${p.name}@${p.version}`);
    }
  }

  /** Active template: organisation override first, then global default, then code default. */
  async resolve(organizationId: string, workflow: AiWorkflow, promptName?: string): Promise<PromptTemplateDef> {
    const where = promptName ? { name: promptName, workflow } : { workflow, isActive: true };
    const row =
      (await this.prisma.promptTemplate.findFirst({ where: { ...where, organizationId }, orderBy: { version: 'desc' } })) ??
      (await this.prisma.promptTemplate.findFirst({ where: { ...where, organizationId: null }, orderBy: { version: 'desc' } }));
    if (row) return { name: row.name, workflow: row.workflow, version: row.version, systemPrompt: row.systemPrompt, userTemplate: row.userTemplate, description: row.description ?? undefined };
    const def = DEFAULT_PROMPTS.find((d) => d.workflow === workflow && (!promptName || d.name === promptName));
    if (!def) throw new NotFoundError('Prompt template', promptName ?? workflow);
    return def;
  }

  async list(organizationId: string): Promise<PromptTemplate[]> {
    return this.prisma.promptTemplate.findMany({ where: { OR: [{ organizationId: null }, { organizationId }] }, orderBy: [{ workflow: 'asc' }, { name: 'asc' }, { version: 'desc' }] });
  }

  /** Publishes a new version of `name` for the organisation (versions are immutable). */
  async upsert(organizationId: string, actorId: string, input: UpsertPromptTemplateInput): Promise<PromptTemplate> {
    const latest = await this.prisma.promptTemplate.findFirst({ where: { organizationId, name: input.name }, orderBy: { version: 'desc' } });
    const version = (latest?.version ?? 0) + 1;
    const created = await this.prisma.$transaction(async (tx) => {
      if (input.activate) await tx.promptTemplate.updateMany({ where: { organizationId, workflow: input.workflow, isActive: true }, data: { isActive: false } });
      return tx.promptTemplate.create({ data: { organizationId, name: input.name, workflow: input.workflow, version, systemPrompt: input.systemPrompt, userTemplate: input.userTemplate, description: input.description, isActive: input.activate, createdById: actorId } });
    });
    await this.audit.log({ action: 'PROMPT_TEMPLATE_UPDATED', resource: 'PromptTemplate', resourceId: created.id, organizationId, metadata: { name: input.name, version, workflow: input.workflow, activated: input.activate } });
    return created;
  }

  async activate(organizationId: string, id: string): Promise<PromptTemplate> {
    const row = await this.prisma.promptTemplate.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundError('Prompt template', id);
    return this.prisma.$transaction(async (tx) => {
      await tx.promptTemplate.updateMany({ where: { organizationId, workflow: row.workflow, isActive: true }, data: { isActive: false } });
      return tx.promptTemplate.update({ where: { id }, data: { isActive: true } });
    });
  }
}
