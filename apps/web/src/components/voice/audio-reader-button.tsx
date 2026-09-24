'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useTextToSpeech } from '@/lib/voice/use-text-to-speech';

export interface AudioReaderButtonProps {
  text: string;
  voice?: string;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'outline' | 'ghost' | 'filled';
  showSpeedToggle?: boolean;
  className?: string;
}

export function AudioReaderButton({
  text,
  voice = 'clara',
  label = 'Read aloud',
  size = 'sm',
  variant = 'outline',
  showSpeedToggle = false,
  className,
}: AudioReaderButtonProps) {
  const [speedIndex, setSpeedIndex] = useState(0);
  const speeds = [1.0, 1.25, 1.5];

  const {
    status,
    isPlaying,
    isPaused,
    isLoading,
    speed,
    setSpeed,
    speak,
    pause,
    resume,
    stop,
  } = useTextToSpeech({
    defaultVoice: voice,
    defaultSpeed: speeds[speedIndex],
  });

  const isSmall = size === 'sm';

  const handleClick = () => {
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      void speak(text, voice);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (speedIndex + 1) % speeds.length;
    setSpeedIndex(nextIdx);
    setSpeed(speeds[nextIdx]!);
  };

  return (
    <div className={clsx('inline-flex items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || !text}
        title={isPlaying ? 'Pause speech' : isPaused ? 'Resume speech' : 'Read aloud with AI voice'}
        className={clsx(
          'group relative inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1',
          isSmall ? 'h-7 px-2 text-xs gap-1.5 rounded-md' : 'h-9 px-3 text-sm gap-2 rounded-lg',
          isPlaying
            ? 'bg-sky-600 text-white shadow-sm'
            : variant === 'filled'
              ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
              : variant === 'ghost'
                ? 'text-sky-700 hover:bg-sky-50 hover:text-sky-800'
                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-sky-400 hover:text-sky-600'
        )}
      >
        {/* Speaker or Pause Icon */}
        {isPlaying ? (
          <svg className={clsx(isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4')} fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg
            className={clsx(isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4', 'transition-transform group-hover:scale-110')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        )}

        <span>
          {isLoading ? 'Loading…' : isPlaying ? 'Playing' : isPaused ? 'Paused' : label}
        </span>

        {/* Small animated audio wave equalizer bars while playing */}
        {isPlaying && (
          <span className="flex items-center gap-0.5 ml-1">
            <span className="h-2 w-0.5 bg-white animate-pulse" />
            <span className="h-3 w-0.5 bg-white animate-bounce" />
            <span className="h-1.5 w-0.5 bg-white animate-pulse" />
          </span>
        )}
      </button>

      {/* Stop button when active */}
      {(isPlaying || isPaused) && (
        <button
          type="button"
          onClick={stop}
          title="Stop reading"
          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Speed toggle pill */}
      {showSpeedToggle && (
        <button
          type="button"
          onClick={cycleSpeed}
          title="Cycle speech playback speed"
          className="rounded-sm bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
        >
          {speed}x
        </button>
      )}
    </div>
  );
}
