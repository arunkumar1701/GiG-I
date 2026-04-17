import React from 'react';
import { ArrowRight, CheckCircle2, Shield, Wallet } from 'lucide-react';

export default function LandingPage({ onLoginClick }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6f1e7_58%,#efe5d5_100%)] px-6 py-10 text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_45%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center gap-10 lg:flex-row lg:justify-between">
        <div className="max-w-xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e9e0d3] bg-white/70 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#26457d] shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#e7b84b]" />
            Gig income protection
          </div>

          <h1 className="mt-6 text-6xl font-bold leading-none text-slate-900 md:text-7xl">
            Gig-I
          </h1>
          <p className="mt-4 text-lg font-medium leading-8 text-slate-600 md:text-xl">
            A delivery-partner-first protection app that prices risk, verifies disruption events, and updates wallet payouts in minutes.
          </p>

          <div className="mt-8 grid gap-3 text-left text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#eadfcd] bg-white/65 p-4 shadow-sm backdrop-blur">
              <Shield className="mb-3 h-5 w-5 text-[#26457d]" />
              Weather, heat, and city shutdown cover
            </div>
            <div className="rounded-2xl border border-[#eadfcd] bg-white/65 p-4 shadow-sm backdrop-blur">
              <Wallet className="mb-3 h-5 w-5 text-[#26457d]" />
              Instant ledger and payout visibility
            </div>
            <div className="rounded-2xl border border-[#eadfcd] bg-white/65 p-4 shadow-sm backdrop-blur">
              <CheckCircle2 className="mb-3 h-5 w-5 text-[#26457d]" />
              Phone-first flow for workers on the move
            </div>
          </div>
        </div>

        <div className="w-full max-w-[360px] rounded-[38px] border border-white/70 bg-[#fbf7ef]/95 p-5 shadow-[0_30px_80px_rgba(73,58,32,0.16)] backdrop-blur">
          <div className="mx-auto mb-5 h-1.5 w-20 rounded-full bg-[#e5dccb]" />
          <div className="rounded-[30px] bg-white/70 p-6 shadow-[0_18px_40px_rgba(128,108,73,0.12)]">
            <div className="mx-auto mb-5 inline-flex rounded-full border border-[#efe6da] bg-white/85 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#26457d]">
              Premium protection
            </div>
            <h2 className="text-center text-5xl font-bold text-slate-900">Gig-I</h2>
            <p className="mt-2 text-center text-sm font-medium text-slate-500">
              Parametric income protection for India&#39;s gig workforce
            </p>

            <div className="my-8 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-[#efe4d4] bg-[#fffaf1] shadow-inner">
                <Shield className="h-9 w-9 text-[#26457d]" />
              </div>
            </div>

            <div className="space-y-3 rounded-[26px] border border-[#efe6da] bg-[#fffaf4] p-4 shadow-inner">
              <button
                onClick={() => onLoginClick('worker')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1e3764]"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onLoginClick('worker')}
                className="w-full rounded-2xl border border-[#cfbfaa] bg-white px-4 py-4 text-sm font-bold text-slate-700 transition hover:bg-[#faf4ea]"
              >
                I already have a policy
              </button>
              <button
                onClick={() => onLoginClick('admin')}
                className="w-full text-center text-xs font-bold text-slate-500 underline underline-offset-4"
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
