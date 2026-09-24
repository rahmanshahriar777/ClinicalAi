'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useSpeechToText } from '@/lib/voice/use-speech-to-text';

export interface MicDictationButtonProps {
  onTranscript: (text: string) => void;
  clinicalContext?: 'GENERAL' | 'SOAP_NOTE' | 'CHIEF_COMPLAINT' | 'PRESCRIPTION' | 'PATIENT_COMMUNICATION';
  className?: string;
  size?: 'sm' | 'md';
  variant?: 'outline' | 'filled' | 'ghost';
  label?: string;
}

export function MicDictationButton({
  onTranscript,
  clinicalContext = 'GENERAL',
  className,
  size = 'md',
  variant = 'outline',
  label = 'Dictate',
}: MicDictationButtonProps) {
  const [lastInterim, setLastInterim] = useState('');

  const {
    status,
    isListening,
    isProcessing,
    audioLevel,
    error,
    startListening,
    stopListening,
  } = useSpeechToText({
    clinicalContext,
    continuous: true,
    autoPunctuation: true,
    onTranscriptChange: (text) => {
      onTranscript(text);
    },
    onInterimChange: (interim) => {
      setLastInterim(interim);
    },
  });

  const toggle = () => {
    if (isListening) {
      void stopListening();
    } else {
      void startListening();
    }
  };

  const isSmall = size === 'sm';

  return (
    <div className={clsx('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={isProcessing}
        title={isListening ? 'Click to stop dictation' : 'Click to start voice dictation'}
        className={clsx(
          'group relative inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2',
          isSmall ? 'h-8 px-2.5 text-xs gap-1.5 rounded-md' : 'h-10 px-3 text-sm gap-2 rounded-lg',
          isListening
            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 hover:bg-rose-600 animate-pulse'
            : variant === 'filled'
              ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm'
              : variant === 'ghost'
                ? 'text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800'
                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600 shadow-xs'
        )}
      >
        {/* Pulsing ring indicator while listening */}
        {isListening && (
          <span className="absolute -inset-1 -z-10 animate-ping rounded-lg bg-rose-400 opacity-40 duration-1000" />
        )}

        {/* Microphone icon */}
        <svg
          className={clsx(
            'transition-transform',
            isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4',
            isListening ? 'scale-110' : 'group-hover:scale-105'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>

        <span>
          {isProcessing ? 'Processing…' : isListening ? 'Listening…' : label}
        </span>

        {/* Live audio volume dot */}
        {isListening && (
          <span
            className="h-2 w-2 rounded-full bg-white transition-transform"
            style={{
              transform: `scale(${0.8 + (audioLevel / 100) * 1.4})`,
            }}
          />
        )}
      </button>

      {/* Floating mini interim transcription bubble if active */}
      {isListening && lastInterim && (
        <div className="absolute bottom-full left-0 z-50 mb-2 max-w-xs rounded-md bg-slate-900 px-3 py-1.5 text-xs text-slate-100 shadow-xl border border-slate-700 pointer-events-none animate-fadeIn">
          <span className="text-sky-400 font-semibold mr-1">Live:</span>
          <span className="italic">{lastInterim}</span>
        </div>
      )}

      {/* Error alert toast if mic blocked */}
      {error && !isListening && (
        <div className="absolute top-full left-0 z-50 mt-1 max-w-xs rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs text-rose-700 shadow-lg dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}
