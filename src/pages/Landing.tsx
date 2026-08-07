import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import AlreadyThere from '../components/landing/AlreadyThere';
import AtlasLooks from '../components/landing/AtlasLooks';
import AtlasNav from '../components/landing/AtlasNav';
import ConvergenceSection from '../components/landing/ConvergenceSection';
import DailyAnalysisPreview from '../components/landing/DailyAnalysisPreview';
import FinalCTA from '../components/landing/FinalCTA';
import HeroSection from '../components/landing/HeroSection';
import ManifestoTeaser from '../components/landing/ManifestoTeaser';
import PatternSelf from '../components/landing/PatternSelf';
import SiteAtmosphere from '../components/landing/SiteAtmosphere';
import SiteFooter from '../components/landing/SiteFooter';

export default function Landing() {
  const [params] = useSearchParams();
  const adminLogin = useMemo(() => params.get('admin') === '1', [params]);

  return (
    <div className="relative min-h-[100dvh] bg-[#050608] text-[#e8ecf2]">
      <a href="#main-content" className="atlas-skip-link">
        İçeriğe geç
      </a>
      <SiteAtmosphere />
      <AtlasNav autoOpenLogin={adminLogin} />
      <main id="main-content" className="relative z-10">
        <HeroSection />
        <AlreadyThere />
        <ConvergenceSection />
        <PatternSelf />
        <AtlasLooks />
        <ManifestoTeaser />
        <DailyAnalysisPreview />
        <FinalCTA />
      </main>
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}
