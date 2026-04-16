import React, { useState } from 'react';
import { Terminal, Lightbulb } from 'lucide-react';

const ZONE_LOCATIONS = {
  'Zone A': { lat: 13.0827, lon: 80.2707 },
  'Zone B': { lat: 13.0604, lon: 80.2496 },
  'Zone C': { lat: 12.9941, lon: 80.2404 },
  'Zone D': { lat: 12.9716, lon: 80.2209 },
};

export default function DevPanel({ isVisible, toggleVisibility, activePolicy, onTriggerWebhook }) {
  const [selectedZone, setSelectedZone] = useState('Zone A');

  if (!isVisible) return null;

  const triggerEvent = (type, amount) => {
    onTriggerWebhook(type, amount, selectedZone, ZONE_LOCATIONS[selectedZone]);
  };

  return (
    <div className="fixed bottom-20 right-6 md:bottom-20 md:right-8 z-[100] w-[calc(100vw-3rem)] md:w-96 bg-slate-900/80 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 overflow-hidden animate-in slide-in-from-bottom-8">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-emerald-400"></div>

      <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
        <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-2 drop-shadow-md">
          <Terminal className="w-4 h-4 text-cyan-400" />
          Replay Mode: Demo Panel
        </h3>
        <button onClick={toggleVisibility} className="text-slate-400 hover:text-white transition bg-white/5 border border-white/10 p-1.5 rounded">
          <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
        </button>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Target Zone</label>
        <select
          value={selectedZone}
          onChange={(event) => setSelectedZone(event.target.value)}
          className="w-full rounded-xl bg-black/30 border border-white/10 text-slate-100 px-3 py-3 font-bold"
        >
          {Object.keys(ZONE_LOCATIONS).map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {[
          { t: 'Heavy Rain', p: 500, label: 'Simulate Heavy Rain' },
          { t: 'Heatwave', p: 400, label: 'Simulate Heatwave' },
          { t: 'Curfew Gridlock', p: 800, label: 'Simulate Local Curfew' },
          { t: 'Flood Waterlogging', p: 1200, label: 'Simulate Severe Flood' },
        ].map((hook) => (
          <button
            key={hook.t}
            disabled={!activePolicy}
            onClick={() => triggerEvent(hook.t, hook.p)}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-50 font-bold p-3 rounded-xl flex items-center justify-center gap-2 transition shadow-[0_0_15px_rgb(6,182,212,0.4)] disabled:opacity-50 disabled:shadow-none border border-cyan-400/20 disabled:border-transparent"
          >
            <span>{hook.label} in {selectedZone}</span>
          </button>
        ))}
      </div>

      {!activePolicy ? (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex gap-2 items-start shadow-inner">
          <Lightbulb className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0 drop-shadow-md" />
          <p className="text-[10px] text-rose-300 font-semibold leading-tight drop-shadow-sm">Must purchase policy before testing replay mode triggers.</p>
        </div>
      ) : (
        <div className="mt-5 text-center px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgb(52,211,153,0.1)] inline-block w-full">
          <p className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase drop-shadow-md">Hooks Ready // Multi-Pass Fraud Engine Active</p>
        </div>
      )}
    </div>
  );
}
