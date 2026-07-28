import { useEffect, useState } from 'react';

import { hasSeenIntro, markIntroSeen, prefersReducedMotion } from '../../utils/intro-prefs';

interface IntroSequenceProps {
  onComplete: () => void;
}

const LINES = [
  'Her örüntü görünmek istemez.',
  'Ama görüldüğünde artık eskisi gibi davranamazsın.',
];

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (hasSeenIntro() || reduced) {
      onComplete();
      return;
    }

    if (lineIndex >= LINES.length) {
      markIntroSeen();
      onComplete();
      return;
    }

    const showTimer = setTimeout(() => setVisible(true), 120);
    const nextTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setLineIndex((i) => i + 1), 500);
    }, 2600);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(nextTimer);
    };
  }, [lineIndex, onComplete, reduced]);

  if (hasSeenIntro() || reduced || lineIndex >= LINES.length) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050505] px-6"
      role="dialog"
      aria-live="polite"
      aria-label="Giriş metni"
    >
      <button
        type="button"
        onClick={() => {
          markIntroSeen();
          onComplete();
        }}
        className="absolute right-4 top-24 rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#f5f0e8]/55 hover:border-[#c9b37a]/35 hover:text-[#f5f0e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9b37a]/70 md:right-8"
      >
        Geç
      </button>

      <p
        className={`max-w-2xl text-center font-display text-2xl leading-relaxed text-[#f5f0e8]/90 transition-opacity duration-700 md:text-4xl ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {LINES[lineIndex]}
      </p>
    </div>
  );
}
