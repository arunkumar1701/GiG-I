import React from 'react';
import { Bell, ShieldCheck, Home, FileText, CreditCard, User as UserIcon, Lock, Box, ShieldAlert } from 'lucide-react';

export default function AppLayout({ children, activeTab, setActiveTab, isCovered, user }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col md:flex-row relative overflow-hidden">
      {/* High-Contrast Glassmorphism Ambient Orbs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-600/30 blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full bg-fuchsia-600/30 blur-[130px] pointer-events-none z-0"></div>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900/60 backdrop-blur-2xl border-b border-white/10 z-50 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 border border-white/20 p-1.5 rounded-lg"><ShieldCheck className="w-5 h-5 text-cyan-400" /></div>
          <span className="font-black text-white text-lg tracking-tight drop-shadow-md">Gig-I</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-500 hover:text-blue-600 transition">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
          </button>
        </div>
      </header>

      {/* Primary Sidebar & Bottom Nav Container */}
      <nav className="fixed bottom-0 w-full bg-slate-900/50 backdrop-blur-3xl border-t border-white/10 md:relative md:w-72 md:border-t-0 md:border-r md:border-white/10 md:min-h-screen z-[60] flex flex-col shadow-[8px_0_40px_rgb(0,0,0,0.5)]">
        
        <div className="hidden md:flex items-center p-6 border-b border-white/10">
          <div className="bg-white/10 p-2 border border-white/20 rounded-xl shadow-[0_4px_20px_rgb(0,255,255,0.1)] mr-3">
            <ShieldCheck className="w-6 h-6 text-cyan-400 drop-shadow-md" />
          </div>
          <span className="font-black text-white text-2xl tracking-tight drop-shadow-lg">Gig-I</span>
        </div>

        {user && (
          <div className="hidden md:block p-6 pb-4 border-b border-slate-100/60 mb-2">
            <div className="flex items-center gap-4 mb-5">
              <img src={`https://ui-avatars.com/api/?name=${user.full_name}&background=eff6ff&color=1d4ed8`} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
              <div>
                <p className="text-base font-bold text-slate-900 leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex flex-wrap items-center gap-1 mt-1">
                  <span className="bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 shadow-sm">🛵 EV Scooter</span>
                  <span className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100 shadow-sm">🟧 Zomato Fleet</span>
                </p>
              </div>
            </div>
            
            {isCovered ? (
              <div className="px-3 py-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl flex items-center justify-center gap-2 w-full shadow-[0_2px_20px_rgb(52,211,153,0.15)]">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgb(52,211,153,0.8)]"></span>
                <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest drop-shadow-md">Active Protection</span>
              </div>
            ) : (
               <div className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 w-full shadow-sm">
                <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest drop-shadow-md">Uninsured</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-around md:flex-col md:p-4 md:gap-2 flex-grow overflow-y-auto">
          {[
            { id: 'dashboard', icon: Home, label: 'Dashboard' },
            { id: 'policy', icon: FileText, label: 'Risk & Policy' },
            { id: 'wallet', icon: CreditCard, label: 'Wallet Ledger' },
            { id: 'admin', icon: ShieldAlert, label: 'Admin Logs' },
            { id: 'profile', icon: UserIcon, label: 'Identity' }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 py-3 md:py-3.5 md:px-4 rounded-none md:rounded-xl flex-1 md:flex-none transition-all duration-300 ${
                  isActive 
                    ? 'text-cyan-300 md:bg-cyan-500/10 font-bold border-t-2 md:border-t-0 md:border md:border-cyan-400/30 shadow-[0_0_20px_rgb(6,182,212,0.15)] bg-slate-800/50' 
                    : 'text-slate-400 hover:text-cyan-200 md:hover:bg-white/10 border-t-2 md:border-t-0 border-transparent font-semibold'
                }`}
              >
                <Icon className={`w-5 h-5 md:w-5 md:h-5 ${isActive ? 'md:text-cyan-300 text-cyan-400 drop-shadow-md' : 'text-slate-500'}`} />
                <span className={`text-[10px] md:text-sm drop-shadow-md`}>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Enterprise Trust Signals */}
        <div className="hidden md:flex flex-col p-6 mt-auto border-t border-white/10 bg-black/20 gap-4">
            <div className="flex items-center gap-3 text-slate-400">
               <Lock className="w-4 h-4 text-emerald-400" />
               <span className="text-[10px] font-bold uppercase tracking-widest drop-shadow-md">256-bit Encrypted SSL</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
               <Box className="w-4 h-4 text-cyan-400" />
               <span className="text-[10px] font-bold uppercase tracking-widest leading-tight drop-shadow-md">Powered by Guidewire<br/><span className="text-slate-300">Core Systems</span></span>
            </div>
        </div>
      </nav>

      <main className="flex-1 w-full pb-24 md:pb-0 overflow-y-auto h-screen relative z-10">
        <div className="max-w-5xl mx-auto p-4 md:p-8 md:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
