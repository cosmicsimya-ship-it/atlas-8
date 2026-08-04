import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import AtlasNav from '../components/landing/AtlasNav';
import AtlasPrinciples from '../components/landing/AtlasPrinciples';
import DailyAnalysisPreview from '../components/landing/DailyAnalysisPreview';
import FinalCTA from '../components/landing/FinalCTA';
import HeroSection from '../components/landing/HeroSection';
import HowAtlasWorks from '../components/landing/HowAtlasWorks';
import SiteAtmosphere from '../components/landing/SiteAtmosphere';
import SiteFooter from '../components/landing/SiteFooter';
import WhatIsAtlas from '../components/landing/WhatIsAtlas';

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
        <WhatIsAtlas />
        <HowAtlasWorks />
        <DailyAnalysisPreview />
        <AtlasPrinciples />
        <FinalCTA />
      </main>
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}
