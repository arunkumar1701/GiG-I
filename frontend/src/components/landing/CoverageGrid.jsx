import React from 'react';
import { CloudRain, ServerCrash, Car } from 'lucide-react';

export default function CoverageGrid() {
  return (
    <section id="coverage" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Comprehensive Parametric Coverage</h2>
          <p className="text-slate-500 mt-6 max-w-2xl mx-auto text-lg font-medium">We strictly cover the uncontrollable disruptions that break your earning streaks. Zero claims adjusting, strictly mathematical triggers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="bg-white border border-slate-200 p-10 rounded-3xl shadow-sm hover:shadow-xl hover:border-sky-300 hover:ring-4 ring-sky-50 transition transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-sky-100">
                <CloudRain className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Severe Weather</h3>
              <p className="text-slate-600 leading-relaxed font-medium">Monsoon & Heatwave Protection. Payouts triggered immediately if local precipitation exceeds 15mm/hr during your active shifts.</p>
           </div>
           
           <div className="bg-white border border-slate-200 p-10 rounded-3xl shadow-sm hover:shadow-xl hover:border-rose-300 hover:ring-4 ring-rose-50 transition transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-rose-100">
                <ServerCrash className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Platform Outages</h3>
              <p className="text-slate-600 leading-relaxed font-medium">App Downtime Guarantee. Payouts mathematically triggered the second your primary delivery platform's servers crash (Error 503).</p>
           </div>

           <div className="bg-white border border-slate-200 p-10 rounded-3xl shadow-sm hover:shadow-xl hover:border-amber-300 hover:ring-4 ring-amber-50 transition transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-amber-100">
                <Car className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Urban Gridlock</h3>
              <p className="text-slate-600 leading-relaxed font-medium">Protection against unplanned local strikes and VIP movement. Automatic ledger payout when zone speeds drop below 8km/h.</p>
           </div>
        </div>
      </div>
    </section>
  );
}
