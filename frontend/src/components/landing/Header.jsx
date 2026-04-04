import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function Header({ onLoginClick }) {
  return (
    <header className="fixed top-0 w-full bg-white/90 backdrop-blur-md border-b border-slate-200 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-900 p-2 rounded-xl">
            <ShieldCheck className="text-emerald-400 w-6 h-6" />
          </div>
          <span className="font-black text-slate-900 text-xl tracking-tight">DEVTrails Protect</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#coverage" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition">Coverage Details</a>
          <a href="#claims" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition">Claims</a>
          <button onClick={onLoginClick} className="border-2 border-slate-200 text-slate-800 hover:border-slate-800 hover:bg-slate-50 px-6 py-2.5 rounded-xl text-sm font-bold transition">
            Login
          </button>
        </nav>
      </div>
    </header>
  );
}
