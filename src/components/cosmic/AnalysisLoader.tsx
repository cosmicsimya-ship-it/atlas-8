import { useEffect, useState } from 'react';

const STAGES = [
  'Veriler eşleştiriliyor',
  'Zaman koordinatları kuruluyor',
  'Sayısal örüntüler çıkarılıyor',
  'Sembolik katmanlar karşılaştırılıyor',
  'Çelişkiler kontrol ediliyor',
  'Sentez hazırlanıyor',
];

export default function AnalysisLoader() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % STAGES.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <div
        className="mx-auto mb-6 h-12 w-12 rounded-full border border-[#c9b37a]/30 border-t-[#c9b37a] motion-safe:animate-spin"
        aria-hidden="true"
      />
      <p className="font-display text-xl text-[#e8ecf2]/90">Atlas analiz katmanlarını işliyor</p>
      <p className="mt-3 text-sm text-[#c9b37a]/75 motion-safe:transition-opacity" aria-live="polite">
        {STAGES[index]}…
      </p>
      <p className="mt-6 text-xs leading-relaxed text-[#e8ecf2]/38">
        Analiz sürüyor. Bu kısa sürebilir.
      </p>
    </div>
  );
}
