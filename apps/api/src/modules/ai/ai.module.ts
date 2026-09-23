import { Module } from '@nestjs/common';

import { AiConfigService } from './ai-config.service';
import { AiDraftsService } from './ai-drafts.service';
import { aiGatewayProvider } from './ai-gateway.provider';
import { AiDraftsController } from './ai.controller';
import { ContextBuilderService } from './context-builder.service';
import { PromptRegistryService } from './prompt-registry.service';

@Module({
  controllers: [AiDraftsController],
  providers: [aiGatewayProvider, AiConfigService, PromptRegistryService, ContextBuilderService, AiDraftsService],
  exports: [AiDraftsService, AiConfigService, PromptRegistryService],
})
export class AiModule {}
