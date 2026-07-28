import type { ReactNode } from 'react';

import CosmicNav from './CosmicNav';
import SymbolicBackground from './SymbolicBackground';

interface CosmicShellProps {
  children: ReactNode;
  transparentNav?: boolean;
  showBackground?: boolean;
  className?: string;
}

export default function CosmicShell({
  children,
  transparentNav = false,
  showBackground = true,
  className = '',
}: CosmicShellProps) {
  return (
    <div className={`relative min-h-[100dvh] bg-[#050505] text-[#f5f0e8] ${className}`}>
      {showBackground && <SymbolicBackground />}
      <CosmicNav transparent={transparentNav} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
