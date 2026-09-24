'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useSpeechToText } from '@/lib/voice/use-speech-to-text';
import { useTextToSpeech } from '@/lib/voice/use-text-to-speech';
import { inspectDeviceDiagnostics, type DeviceDiagnostics } from '@/lib/voice/voice-permissions';
import { VoiceVisualizer } from './voice-visualizer';

export interface VoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'stt' | 'tts' | 'diagnostics';
  initialText?: string;
  onInsertText?: (text: string) => void;
}

const CLINICAL_DICTATION_PRESETS = [
  {
    title: 'Cardiology Follow-Up',
    context: 'SOAP_NOTE' as const,
    sample: 'Patient returns for 3-month hypertension review. Reports adherence to lisinopril 10 mg daily without dizziness or dry cough. Home blood pressure logs average 128 over 82. Plan: Continue current regimen, recheck basic metabolic panel in 6 months.',
  },
  {
    title: 'Urgent Care Triage',
    context: 'CHIEF_COMPLAINT' as const,
    sample: '42-year-old female presents with 48 hours of right lower quadrant abdominal pain, nausea, and low-grade temperature of 99.8 F. Denies dysuria or hematuria.',
  },
  {
    title: 'Pediatric Otitis Media',
    context: 'SOAP_NOTE' as const,
    sample: 'Child presents with right ear tugging, irritability, and poor sleep for 2 days. Tympanic membrane erythematous and bulging with diminished mobility. Assessment: Acute right otitis media. Plan: Amoxicillin 400 mg twice daily for 7 days.',
  },
  {
    title: 'After-Visit Discharge',
    context: 'PATIENT_COMMUNICATION' as const,
    sample: 'Today we reviewed your sprained ankle. Rest, apply ice 20 minutes three times daily, keep elevated when sitting, and wear the compression wrap. Call our clinic if swelling increases or if you cannot bear weight.',
  },
];

const TTS_CLINICAL_SCENARIOS = [
  {
    title: 'Care Plan: Hypertension Management',
    voice: 'clara',
    text: 'Hello. Your blood pressure readings are improving nicely on your current medication. Please continue taking your morning lisinopril with breakfast, maintain low dietary sodium, and log your readings twice a week.',
  },
  {
    title: 'Physician Handoff: Post-Op Day 1',
    voice: 'marcus',
    text: 'Attending brief: 58-year-old male post-op day one status post laparoscopic cholecystectomy. Vital signs are within normal limits. Tolerating liquids, surgical sites clean, dry, and intact. Discharge anticipated by midday.',
  },
  {
    title: 'Nurse Triage: Fever & Hydration Advice',
    voice: 'sarah',
    text: 'We reviewed your symptom report. If your fever remains below 101 degrees and you are staying hydrated with electrolyte fluids, rest is the most important treatment. Call us immediately if you experience shortness of breath.',
  },
  {
    title: 'Patient Education: Metformin Instructions',
    voice: 'james',
    text: 'Important reminders about taking your metformin: Always take this medication with your largest meal to avoid stomach upset. If you miss a dose, take it as soon as you remember, but never take two doses at the same time.',
  },
];

export function VoiceStudioModal({
  isOpen,
  onClose,
  initialTab = 'stt',
  initialText = '',
  onInsertText,
}: VoiceStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'stt' | 'tts' | 'diagnostics'>(initialTab);
  const [diagnostics, setDiagnostics] = useState<DeviceDiagnostics | null>(null);
  const [ttsInput, setTtsInput] = useState<string>(
    initialText || TTS_CLINICAL_SCENARIOS[0]!.text
  );
  const [copied, setCopied] = useState(false);

  // STT Hook
  const {
    status: sttStatus,
    transcript,
    interimTranscript,
    isListening,
    audioLevel,
    permissionState,
    error: sttError,
    activeEngine,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  } = useSpeechToText({
    continuous: true,
    autoPunctuation: true,
  });

  // TTS Hook
  const {
    isPlaying,
    isPaused,
    isLoading: ttsLoading,
    selectedVoice,
    setSelectedVoice,
    speed,
    setSpeed,
    pitch,
    setPitch,
    spokenWord,
    error: ttsError,
    serverVoices,
    speak,
    pause,
    resume,
    stop: stopTts,
    downloadAudio,
  } = useTextToSpeech({
    defaultVoice: 'clara',
  });

  useEffect(() => {
    if (isOpen) {
      setDiagnostics(inspectDeviceDiagnostics());
    } else {
      stopListening();
      stopTts();
    }
  }, [isOpen, stopListening, stopTts]);

  if (!isOpen) return null;

  const handleCopyTranscript = () => {
    if (!transcript) return;
    void navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (transcript && onInsertText) {
      onInsertText(transcript);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-md shadow-sky-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                ClinicBridge Voice Studio
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Real-Time Voice AI
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Medical Speech-to-Text Transcription & Natural Voice Synthesis Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('stt')}
            className={clsx(
              'flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition',
              activeTab === 'stt'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Speech-to-Text (Dictation)
            {isListening && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('tts')}
            className={clsx(
              'flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition',
              activeTab === 'tts'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            Text-to-Speech (Synthesis)
            {isPlaying && (
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={clsx(
              'flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition',
              activeTab === 'diagnostics'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Device Diagnostics & Privacy
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SPEECH TO TEXT */}
          {activeTab === 'stt' && (
            <div className="space-y-6">
              {/* Mic Control Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) stopListening();
                      else void startListening();
                    }}
                    className={clsx(
                      'relative flex items-center justify-center w-16 h-16 rounded-full text-white shadow-lg transition-all focus:outline-none focus:ring-4',
                      isListening
                        ? 'bg-rose-500 hover:bg-rose-600 ring-rose-300 dark:ring-rose-800 scale-105 animate-pulse'
                        : 'bg-sky-600 hover:bg-sky-700 ring-sky-300 dark:ring-sky-800'
                    )}
                  >
                    {isListening && (
                      <span className="absolute -inset-2 rounded-full border-2 border-rose-400 animate-ping opacity-60" />
                    )}
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isListening ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      )}
                    </svg>
                  </button>

                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      {isListening ? 'Listening to speech…' : 'Microphone Ready'}
                      <span
                        className={clsx(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          isListening
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        )}
                      >
                        {isListening ? `Live (${activeEngine})` : 'Idle'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isListening
                        ? 'Speak clearly into your microphone. Punctuation words like "period", "comma", and "new line" are converted automatically.'
                        : 'Click the microphone button to start voice dictation in real time.'}
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-48 flex flex-col items-center">
                  <VoiceVisualizer isActive={isListening} audioLevel={audioLevel} size="md" />
                  <span className="text-[11px] text-slate-400 font-mono">
                    Volume: {audioLevel}%
                  </span>
                </div>
              </div>

              {/* Error notice if microphone denied */}
              {sttError && (
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200 text-xs">
                  <span className="font-semibold">Notice:</span> {sttError}
                </div>
              )}

              {/* Live Transcript Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Live Clinical Transcript
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyTranscript}
                      disabled={!transcript}
                      className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 disabled:opacity-40 flex items-center gap-1 font-medium"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <button
                      type="button"
                      onClick={resetTranscript}
                      disabled={!transcript && !interimTranscript}
                      className="text-xs text-slate-500 hover:text-rose-600 disabled:opacity-40 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative min-h-[160px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-100 shadow-inner">
                  {transcript || interimTranscript ? (
                    <div>
                      <span>{transcript}</span>
                      {interimTranscript && (
                        <span className="text-sky-600 dark:text-sky-400 italic bg-sky-50 dark:bg-sky-950/40 px-1 rounded-sm ml-1">
                          {interimTranscript}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 italic">
                      Transcribed words will stream here live as you speak…
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Preset Scenarios */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Or Test with Clinical Dictation Scenarios
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CLINICAL_DICTATION_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => setTranscript(preset.sample)}
                      className="p-3 text-left rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-800/30 hover:bg-sky-50/50 dark:hover:bg-slate-800 transition group"
                    >
                      <span className="block font-medium text-xs text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {preset.title}
                      </span>
                      <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {preset.sample}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEXT TO SPEECH */}
          {activeTab === 'tts' && (
            <div className="space-y-6">
              {/* Voice Personas Catalog */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Clinical Voice Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(serverVoices.length > 0 ? serverVoices : [
                    { id: 'clara', name: 'Dr. Clara Vance', title: 'Warm Physician', description: 'Reassuring, clear enunciation for care plans.', tone: 'Compassionate', gender: 'female' },
                    { id: 'marcus', name: 'Dr. Marcus Sterling', title: 'Attending Physician', description: 'Crisp, measured delivery for rapid clinical handoffs.', tone: 'Authoritative', gender: 'male' },
                    { id: 'sarah', name: 'Nurse Sarah Jenkins', title: 'Care Coordinator', description: 'Empathetic cadence suited for triage and follow-up.', tone: 'Gentle', gender: 'female' },
                    { id: 'james', name: 'James Reynolds', title: 'Patient Educator', description: 'Patient-friendly pacing for medication instructions.', tone: 'Accessible', gender: 'male' },
                  ]).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVoice(v.id)}
                      className={clsx(
                        'flex items-start gap-3 p-3.5 rounded-xl border text-left transition',
                        selectedVoice === v.id
                          ? 'border-sky-600 bg-sky-50/60 dark:bg-sky-950/40 dark:border-sky-500 ring-2 ring-sky-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0',
                          selectedVoice === v.id
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        )}
                      >
                        {v.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-slate-900 dark:text-white">
                            {v.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {v.tone}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {v.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input to Synthesize */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Text to Synthesize into Speech
                  </label>
                  <span className="text-xs text-slate-400 font-mono">
                    {ttsInput.length} / 5000 chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={ttsInput}
                  onChange={(e) => setTtsInput(e.target.value)}
                  placeholder="Enter medical instructions, care advice, or SOAP notes to convert to speech…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Playback Controls & Settings */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) pause();
                      else if (isPaused) resume();
                      else void speak(ttsInput, selectedVoice);
                    }}
                    disabled={ttsLoading || !ttsInput}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm shadow-md shadow-sky-500/20 transition disabled:opacity-50"
                  >
                    {isPlaying ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                        Pause
                      </>
                    ) : isPaused ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Resume
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        {ttsLoading ? 'Synthesizing…' : 'Generate Speech'}
                      </>
                    )}
                  </button>

                  {(isPlaying || isPaused) && (
                    <button
                      type="button"
                      onClick={stopTts}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium"
                    >
                      Stop
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void downloadAudio(ttsInput, selectedVoice)}
                    disabled={!ttsInput}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Audio
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Speed:</span>
                    {[0.75, 1.0, 1.25, 1.5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-semibold',
                          speed === s
                            ? 'bg-sky-600 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Spoken Word Tracker */}
              {spokenWord && (
                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200 flex items-center gap-2">
                  <span className="font-semibold">Current word:</span>
                  <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-mono font-bold">
                    {spokenWord}
                  </span>
                </div>
              )}

              {/* Sample Scenarios */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pre-loaded Clinical Scenarios
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TTS_CLINICAL_SCENARIOS.map((sc) => (
                    <button
                      key={sc.title}
                      type="button"
                      onClick={() => {
                        setTtsInput(sc.text);
                        setSelectedVoice(sc.voice);
                      }}
                      className="p-3 text-left rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-800/30 hover:bg-sky-50/50 transition group"
                    >
                      <span className="block font-medium text-xs text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {sc.title}
                      </span>
                      <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {sc.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS & PRIVACY */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 space-y-4">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                  Browser & Hardware Capability Audit
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Microphone Permission</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full font-semibold',
                        permissionState === 'granted'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : permissionState === 'denied'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      )}
                    >
                      {permissionState.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Web Speech API (STT)</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full font-semibold',
                        diagnostics?.hasSpeechRecognition
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {diagnostics?.hasSpeechRecognition ? 'Supported (Real-Time)' : 'Fallback Active (MediaRecorder)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Speech Synthesis (TTS)</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full font-semibold',
                        diagnostics?.hasSpeechSynthesis ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {diagnostics?.hasSpeechSynthesis ? 'Supported' : 'Not Supported'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">AudioContext Analyser</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full font-semibold',
                        diagnostics?.hasAudioContext ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {diagnostics?.hasAudioContext ? 'Supported' : 'Not Supported'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">MediaRecorder (Audio Chunks)</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full font-semibold',
                        diagnostics?.hasMediaRecorder ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {diagnostics?.hasMediaRecorder ? 'Supported' : 'Not Supported'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Secure Context (HTTPS / Localhost)</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full font-semibold',
                        diagnostics?.isSecureContext ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {diagnostics?.isSecureContext ? 'Active' : 'Insecure'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Privacy and Security Guardrails */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40 space-y-2 text-xs text-sky-900 dark:text-sky-200">
                <h4 className="font-bold flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  HIPAA & Privacy Safeguards
                </h4>
                <p>
                  Audio streams are processed locally where supported or transmitted exclusively over TLS 1.3 to the ClinicBridge Trust Boundary. Transcripts undergo automated PHI redaction via regex rule masks before any external cloud service is contacted.
                </p>
              </div>

              {/* Troubleshooting Instructions */}
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  Troubleshooting Microphone Permissions
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Chrome / Edge:</strong> Click the padlock or tune icon in the address bar (left of the URL) and toggle Microphone to &quot;Allow&quot;.</li>
                  <li><strong>Safari:</strong> Go to Safari &gt; Settings &gt; Websites &gt; Microphone, and set this website to &quot;Allow&quot;.</li>
                  <li><strong>Firefox:</strong> Click the permissions icon on the address bar and clear the blocked status.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>ClinicBridge Voice Engine Active</span>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'stt' && onInsertText && transcript && (
              <button
                type="button"
                onClick={handleInsert}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs shadow-sm transition"
              >
                Insert into Document
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs transition"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
