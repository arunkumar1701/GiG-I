import React from 'react';

export default function HowItWorks() {
  return (
    <section id="claims" className="py-24 bg-white border-t border-slate-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="text-center mb-24 relative z-10">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">Zero Claims.<br className="md:hidden"/> Zero Waiting.</h2>
          <p className="text-slate-500 mt-6 text-lg max-w-2xl mx-auto font-medium">Our asynchronous routing engine does the heavy lifting for you.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-4 relative z-10">
           
           {/* Desktop Connecting Line */}
           <div className="hidden md:block absolute top-[44px] left-20 right-20 h-1 bg-slate-100 -z-10"></div>

           <div className="flex-1 text-center flex flex-col items-center px-4 w-full md:w-auto">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-2xl font-black text-3xl flex items-center justify-center mb-8 shadow-xl shadow-blue-600/20 rotate-3 transition transform hover:scale-110">1</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">AI Monitors Risk</h3>
              <p className="text-slate-600 font-medium">Our algorithms asynchronously track local weather and traffic APIs 24/7 strictly mapping to your delivery zone.</p>
           </div>

           <div className="flex-1 text-center flex flex-col items-center px-4 w-full md:w-auto mt-8 md:mt-0">
              <div className="w-20 h-20 bg-blue-800 text-white rounded-2xl font-black text-3xl flex items-center justify-center mb-8 shadow-xl shadow-blue-800/20 -rotate-3 transition transform hover:scale-110">2</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Disruption Detected</h3>
              <p className="text-slate-600 font-medium">A parametric trigger is breached locally (e.g. Heavy Rain &gt; 15mm/h is rigorously validated by MET servers).</p>
           </div>

           <div className="flex-1 text-center flex flex-col items-center px-4 w-full md:w-auto mt-8 md:mt-0">
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-2xl font-black text-3xl flex items-center justify-center mb-8 shadow-xl shadow-emerald-500/20 rotate-3 transition transform hover:scale-110">3</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Instant Payout</h3>
              <p className="text-slate-600 font-medium">Money is instantly deposited into your ledger via smart-contract logic. No human paperwork, completely zero-touch.</p>
           </div>

        </div>
      </div>
    </section>
  );
}
