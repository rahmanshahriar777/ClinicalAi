'use client';

import { useState } from 'react';
import { VoiceStudioModal } from './voice-studio-modal';

export function VoiceFloatingTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Open ClinicBridge Voice Studio (Dictation & Speech AI)"
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-3 text-white shadow-xl shadow-sky-600/30 transition-all hover:scale-105 hover:shadow-sky-600/40 focus:outline-none focus:ring-4 focus:ring-sky-300 dark:focus:ring-sky-900"
        >
          {/* Subtle pulse ring */}
          <span className="absolute -inset-0.5 -z-10 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 opacity-40 blur-xs transition group-hover:opacity-75" />

          {/* Combined Mic & Waveform Icon */}
          <div className="flex items-center justify-center">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>

          <span className="font-semibold text-xs tracking-wide">
            Voice Studio
          </span>

          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        </button>
      </div>

      <VoiceStudioModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
