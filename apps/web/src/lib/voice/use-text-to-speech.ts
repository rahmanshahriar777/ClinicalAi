'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { VoicePersona } from '@app/shared';

export type TTSStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface UseTextToSpeechOptions {
  defaultVoice?: string;
  defaultSpeed?: number;
  defaultPitch?: number;
  onEnd?: () => void;
  onBoundary?: (charIndex: number, word: string) => void;
  onError?: (err: string) => void;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const {
    defaultVoice = 'clara',
    defaultSpeed = 1.0,
    defaultPitch = 1.0,
    onEnd,
    onBoundary,
  } = options;

  const [status, setStatus] = useState<TTSStatus>('idle');
  const [selectedVoice, setSelectedVoice] = useState<string>(defaultVoice);
  const [speed, setSpeed] = useState<number>(defaultSpeed);
  const [pitch, setPitch] = useState<number>(defaultPitch);
  const [volume, setVolume] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  const [spokenWord, setSpokenWord] = useState<string>('');
  const [charIndex, setCharIndex] = useState<number>(0);
  const [activeText, setActiveText] = useState<string>('');
  const [serverVoices, setServerVoices] = useState<VoicePersona[]>([]);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Load available server personas and browser speech voices
  useEffect(() => {
    // 1. Fetch server voice catalog
    api().voice.status()
      .then((res) => {
        if (res.voices?.length) {
          setServerVoices(res.voices);
        }
      })
      .catch((err) => {
        console.warn('Voice catalog fetch note:', err);
      });

    // 2. Load browser voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadBrowserVoices = () => {
        const v = window.speechSynthesis.getVoices();
        setBrowserVoices(v);
      };
      loadBrowserVoices();
      window.speechSynthesis.onvoiceschanged = loadBrowserVoices;
    }

    return () => {
      stop();
    };
  }, []);

  const stop = useCallback(() => {
    setStatus('idle');
    isPlayingRef.current = false;
    setSpokenWord('');
    setCharIndex(0);

    // Cancel browser synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    }

    // Stop audio element if playing server audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setStatus('paused');
      return;
    }
    if (audioElementRef.current && !audioElementRef.current.paused) {
      audioElementRef.current.pause();
      setStatus('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setStatus('playing');
      return;
    }
    if (audioElementRef.current && audioElementRef.current.paused) {
      void audioElementRef.current.play();
      setStatus('playing');
    }
  }, []);

  const speak = useCallback(async (text: string, voiceOverride?: string) => {
    if (!text || !text.trim()) return;

    stop();
    setError(null);
    setActiveText(text);
    const targetVoiceId = voiceOverride || selectedVoice;

    // Check if browser native SpeechSynthesis is available
    const hasBrowserTts = typeof window !== 'undefined' && 'speechSynthesis' in window;

    if (hasBrowserTts) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;
        utterance.rate = speed;
        utterance.pitch = pitch;
        utterance.volume = volume;

        // Choose appropriate browser voice matching persona gender/tone
        const voices = browserVoices.length ? browserVoices : window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // Attempt to match preferred voice
          let matchedVoice: SpeechSynthesisVoice | undefined;
          if (targetVoiceId === 'marcus' || targetVoiceId === 'james') {
            matchedVoice = voices.find((v) => /male|david|mark|george|james|guy/i.test(v.name) && v.lang.startsWith('en'));
          } else {
            // Clara or Sarah (female)
            matchedVoice = voices.find((v) => /female|zira|samantha|victoria|karen|susan/i.test(v.name) && v.lang.startsWith('en'));
          }
          utterance.voice = matchedVoice || voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
        }

        utterance.onstart = () => {
          setStatus('playing');
          isPlayingRef.current = true;
        };

        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            const index = event.charIndex;
            setCharIndex(index);
            const remaining = text.slice(index);
            const nextWord = remaining.split(/\s+/)[0] || '';
            setSpokenWord(nextWord);
            onBoundary?.(index, nextWord);
          }
        };

        utterance.onend = () => {
          setStatus('idle');
          isPlayingRef.current = false;
          setSpokenWord('');
          onEnd?.();
        };

        utterance.onerror = (e) => {
          console.warn('Browser speech error, trying server synthesis fallback:', e);
          fallbackToServerSynthesis(text, targetVoiceId);
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn('Native speech synthesis launch failed, falling back:', err);
        fallbackToServerSynthesis(text, targetVoiceId);
        return;
      }
    }

    // Fallback if browser lacks speechSynthesis
    fallbackToServerSynthesis(text, targetVoiceId);
  }, [browserVoices, defaultPitch, onBoundary, onEnd, pitch, selectedVoice, speed, stop, volume]);

  const fallbackToServerSynthesis = useCallback(async (text: string, voiceId: string) => {
    setStatus('loading');
    try {
      const res = await api().voice.synthesize({
        text,
        voice: voiceId,
        speed,
        pitch,
        format: 'wav',
        language: 'en-US',
      });

      if (res.audioBase64) {
        const audioSrc = `data:${res.mimeType || 'audio/wav'};base64,${res.audioBase64}`;
        const audio = new Audio(audioSrc);
        audioElementRef.current = audio;
        audio.playbackRate = speed;
        audio.volume = volume;

        audio.onplay = () => {
          setStatus('playing');
          isPlayingRef.current = true;
        };

        audio.onended = () => {
          setStatus('idle');
          isPlayingRef.current = false;
          setSpokenWord('');
          onEnd?.();
        };

        audio.onerror = () => {
          setError('Audio playback error occurred.');
          setStatus('error');
        };

        await audio.play();
      } else {
        setStatus('idle');
      }
    } catch (err) {
      setError(`Speech synthesis error: ${(err as Error).message}`);
      setStatus('error');
    }
  }, [pitch, speed, volume, onEnd]);

  const downloadAudio = useCallback(async (text: string, voiceId?: string) => {
    try {
      const res = await api().voice.synthesize({
        text,
        voice: voiceId || selectedVoice,
        speed,
        pitch,
        format: 'wav',
        language: 'en-US',
      });

      if (res.audioBase64) {
        const blob = await fetch(`data:${res.mimeType || 'audio/wav'};base64,${res.audioBase64}`).then((r) => r.blob());
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clinicbridge-speech-${res.voice || 'audio'}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(`Audio download failed: ${(err as Error).message}`);
    }
  }, [pitch, selectedVoice, speed]);

  return {
    status,
    isPlaying: status === 'playing',
    isPaused: status === 'paused',
    isLoading: status === 'loading',
    selectedVoice,
    setSelectedVoice,
    speed,
    setSpeed,
    pitch,
    setPitch,
    volume,
    setVolume,
    spokenWord,
    charIndex,
    activeText,
    error,
    serverVoices,
    browserVoices,
    speak,
    pause,
    resume,
    stop,
    downloadAudio,
  };
}
