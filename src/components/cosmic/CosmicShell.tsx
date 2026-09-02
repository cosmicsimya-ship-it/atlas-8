import type { ReactNode } from 'react';

import CosmicNav from './CosmicNav';
import SymbolicBackground from './SymbolicBackground';

interface CosmicShellProps {
  children: ReactNode;
  transparentNav?: boolean;
  showBackground?: boolean;
  chatMode?: boolean;
  className?: string;
}

export default function CosmicShell({ children, transparentNav = false, showBackground = true, chatMode = false, className = '' }: CosmicShellProps) {
  return (
    <div className={`atlas-compass-shell relative min-h-[100dvh] ${className}`}>
      <a href="#cosmic-main" className="atlas-skip-link">İçeriğe geç</a>
      {showBackground && <SymbolicBackground />}
      <CosmicNav transparent={transparentNav || chatMode} chatMode={chatMode} />
      <div id="cosmic-main" className="relative z-10">{children}</div>
    </div>
  );
}
