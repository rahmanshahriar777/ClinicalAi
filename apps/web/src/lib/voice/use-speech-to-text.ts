'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { inspectDeviceDiagnostics, queryMicrophonePermission, requestMicrophoneStream, type MicPermissionState } from './voice-permissions';

export interface UseSpeechToTextOptions {
  language?: string;
  continuous?: boolean;
  autoPunctuation?: boolean;
  clinicalContext?: 'GENERAL' | 'SOAP_NOTE' | 'CHIEF_COMPLAINT' | 'PRESCRIPTION' | 'PATIENT_COMMUNICATION';
  onTranscriptChange?: (text: string) => void;
  onInterimChange?: (interim: string) => void;
  onError?: (error: string) => void;
}

export type STTStatus = 'idle' | 'requesting' | 'listening' | 'processing' | 'error';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const {
    language = 'en-US',
    continuous = true,
    autoPunctuation = true,
    clinicalContext = 'GENERAL',
  } = options;

  const [status, setStatus] = useState<STTStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [permissionState, setPermissionState] = useState<MicPermissionState>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0); // 0 - 100 volume meter
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [activeEngine, setActiveEngine] = useState<'native_realtime' | 'server_fallback'>('native_realtime');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isManuallyStoppedRef = useRef<boolean>(false);

  // Check device capabilities on mount
  useEffect(() => {
    const diag = inspectDeviceDiagnostics();
    setIsSupported(diag.hasSpeechRecognition || (diag.hasMediaDevices && diag.hasMediaRecorder));
    void queryMicrophonePermission().then(setPermissionState);

    return () => {
      stopListening();
    };
  }, []);

  // Format clinical punctuation on words
  const formatMedicalPunctuation = useCallback((text: string): string => {
    if (!autoPunctuation) return text;
    let formatted = text
      .replace(/\s+period\b/gi, '.')
      .replace(/\s+comma\b/gi, ',')
      .replace(/\s+colon\b/gi, ':')
      .replace(/\s+semicolon\b/gi, ';')
      .replace(/\s+question mark\b/gi, '?')
      .replace(/\s+exclamation point\b/gi, '!')
      .replace(/\s+new line\b/gi, '\n')
      .replace(/\s+new paragraph\b/gi, '\n\n')
      .replace(/\s+next section\b/gi, '\n\n');

    // Capitalize first letter of new sentences
    formatted = formatted.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_match, prefix, char) => prefix + char.toUpperCase());
    return formatted;
  }, [autoPunctuation]);

  // Audio level meter monitor loop
  const setupAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]!;
        }
        const average = sum / dataArray.length;
        // Scale to 0-100
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch {
      // Audio level meter is non-critical enhancement
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setStatus('requesting');
    isManuallyStoppedRef.current = false;

    // 1. Request microphone permission
    const { stream, error: micError } = await requestMicrophoneStream();
    if (micError || !stream) {
      setError(micError || 'Microphone access failed.');
      setStatus('error');
      setPermissionState('denied');
      return;
    }

    setPermissionState('granted');
    streamRef.current = stream;
    setupAudioMeter(stream);

    // 2. Check for native browser SpeechRecognition
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRec) {
      setActiveEngine('native_realtime');
      try {
        const recognition = new SpeechRec();
        recognitionRef.current = recognition;
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setStatus('listening');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = '';
          let finalizedChunk = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i]!;
            const text = result[0]?.transcript || '';
            if (result.isFinal) {
              finalizedChunk += text + ' ';
            } else {
              currentInterim += text;
            }
          }

          if (finalizedChunk) {
            setTranscript((prev) => {
              const updated = (prev ? prev.trim() + ' ' : '') + finalizedChunk.trim();
              const formatted = formatMedicalPunctuation(updated);
              options.onTranscriptChange?.(formatted);
              return formatted;
            });
          }

          setInterimTranscript(currentInterim);
          options.onInterimChange?.(currentInterim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          // If network error occurs or user denies, gracefully fall back
          if (event.error === 'network' || event.error === 'service-not-allowed') {
            console.warn(`Browser speech error (${event.error}), switching to media recorder fallback.`);
            switchToMediaRecorderFallback(stream);
          } else if (event.error !== 'no-speech') {
            setError(`Speech recognition notice: ${event.error}`);
          }
        };

        recognition.onend = () => {
          // If continuous listening is intended and user hasn't explicitly stopped, restart
          if (continuous && !isManuallyStoppedRef.current && status === 'listening') {
            try {
              recognition.start();
              return;
            } catch {
              // Ignore restart error
            }
          }
          if (isManuallyStoppedRef.current) {
            setStatus('idle');
            setInterimTranscript('');
          }
        };

        recognition.start();
      } catch (err) {
        console.warn('Could not start native SpeechRecognition, falling back to server transcription:', err);
        switchToMediaRecorderFallback(stream);
      }
    } else {
      // Browser lacks SpeechRecognition (e.g. Firefox) -> Fall back to MediaRecorder + API
      switchToMediaRecorderFallback(stream);
    }
  }, [continuous, language, formatMedicalPunctuation, setupAudioMeter, options, status]);

  const switchToMediaRecorderFallback = useCallback((stream: MediaStream) => {
    setActiveEngine('server_fallback');
    try {
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(250); // collect 250ms chunks
      setStatus('listening');
    } catch (err) {
      setError(`Audio recording initialization failed: ${(err as Error).message}`);
      setStatus('error');
    }
  }, []);

  const stopListening = useCallback(async () => {
    isManuallyStoppedRef.current = true;
    setInterimTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
      recognitionRef.current = null;
    }

    // If using MediaRecorder fallback, finalize recording and transcribe via backend API
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setStatus('processing');
      const recorder = mediaRecorderRef.current;

      const completionPromise = new Promise<void>((resolve) => {
        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (blob.size > 0) {
            try {
              // Convert blob to base64
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1] || '';
                try {
                  const res = await api().voice.transcribe({
                    audioBase64: base64data,
                    mimeType: recorder.mimeType,
                    format: recorder.mimeType.includes('mp4') ? 'mp4' : 'webm',
                    language,
                    clinicalContext,
                  });
                  if (res.transcript) {
                    setTranscript((prev) => {
                      const updated = (prev ? prev.trim() + ' ' : '') + res.transcript;
                      const formatted = formatMedicalPunctuation(updated);
                      options.onTranscriptChange?.(formatted);
                      return formatted;
                    });
                  }
                } catch (e) {
                  setError(`Server transcription failed: ${(e as Error).message}`);
                } finally {
                  setStatus('idle');
                  resolve();
                }
              };
            } catch (e) {
              setError(`Audio processing error: ${(e as Error).message}`);
              setStatus('idle');
              resolve();
            }
          } else {
            setStatus('idle');
            resolve();
          }
        };
      });

      recorder.stop();
      await completionPromise;
    } else {
      setStatus('idle');
    }

    cleanupAudio();
  }, [language, clinicalContext, formatMedicalPunctuation, cleanupAudio, options]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    status,
    transcript,
    interimTranscript,
    isListening: status === 'listening',
    isProcessing: status === 'processing',
    audioLevel,
    permissionState,
    error,
    isSupported,
    activeEngine,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  };
}
