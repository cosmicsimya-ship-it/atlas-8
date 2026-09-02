import AtlasCompassMark from '../brand/AtlasCompassMark';
import { cn } from '../../utils/cn';

interface SymbolicBackgroundProps { className?: string; }

export default function SymbolicBackground({ className }: SymbolicBackgroundProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      <div className="absolute inset-0 bg-[#040405]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_76%_16%,rgba(255,255,255,0.04),transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.58))]" />

      <div className="absolute right-[-16rem] top-[8rem] h-[52rem] w-[52rem] opacity-[0.16]">
        <AtlasCompassMark className="h-full w-full" />
      </div>

      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        {[...Array(10)].map((_, i) => <line key={`h-${i}`} x1="0" y1={70 + i * 70} x2="1200" y2={96 + i * 68} stroke="#d8d9dc" strokeWidth="0.45" />)}
        {[...Array(8)].map((_, i) => <line key={`v-${i}`} x1={100 + i * 145} y1="0" x2={70 + i * 150} y2="800" stroke="#d8d9dc" strokeWidth="0.45" />)}
      </svg>

      <div className="site-grain opacity-[0.025]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(0,0,0,0.52)_100%)]" />
    </div>
  );
}
