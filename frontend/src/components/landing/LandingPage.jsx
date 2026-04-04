import React from 'react';
import Header from './Header';
import Hero from './Hero';
import TrustBar from './TrustBar';
import CoverageGrid from './CoverageGrid';
import HowItWorks from './HowItWorks';

export default function LandingPage({ onLoginClick }) {
  return (
    <div className="bg-slate-50 font-sans selection:bg-blue-100 relative">
      <Header onLoginClick={onLoginClick} />
      {/* 20px padding to offset the 80px fixed header cleanly */}
      <div className="pt-20"> 
          <Hero onGetQuote={onLoginClick} />
          <TrustBar />
          <CoverageGrid />
          <HowItWorks />
      </div>
      
      <footer className="bg-slate-900 py-16 border-t border-slate-800 text-center md:text-left">
         <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
            <div>
               <span className="font-black text-white text-2xl tracking-tight block mb-2">DEVTrails Protect</span>
               <p className="text-slate-500 text-sm font-medium">The Enterprise Parametric Infrastructure MVP.</p>
            </div>
            <p className="text-slate-500 text-xs mt-8 md:mt-0 font-bold uppercase tracking-wider">© 2026 Phase 2. All rights reserved.</p>
         </div>
      </footer>
    </div>
  );
}
