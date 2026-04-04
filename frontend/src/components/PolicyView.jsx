import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ShieldAlert, Activity, CheckCircle2, IndianRupee } from 'lucide-react';

export default function PolicyView({ user, activePolicy, quote, onGetQuote, onBuyCoverage }) {
  const totalForecast = quote ? quote.lost_hours || 10 : (activePolicy ? 12 : 0);
  const chartData = [
    { day: 'Mon', hours: totalForecast * 0.1 }, { day: 'Tue', hours: totalForecast * 0.3 },
    { day: 'Wed', hours: totalForecast * 0.05 }, { day: 'Thu', hours: totalForecast * 0.15 },
    { day: 'Fri', hours: totalForecast * 0.25 }, { day: 'Sat', hours: totalForecast * 0.1 },
    { day: 'Sun', hours: totalForecast * 0.05 },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md">Policy & Actuarial Risk</h2>
      
      {activePolicy ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_40px_rgb(0,0,0,0.5)] p-6 md:p-8 relative">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_10px_rgb(52,211,153,0.5)]" />
              <h3 className="text-xl font-bold text-white drop-shadow-md">Current Policy Breakdown</h3>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-4 bg-black/40 border border-white/10 rounded-2xl shadow-inner">
                <div>
                  <p className="text-sm font-bold text-slate-200">Weekly Income Mapping</p>
                  <p className="text-xs text-slate-400 mt-1">Stated weekly income equivalent</p>
                </div>
                <p className="font-bold text-white drop-shadow-md">₹{user.weekly_income}</p>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-black/40 border border-white/10 rounded-2xl shadow-inner">
                <div>
                  <p className="text-sm font-bold text-slate-200">Base Zone</p>
                  <p className="text-xs text-slate-400 mt-1">Primary operational risk area</p>
                </div>
                <p className="font-bold text-cyan-300 drop-shadow-md">{user.zone}</p>
              </div>

              <div className="flex justify-between items-center p-5 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.4)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-600/20 rounded-full blur-[40px] transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10">
                  <p className="text-xs font-black text-cyan-400 uppercase tracking-widest drop-shadow-md">Total Weekly Cost</p>
                </div>
                <p className="text-2xl font-black text-cyan-300 relative z-10 drop-shadow-lg">₹{activePolicy.premium_amount.toFixed(2)}</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 font-bold text-center bg-black/40 py-3 rounded-xl border border-white/10 uppercase tracking-widest shadow-inner">
              Policy expires: <span className="text-slate-300">{new Date(activePolicy.end_date).toLocaleString()}</span>
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_40px_rgb(0,0,0,0.5)] p-6 md:p-8 flex flex-col relative overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-2 drop-shadow-md">Risk Forecast Model</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-sm font-medium">
              Actuarial time-series predicting disrupted hours this week in <span className="font-bold text-cyan-400 drop-shadow-sm">{user.zone}</span>.
            </p>
            <div className="flex-1 min-h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -3px rgb(0 0 0 / 0.1)', fontWeight: 600}} 
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.hours > (totalForecast * 0.2) ? '#3b82f6' : '#93c5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-center text-cyan-300 mt-4 uppercase font-black tracking-widest bg-cyan-700/20 py-2 rounded-lg border border-cyan-500/20 shadow-inner">
               Total Predicted Impact: {totalForecast.toFixed(1)} hrs
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_10px_40px_rgb(0,0,0,0.5)] overflow-hidden">
          <div className="p-8 border-b border-white/10 bg-gradient-to-r from-cyan-900/30 to-black/20">
            <div className="w-14 h-14 bg-black/60 border border-cyan-500/30 shadow-[0_0_20px_rgb(6,182,212,0.4)] text-cyan-400 rounded-2xl flex items-center justify-center mb-6">
              <ShieldAlert className="w-7 h-7 drop-shadow-md" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2 drop-shadow-lg">Get Protected</h3>
            <p className="text-slate-400 font-medium">Secure your weekly income against zone-specific outages and gridlocks.</p>
          </div>
          
          <div className="p-8 bg-black/20 space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 shadow-sm">Your Zone</p>
                  <div className="w-full bg-black/40 border border-white/10 p-3 rounded-xl font-bold text-slate-300 shadow-inner">{user.zone}</div>
               </div>
               <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 shadow-sm">Platform</p>
                  <div className="w-full bg-black/40 border border-white/10 p-3 rounded-xl font-bold text-slate-300 shadow-inner">{user.platform}</div>
               </div>
               <div className="col-span-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 shadow-sm">Average Weekly Earnings (₹)</p>
                  <div className="w-full bg-black/40 border border-white/10 p-3 rounded-xl font-bold text-slate-300 shadow-inner">₹{user.weekly_income}</div>
               </div>
            </div>

            {!quote ? (
                <button onClick={onGetQuote} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-[0_0_25px_rgb(6,182,212,0.4)] active:scale-[0.98] mt-4">
                  <Activity className="w-5 h-5 text-white drop-shadow-md" />
                  Calculate Dynamic Weekly Premium
                </button>
            ) : (
                <div className="bg-slate-900/80 rounded-2xl border border-cyan-500/50 shadow-[0_0_30px_rgb(6,182,212,0.2)] p-6 animate-in zoom-in-95 mt-4">
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                      <div className="flex-1">
                          <p className="text-[10px] font-black uppercase text-cyan-400 tracking-widest mb-1 drop-shadow-md">AI Mathematical Quote</p>
                          <h4 className="text-3xl font-black text-white mb-2 drop-shadow-lg">₹{quote.mock_premium.toFixed(2)}<span className="text-base text-slate-500 font-bold drop-shadow-none">/wk</span></h4>
                          <p className="text-xs text-slate-400 font-medium">The pricing engine dynamically calculated your premium based on hyper-local machine learning modeling for <strong className="text-cyan-400">{user.zone}</strong>.</p>
                          {quote.ml_factors && (
                             <div className="mt-4 space-y-1 bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                                {quote.ml_factors.map((f, i) => (
                                    <p key={i} className={`text-[10px] font-bold ${f.includes('-₹') ? 'text-emerald-400 drop-shadow-sm' : 'text-slate-400'}`}>• {f}</p>
                                ))}
                             </div>
                          )}
                      </div>
                      <div className="w-full lg:w-48 h-24">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                  <Bar dataKey="hours" radius={[3, 3, 0, 0]} fill="#22d3ee" />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  <button onClick={onBuyCoverage} className="w-full bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgb(52,211,153,0.4)] text-slate-950 font-black py-4 rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2 mt-6">
                      <IndianRupee className="w-5 h-5 drop-shadow-md" /> Authorize & Purchase Policy
                  </button>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
