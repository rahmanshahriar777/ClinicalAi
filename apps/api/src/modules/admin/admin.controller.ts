import { type AiConfigInput, aiConfigSchema, type CreateUserInput, createUserSchema, featureFlagSchema, listUsersQuerySchema, updateOrganizationSchema, updateUserSchema, type UpsertPromptTemplateInput, upsertPromptTemplateSchema } from '@app/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe';
import { PromptRegistryService } from '../ai/prompt-registry.service';
import type { RequestUser } from '../auth/auth.types';

import { AdminService } from './admin.service';

const metricsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly prompts: PromptRegistryService,
  ) {}

  @Get('users')
  @RequirePermissions('admin:manage')
  listUsers(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listUsersQuerySchema)) q: z.infer<typeof listUsersQuerySchema>) {
    return this.admin.listUsers(user, q);
  }

  @Post('users')
  @RequirePermissions('admin:manage')
  @ApiOperation({ summary: 'Create a staff user' })
  createUser(@CurrentUser() user: RequestUser, @Body(zodBody(createUserSchema)) body: CreateUserInput) {
    return this.admin.createUser(user, body);
  }

  @Patch('users/:id')
  @RequirePermissions('admin:manage')
  updateUser(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(updateUserSchema)) body: z.infer<typeof updateUserSchema>) {
    return this.admin.updateUser(user, id, body);
  }

  @Get('organization')
  @RequirePermissions('admin:manage')
  getOrg(@CurrentUser() user: RequestUser) {
    return this.admin.getOrganization(user);
  }

  @Patch('organization')
  @RequirePermissions('admin:manage')
  updateOrg(@CurrentUser() user: RequestUser, @Body(zodBody(updateOrganizationSchema)) body: z.infer<typeof updateOrganizationSchema>) {
    return this.admin.updateOrganization(user, body);
  }

  @Get('ai-config')
  @RequirePermissions('admin:ai-config')
  getAiConfig(@CurrentUser() user: RequestUser) {
    return this.admin.getAiConfig(user);
  }

  @Put('ai-config')
  @RequirePermissions('admin:ai-config')
  @ApiOperation({ summary: 'Update organisation AI policy (can only tighten environment limits)' })
  updateAiConfig(@CurrentUser() user: RequestUser, @Body(zodBody(aiConfigSchema)) body: AiConfigInput) {
    return this.admin.updateAiConfig(user, body);
  }

  @Get('prompt-templates')
  @RequirePermissions('admin:ai-config')
  listPrompts(@CurrentUser() user: RequestUser) {
    return this.prompts.list(user.organizationId);
  }

  @Post('prompt-templates')
  @RequirePermissions('admin:ai-config')
  @ApiOperation({ summary: 'Publish a new prompt version for this organisation' })
  upsertPrompt(@CurrentUser() user: RequestUser, @Body(zodBody(upsertPromptTemplateSchema)) body: UpsertPromptTemplateInput) {
    return this.prompts.upsert(user.organizationId, user.id, body);
  }

  @Post('prompt-templates/:id/activate')
  @RequirePermissions('admin:ai-config')
  activatePrompt(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.prompts.activate(user.organizationId, id);
  }

  @Get('feature-flags')
  @RequirePermissions('admin:manage')
  listFlags(@CurrentUser() user: RequestUser) {
    return this.admin.listFlags(user);
  }

  @Put('feature-flags')
  @RequirePermissions('admin:manage')
  setFlag(@CurrentUser() user: RequestUser, @Body(zodBody(featureFlagSchema)) body: z.infer<typeof featureFlagSchema>) {
    return this.admin.setFlag(user, body);
  }

  @Get('ai-metrics')
  @RequirePermissions('admin:ai-config')
  @ApiOperation({ summary: 'AI quality/ops metrics: approval rates, edit distance, latency, cost (blueprint §17, §23.4)' })
  metrics(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(metricsQuery)) q: z.infer<typeof metricsQuery>) {
    return this.admin.aiMetrics(user, q.days);
  }
}
