import React from 'react';
import { Clock, MapPin, Download, AlertCircle, CloudRain, ServerCrash, Car, Activity, ShieldCheck } from 'lucide-react';

export default function Dashboard({ user, activePolicy, claims, setActiveTab }) {
  if (!user) return null;

  const activeCoverageLimit = activePolicy ? 1700 : 0;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md">Overview</h2>
        
        {/* LIVE RISK RADAR */}
        <div className="bg-slate-900/60 backdrop-blur-xl px-4 py-2 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.5)] border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-right">
            <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgb(52,211,153,0.8)]"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Live Zone Radar</span>
            </div>
            <div className="h-4 w-px bg-white/10"></div>
            <div className="flex gap-3 text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1"><CloudRain className="w-3.5 h-3.5 text-cyan-400"/> 32°C, Clear</span>
                <span className="flex items-center gap-1"><ServerCrash className="w-3.5 h-3.5 text-emerald-400"/> App: OK</span>
                <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5 text-amber-400"/> Traffic: Mod</span>
            </div>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-slate-900/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.5)] border border-white/10 relative overflow-hidden flex flex-col md:flex-row md:items-start justify-between gap-6 md:gap-12">
        
        <div className="relative z-10 flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-400/30 mb-6 backdrop-blur-sm">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest drop-shadow-md">{user.base_zone}</span>
          </div>
          
          <p className="text-slate-400 font-extrabold text-sm mb-1 uppercase tracking-widest drop-shadow-md">Income Status</p>
          {activePolicy ? (
            <>
              <h3 className="text-3xl lg:text-4xl font-black mb-3 text-white tracking-tight drop-shadow-lg">Active Weekly Protection</h3>
              <div className="flex items-center gap-2 text-cyan-300 bg-cyan-500/10 px-4 py-2.5 rounded-xl border border-cyan-400/20 inline-flex shadow-sm">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold">Valid until {new Date(activePolicy.end_date).toLocaleDateString()}</span>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-3xl lg:text-4xl font-black mb-3 text-white tracking-tight drop-shadow-lg">Uninsured Exposure</h3>
              <button 
                onClick={() => setActiveTab('policy')}
                className="mt-2 text-sm bg-cyan-600 text-white px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgb(6,182,212,0.4)] hover:bg-cyan-500 transition transform hover:-translate-y-0.5"
              >
                Calculate Quote & Get Coverage
              </button>
              
              <div className="mt-6 flex flex-wrap gap-2">
                 <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 shadow-[0_4px_10px_rgb(0,0,0,0.2)] px-3 py-2 rounded-lg text-xs font-semibold text-slate-300">
                    <CloudRain className="w-3.5 h-3.5 text-cyan-400" /> <span>Rain &gt;15mm: <strong className="text-white ml-0.5">₹500</strong></span>
                 </div>
                 <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 shadow-[0_4px_10px_rgb(0,0,0,0.2)] px-3 py-2 rounded-lg text-xs font-semibold text-slate-300">
                    <ServerCrash className="w-3.5 h-3.5 text-rose-400" /> <span>App Down: <strong className="text-white ml-0.5">₹800</strong></span>
                 </div>
                 <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 shadow-[0_4px_10px_rgb(0,0,0,0.2)] px-3 py-2 rounded-lg text-xs font-semibold text-slate-300">
                    <Car className="w-3.5 h-3.5 text-amber-400" /> <span>Gridlock: <strong className="text-white ml-0.5">₹400</strong></span>
                 </div>
              </div>
            </>
          )}
        </div>
        
        <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 min-w-[220px] relative z-10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
             <ShieldCheck className="w-4 h-4 text-cyan-400" />
             <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest drop-shadow-md">Active Coverage Limit</p>
          </div>
          <p className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">₹{activeCoverageLimit.toFixed(0)}</p>
          <p className="text-xs text-slate-400 mt-2 font-medium leading-tight">Total guaranteed disbursement available for systemic disruption.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white drop-shadow-md">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => setActiveTab('policy')} className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-cyan-500/50 hover:shadow-[0_8px_30px_rgb(6,182,212,0.2)] transition text-left group hover:-translate-y-1">
              <div className="bg-cyan-500/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
              <h4 className="font-bold text-white">Evaluate AI Risk</h4>
              <p className="text-xs text-slate-400 mt-1">Review your AI-generated weekly actuarial forecast quote.</p>
            </button>
            <button className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-slate-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.6)] transition text-left group hover:-translate-y-1">
              <div className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-white/5">
                <AlertCircle className="w-5 h-5 text-slate-300" />
              </div>
              <h4 className="font-bold text-white">File Support Ticket</h4>
              <p className="text-xs text-slate-400 mt-1">Contact dispatch algorithms mapping support via internal channels.</p>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white drop-shadow-md">Recent Feed</h3>
            <button onClick={() => setActiveTab('wallet')} className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 uppercase tracking-wider transition shadow-sm">View All</button>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_40px_rgb(0,0,0,0.5)] overflow-hidden h-[180px]">
            {claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-black/20">
                <p className="text-sm font-semibold text-slate-400 mb-1">No automatic payouts yet.</p>
                <p className="text-xs text-slate-500">Zero-touch parametric triggers will appear securely here.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10 overflow-y-auto h-full">
                {claims.slice().reverse().map((claim, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition">
                    <div className="flex items-center gap-3">
                      <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-400/30 font-bold text-cyan-400">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white drop-shadow-md">{claim.trigger_type.replace('_', ' ')}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">Automated Payout</p>
                      </div>
                    </div>
                    <span className="font-black text-emerald-400 text-sm flex items-center drop-shadow-md">+₹{claim.amount?.toFixed(0) || claim.payout_amount?.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
