import React from 'react';
import { ArrowRight, CheckCircle2, MoonStar, Shield, SunMedium, Wallet } from 'lucide-react';

export default function LandingPage({ onLoginClick, theme = 'light', onToggleTheme }) {
  return (
    <div className={`theme-${theme} relative min-h-screen overflow-hidden px-6 py-10 ${
      theme === 'dark'
        ? 'bg-[radial-gradient(circle_at_top,#341108_0%,#160804_45%,#040404_100%)] text-[#fff5e6]'
        : 'bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6f1e7_58%,#efe5d5_100%)] text-slate-900'
    }`}>
      <div className={`pointer-events-none absolute inset-0 ${theme === 'dark' ? 'opacity-90 [background:radial-gradient(circle_at_top,_rgba(255,158,43,0.18),_transparent_38%),linear-gradient(135deg,rgba(255,81,0,0.12),transparent_40%,rgba(255,214,102,0.08)_100%)]' : 'opacity-30 [background:radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_45%)]'}`} />
      <button
        onClick={onToggleTheme}
        className={`absolute right-6 top-6 z-10 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition ${
          theme === 'dark'
            ? 'border-[#ffb347]/40 bg-black/30 text-[#ffd27a] hover:bg-[#2b130d]'
            : 'border-[#e2d8ca] bg-white/75 text-[#26457d] hover:bg-white'
        }`}
      >
        {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center gap-10 lg:flex-row lg:justify-between">
        <div className="max-w-xl text-center lg:text-left">
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.25em] shadow-sm backdrop-blur ${
            theme === 'dark'
              ? 'border border-[#6b2a15] bg-black/25 text-[#ffd27a]'
              : 'border border-[#e9e0d3] bg-white/70 text-[#26457d]'
          }`}>
            <span className={`h-2 w-2 rounded-full ${theme === 'dark' ? 'bg-[#ff6a00]' : 'bg-[#e7b84b]'}`} />
            Gig income protection
          </div>

          <h1 className={`mt-6 text-6xl font-bold leading-none md:text-7xl ${theme === 'dark' ? 'text-[#fff2db]' : 'text-slate-900'}`}>
            Gig-I
          </h1>
          <p className={`mt-4 text-lg font-medium leading-8 md:text-xl ${theme === 'dark' ? 'text-[#f4cab3]' : 'text-slate-600'}`}>
            A delivery-partner-first protection app that prices risk, verifies disruption events, and updates wallet payouts in minutes.
          </p>

          <div className={`mt-8 grid gap-3 text-left text-sm sm:grid-cols-3 ${theme === 'dark' ? 'text-[#f7d9b8]' : 'text-slate-600'}`}>
            <div className={`rounded-2xl p-4 shadow-sm backdrop-blur ${theme === 'dark' ? 'border border-[#4f1f11] bg-black/25' : 'border border-[#eadfcd] bg-white/65'}`}>
              <Shield className={`mb-3 h-5 w-5 ${theme === 'dark' ? 'text-[#ffb347]' : 'text-[#26457d]'}`} />
              Weather, heat, and city shutdown cover
            </div>
            <div className={`rounded-2xl p-4 shadow-sm backdrop-blur ${theme === 'dark' ? 'border border-[#4f1f11] bg-black/25' : 'border border-[#eadfcd] bg-white/65'}`}>
              <Wallet className={`mb-3 h-5 w-5 ${theme === 'dark' ? 'text-[#ffb347]' : 'text-[#26457d]'}`} />
              Instant ledger and payout visibility
            </div>
            <div className={`rounded-2xl p-4 shadow-sm backdrop-blur ${theme === 'dark' ? 'border border-[#4f1f11] bg-black/25' : 'border border-[#eadfcd] bg-white/65'}`}>
              <CheckCircle2 className={`mb-3 h-5 w-5 ${theme === 'dark' ? 'text-[#ffb347]' : 'text-[#26457d]'}`} />
              Phone-first flow for workers on the move
            </div>
          </div>
        </div>

        <div className={`w-full max-w-[360px] rounded-[38px] p-5 shadow-[0_30px_80px_rgba(73,58,32,0.16)] backdrop-blur ${
          theme === 'dark'
            ? 'border border-[#5a2312] bg-[rgba(14,7,5,0.92)]'
            : 'border border-white/70 bg-[#fbf7ef]/95'
        }`}>
          <div className={`mx-auto mb-5 h-1.5 w-20 rounded-full ${theme === 'dark' ? 'bg-[#5a2312]' : 'bg-[#e5dccb]'}`} />
          <div className={`rounded-[30px] p-6 shadow-[0_18px_40px_rgba(128,108,73,0.12)] ${theme === 'dark' ? 'bg-[linear-gradient(180deg,rgba(38,13,8,0.96),rgba(15,8,6,0.92))] border border-[#3a180f]' : 'bg-white/70'}`}>
            <div className={`mx-auto mb-5 inline-flex rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] ${
              theme === 'dark'
                ? 'border border-[#5d2412] bg-[#1c0d09] text-[#ffd27a]'
                : 'border border-[#efe6da] bg-white/85 text-[#26457d]'
            }`}>
              Premium protection
            </div>
            <h2 className={`text-center text-5xl font-bold ${theme === 'dark' ? 'text-[#fff0d4]' : 'text-slate-900'}`}>Gig-I</h2>
            <p className={`mt-2 text-center text-sm font-medium ${theme === 'dark' ? 'text-[#e9bca0]' : 'text-slate-500'}`}>
              Parametric income protection for India&#39;s gig workforce
            </p>

            <div className="my-8 flex justify-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-[28px] shadow-inner ${
                theme === 'dark'
                  ? 'border border-[#5d2412] bg-[linear-gradient(180deg,#23110d,#120907)]'
                  : 'border border-[#efe4d4] bg-[#fffaf1]'
              }`}>
                <Shield className={`h-9 w-9 ${theme === 'dark' ? 'text-[#ffb347]' : 'text-[#26457d]'}`} />
              </div>
            </div>

            <div className={`space-y-3 rounded-[26px] p-4 shadow-inner ${
              theme === 'dark'
                ? 'border border-[#3d1a11] bg-[rgba(12,7,6,0.85)]'
                : 'border border-[#efe6da] bg-[#fffaf4]'
            }`}>
              <button
                onClick={() => onLoginClick('worker')}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-extrabold text-white transition ${
                  theme === 'dark'
                    ? 'bg-[linear-gradient(135deg,#d93600,#ff7a00_55%,#f2b63d)] hover:brightness-110'
                    : 'bg-[#26457d] hover:bg-[#1e3764]'
                }`}
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onLoginClick('worker')}
                className={`w-full rounded-2xl border px-4 py-4 text-sm font-bold transition ${
                  theme === 'dark'
                    ? 'border-[#6a2b15] bg-[#160b08] text-[#f8d9a4] hover:bg-[#21100b]'
                    : 'border-[#cfbfaa] bg-white text-slate-700 hover:bg-[#faf4ea]'
                }`}
              >
                I already have a policy
              </button>
              <button
                onClick={() => onLoginClick('admin')}
                className={`w-full text-center text-xs font-bold underline underline-offset-4 ${theme === 'dark' ? 'text-[#ffb347]' : 'text-slate-500'}`}
              >
                Admin Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
