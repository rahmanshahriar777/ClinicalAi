export type MicPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface DeviceDiagnostics {
  hasSpeechRecognition: boolean;
  hasSpeechSynthesis: boolean;
  hasMediaDevices: boolean;
  hasMediaRecorder: boolean;
  hasAudioContext: boolean;
  isSecureContext: boolean;
}

/**
 * Inspect browser capabilities for voice and audio features.
 */
export function inspectDeviceDiagnostics(): DeviceDiagnostics {
  if (typeof window === 'undefined') {
    return {
      hasSpeechRecognition: false,
      hasSpeechSynthesis: false,
      hasMediaDevices: false,
      hasMediaRecorder: false,
      hasAudioContext: false,
      isSecureContext: false,
    };
  }

  const win = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
    webkitAudioContext?: typeof AudioContext;
  };

  return {
    hasSpeechRecognition: Boolean(win.SpeechRecognition || win.webkitSpeechRecognition),
    hasSpeechSynthesis: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    hasMediaDevices: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    hasMediaRecorder: 'MediaRecorder' in window,
    hasAudioContext: Boolean(window.AudioContext || win.webkitAudioContext),
    isSecureContext: window.isSecureContext,
  };
}

/**
 * Check existing microphone permission query without popping the prompt.
 */
export async function queryMicrophonePermission(): Promise<MicPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
    return 'prompt';
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state as MicPermissionState;
  } catch {
    // Some browsers (like Safari/Firefox) don't support { name: 'microphone' } query
    return 'prompt';
  }
}

/**
 * Explicitly request a microphone audio stream with comprehensive error handling.
 */
export async function requestMicrophoneStream(constraints: MediaStreamConstraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }): Promise<{ stream: MediaStream | null; error: string | null; code: string | null }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      stream: null,
      error: 'Audio recording is not supported in this browser. Please use Chrome, Edge, Safari, or Firefox.',
      code: 'UNSUPPORTED_BROWSER',
    };
  }

  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
    return {
      stream: null,
      error: 'Microphone access requires a secure HTTPS connection.',
      code: 'INSECURE_CONTEXT',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, error: null, code: null };
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    const name = e.name || '';

    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
          stream: null,
          error: 'Microphone access was denied. Please allow microphone permissions in your browser address bar and try again.',
          code: 'PERMISSION_DENIED',
        };
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          stream: null,
          error: 'No microphone was detected on your computer or device. Please plug in a microphone and retry.',
          code: 'DEVICE_NOT_FOUND',
        };
      case 'NotReadableError':
      case 'TrackStartError':
        return {
          stream: null,
          error: 'Microphone is currently locked or in use by another application.',
          code: 'DEVICE_IN_USE',
        };
      case 'OverconstrainedError':
        return {
          stream: null,
          error: 'Microphone constraints could not be satisfied by available hardware.',
          code: 'OVERCONSTRAINED',
        };
      case 'SecurityError':
        return {
          stream: null,
          error: 'Microphone access is blocked by security policy.',
          code: 'SECURITY_ERROR',
        };
      default:
        return {
          stream: null,
          error: e.message || 'Unable to access microphone. Please check your system settings.',
          code: 'UNKNOWN_ERROR',
        };
    }
  }
}
