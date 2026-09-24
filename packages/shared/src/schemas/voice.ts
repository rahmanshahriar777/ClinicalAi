import { z } from 'zod';

import { boundedText } from './common';

/* ------------------------------------------------------------------ */
/* Voice / Audio Schemas & Contracts                                  */
/* ------------------------------------------------------------------ */

export const CLINICAL_VOICE_CONTEXTS = [
  'GENERAL',
  'SOAP_NOTE',
  'CHIEF_COMPLAINT',
  'PRESCRIPTION',
  'PATIENT_COMMUNICATION',
  'AFTER_VISIT_SUMMARY',
] as const;
export type ClinicalVoiceContext = (typeof CLINICAL_VOICE_CONTEXTS)[number];

export const AUDIO_FORMATS = ['webm', 'wav', 'mp4', 'ogg', 'mp3'] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

export const transcribeAudioSchema = z.object({
  /** Base64-encoded audio data */
  audioBase64: z.string().min(1, 'Audio data is required'),
  /** MIME type of the audio recording (e.g. 'audio/webm', 'audio/wav') */
  mimeType: z.string().max(100).optional().default('audio/webm'),
  /** Audio container format */
  format: z.enum(AUDIO_FORMATS).optional().default('webm'),
  /** Target BCP-47 language tag (e.g., 'en-US', 'es-ES') */
  language: z.string().max(20).optional().default('en-US'),
  /** Clinical domain context for vocabulary boosting */
  clinicalContext: z.enum(CLINICAL_VOICE_CONTEXTS).optional().default('GENERAL'),
  /** Optional audio duration in seconds if known */
  durationSec: z.number().min(0).max(600).optional(),
});
export type TranscribeAudioInput = z.input<typeof transcribeAudioSchema>;

export const synthesizeSpeechSchema = z.object({
  /** Text content to synthesize into speech (up to 5,000 characters) */
  text: boundedText(5000),
  /** Voice persona ID (e.g. 'clara', 'marcus', 'sarah', 'james') */
  voice: z.string().max(50).optional().default('clara'),
  /** Speech rate multiplier: 0.5 (slow) to 2.0 (fast) */
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  /** Speech pitch multiplier: 0.5 (low) to 1.5 (high) */
  pitch: z.number().min(0.5).max(1.5).optional().default(1.0),
  /** Output audio format */
  format: z.enum(['mp3', 'wav', 'ogg']).optional().default('mp3'),
  /** Language tag */
  language: z.string().max(20).optional().default('en-US'),
});
export type SynthesizeSpeechInput = z.input<typeof synthesizeSpeechSchema>;

/* ------------------------------------------------------------------ */
/* Response Types                                                      */
/* ------------------------------------------------------------------ */

export interface TranscribeResponse {
  transcript: string;
  confidence: number;
  language: string;
  durationSec: number;
  engine: 'browser_native' | 'server_whisper' | 'clinical_nlp';
  redactionsApplied: number;
  words?: { word: string; start: number; end: number }[];
}

export interface VoicePersona {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  title: string;
  description: string;
  language: string;
  tone: string;
}

export interface SynthesizeResponse {
  text: string;
  voice: string;
  mimeType: string;
  audioBase64?: string;
  audioUrl?: string;
  durationEstimateSec: number;
  sampleRate: number;
  provider: 'browser_speech' | 'cloud_tts' | 'synthesizer';
}

export interface VoiceStatusResponse {
  sttAvailable: boolean;
  ttsAvailable: boolean;
  engines: string[];
  voices: VoicePersona[];
  maxAudioLengthSec: number;
  phiRedactionActive: boolean;
}
