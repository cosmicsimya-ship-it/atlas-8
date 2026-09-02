import { cn } from '../../utils/cn';

interface AtlasCompassMarkProps {
  className?: string;
  compact?: boolean;
}

export default function AtlasCompassMark({ className, compact = false }: AtlasCompassMarkProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label="Atlas Kuzey Yıldızı"
      className={cn('atlas-compass-mark overflow-visible', compact && 'atlas-compass-mark-compact', className)}
    >
      <defs>
        <linearGradient id="atlasMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#c8cbd0" />
          <stop offset="68%" stopColor="#f3f3f2" />
          <stop offset="100%" stopColor="#858990" />
        </linearGradient>
        <radialGradient id="atlasCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="45%" stopColor="#d8dadd" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#8c9198" stopOpacity="0" />
        </radialGradient>
      </defs>

      {!compact && (
        <>
          <circle cx="160" cy="160" r="116" fill="none" stroke="#d9dadd" strokeOpacity="0.62" strokeWidth="1.25" />
          <circle cx="160" cy="160" r="98" fill="none" stroke="#f4f4f2" strokeOpacity="0.32" strokeWidth="1" />
          <circle cx="160" cy="44" r="3" fill="#f3f3f1" fillOpacity="0.82" />
          <circle cx="276" cy="160" r="3" fill="#f3f3f1" fillOpacity="0.72" />
          <circle cx="160" cy="276" r="3" fill="#f3f3f1" fillOpacity="0.72" />
          <circle cx="44" cy="160" r="3" fill="#f3f3f1" fillOpacity="0.72" />
          <g stroke="#bfc2c7" strokeOpacity="0.28" strokeWidth="0.8">
            {Array.from({ length: 32 }).map((_, i) => {
              const a = (i * 360) / 32;
              return <line key={i} x1="160" y1="51" x2="160" y2="57" transform={`rotate(${a} 160 160)`} />;
            })}
          </g>
        </>
      )}

      <g filter="drop-shadow(0 0 8px rgba(255,255,255,0.10))">
        <path d="M160 18 L176 123 L160 150 L144 123 Z" fill="url(#atlasMetal)" />
        <path d="M302 160 L197 176 L170 160 L197 144 Z" fill="url(#atlasMetal)" />
        <path d="M160 302 L144 197 L160 170 L176 197 Z" fill="url(#atlasMetal)" />
        <path d="M18 160 L123 144 L150 160 L123 176 Z" fill="url(#atlasMetal)" />

        <path d="M257 63 L187 139 L169 151 L181 133 Z" fill="#d9dade" fillOpacity="0.88" />
        <path d="M257 257 L181 187 L169 169 L187 181 Z" fill="#aeb2b8" fillOpacity="0.78" />
        <path d="M63 257 L139 181 L151 169 L133 187 Z" fill="#ececea" fillOpacity="0.82" />
        <path d="M63 63 L133 139 L151 151 L139 133 Z" fill="#b8bbc0" fillOpacity="0.76" />

        <path d="M160 132 L170 150 L188 160 L170 170 L160 188 L150 170 L132 160 L150 150 Z" fill="#f7f7f5" />
        <path d="M160 143 L167 153 L178 160 L167 167 L160 178 L153 167 L142 160 L153 153 Z" fill="#8d9298" fillOpacity="0.55" />
        <circle cx="160" cy="160" r="13" fill="url(#atlasCore)" />
      </g>
    </svg>
  );
}
