import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../services/api-client';
import { synthesizeSpeechAudio } from '../../services/atlas-voice';

export type VoicePlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type UseVoicePlaybackOptions = {
  voice?: string;
  language?: string;
};

/**
 * Minimal TTS playback hook.
 * Does not autoplay — call play() from a user gesture (required on iOS Safari).
 */
export function useVoicePlayback(options: UseVoicePlaybackOptions = {}) {
  const [state, setState] = useState<VoicePlaybackState>('idle');
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastTextRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  function revokeUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  async function ensureAudio(text: string) {
    if (
      lastTextRef.current === text &&
      audioRef.current &&
      audioRef.current.src &&
      objectUrlRef.current
    ) {
      return audioRef.current;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState('loading');
    setError(null);

    const { blob } = await synthesizeSpeechAudio({
      text,
      voice: options.voice || 'lara',
      language: options.language || 'tr-TR',
      signal: abortRef.current.signal,
    });

    revokeUrl();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    lastTextRef.current = text;

    const audio = audioRef.current || new Audio();
    audio.preload = 'auto';
    // iOS: playsInline helps; still requires user gesture to start.
    audio.setAttribute('playsinline', 'true');
    audio.src = url;
    audio.onended = () => setState('idle');
    audio.onpause = () => {
      if (!audio.ended) setState('paused');
    };
    audio.onplay = () => setState('playing');
    audio.onerror = () => {
      setState('error');
      setError('Ses oynatılamadı.');
    };
    audioRef.current = audio;
    return audio;
  }

  async function play(text: string) {
    try {
      const audio = await ensureAudio(text);
      // Must be called in the same user-gesture stack when possible.
      await audio.play();
      setState('playing');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ses üretilemedi.';
      setError(message);
      setState('error');
    }
  }

  function pause() {
    audioRef.current?.pause();
    setState('paused');
  }

  async function replay() {
    const text = lastTextRef.current;
    if (!text || !audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setState('playing');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Yeniden oynatılamadı.';
      setError(message);
      setState('error');
    }
  }

  function stop() {
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState('idle');
  }

  return {
    state,
    error,
    play,
    pause,
    replay,
    stop,
    isLoading: state === 'loading',
    isPlaying: state === 'playing',
  };
}
