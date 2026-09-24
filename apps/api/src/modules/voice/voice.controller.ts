import {
  synthesizeSpeechSchema,
  type SynthesizeSpeechInput,
  transcribeAudioSchema,
  type TranscribeAudioInput,
} from '@app/shared';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';

import { VoiceService } from './voice.service';

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Get voice engine capabilities, personas, and supported features' })
  getStatus() {
    return this.voiceService.getStatus();
  }

  @Post('transcribe')
  @Public()
  @ApiOperation({ summary: 'Transcribe audio voice input to text with medical domain enhancement and PHI redaction' })
  transcribe(@Body(zodBody(transcribeAudioSchema)) body: TranscribeAudioInput) {
    return this.voiceService.transcribe(body);
  }

  @Post('synthesize')
  @Public()
  @ApiOperation({ summary: 'Synthesize text into natural clinical speech audio' })
  synthesize(@Body(zodBody(synthesizeSpeechSchema)) body: SynthesizeSpeechInput) {
    return this.voiceService.synthesize(body);
  }
}
