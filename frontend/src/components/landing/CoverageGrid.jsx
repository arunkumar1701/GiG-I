import React from 'react';
import { CloudRain, Flame, MapPinned } from 'lucide-react';

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
              <p className="text-slate-600 leading-relaxed font-medium">Heavy rain and flood events are validated from the configured weather feed, then evaluated through the fraud engine before payout settlement.</p>
           </div>
           
           <div className="bg-white border border-slate-200 p-10 rounded-3xl shadow-sm hover:shadow-xl hover:border-rose-300 hover:ring-4 ring-rose-50 transition transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-rose-100">
                <Flame className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Heatwave Exposure</h3>
              <p className="text-slate-600 leading-relaxed font-medium">Heatwave signals are supported through the same zone monitoring pipeline using temperature thresholds in the backend weather service.</p>
           </div>

           <div className="bg-white border border-slate-200 p-10 rounded-3xl shadow-sm hover:shadow-xl hover:border-amber-300 hover:ring-4 ring-amber-50 transition transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-amber-100">
                <MapPinned className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Manual Event Replay</h3>
              <p className="text-slate-600 leading-relaxed font-medium">Demo and testing flows can inject a zone event with driver ID and latitude/longitude to exercise the full fraud and payout pipeline.</p>
           </div>
        </div>
      </div>
    </section>
  );
}
