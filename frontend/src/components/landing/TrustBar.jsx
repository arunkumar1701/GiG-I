import React from 'react';
import { Zap, Clock, Activity, ShieldCheck } from 'lucide-react';

export default function TrustBar() {
  const items = [
    { icon: Zap, title: 'Zero Paperwork', desc: '100% Automated Payouts' },
    { icon: Clock, title: 'Fast Settlement', desc: 'Ledger updated after approval' },
    { icon: Activity, title: 'AI-Driven Pricing', desc: 'Pay only for zone risk' },
    { icon: ShieldCheck, title: 'Fraud Scored', desc: '5-signal decision engine' },
  ];

  return (
    <div className="bg-white border-b border-slate-200 py-8 lg:py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex flex-col items-center text-center gap-3 p-2">
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 mb-1">
                  <Icon className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 sm:text-lg">{item.title}</p>
                  <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
