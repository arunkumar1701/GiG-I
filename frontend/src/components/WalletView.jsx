import React, { useState } from 'react';
import { CreditCard, Inbox, Activity, Loader2 } from 'lucide-react';

export default function WalletView({ walletBalance, claims, onWithdraw }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWithdrawal = async () => {
     if (walletBalance <= 0) return;
     setIsProcessing(true);
     await new Promise(resolve => setTimeout(resolve, 1500));
     await onWithdraw();
     setIsProcessing(false);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md">Ledger & Wallet</h2>
      
      <div className="max-w-3xl">
        <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-[0_8px_40px_rgb(0,0,0,0.5)] border border-white/10 flex flex-col justify-between relative overflow-hidden mb-8">
            <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-br from-cyan-600/30 to-fuchsia-600/10 rounded-full blur-[80px] transform translate-x-1/3 -translate-y-1/3"></div>
            
            <p className="text-cyan-400 font-black tracking-widest text-xs uppercase mb-2 drop-shadow-sm">Total Available Balance</p>
            <h3 className="text-5xl font-black tracking-tighter flex items-end gap-2 text-white drop-shadow-lg">
                ₹{walletBalance.toFixed(2)}
            </h3>
            
            <div className="mt-10 flex gap-4">
                <button 
                  onClick={handleWithdrawal}
                  disabled={isProcessing || walletBalance <= 0}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 shadow-[0_0_20px_rgb(6,182,212,0.4)] text-white font-black w-48 py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                    {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin"/> Processing...</> : 'Withdraw to Bank'}
                </button>
                <div className="bg-black/30 text-slate-300 font-bold px-6 py-3 rounded-xl border border-white/10 hidden sm:block shadow-inner drop-shadow-sm">
                    Routing: **** 5204
                </div>
            </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_4px_30px_rgb(0,0,0,0.5)] overflow-hidden">
            <div className="px-6 md:px-8 py-5 border-b border-white/5 bg-black/20 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg drop-shadow-md">Automated Claims Ledger</h3>
                <span className="bg-emerald-500/10 text-emerald-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20 shadow-[0_0_15px_rgb(52,211,153,0.2)]">
                    Immutable
                </span>
            </div>
            
            {claims.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                    <Inbox className="w-12 h-12 text-slate-700 mb-4 drop-shadow-md" />
                    <p className="text-sm font-semibold text-slate-400">No settlements dispatched yet.</p>
                    <p className="text-xs text-slate-600 mt-1">Parametric triggers will appear here instantly.</p>
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {claims.slice().reverse().map((claim, idx) => (
                        <div key={idx} className="p-6 md:px-8 hover:bg-white/5 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-cyan-500/20 p-3 rounded-xl border border-cyan-400/30 text-cyan-400 mt-1 md:mt-0 shadow-sm">
                                    <Activity className="w-5 h-5 drop-shadow-md" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1 drop-shadow-sm">
                                        Trigger: <span className="text-slate-300">{claim.trigger_type.replace('_', ' ')}</span>
                                    </p>
                                    <p className="font-bold text-white mb-1 drop-shadow-md">{new Date(claim.timestamp).toLocaleString()}</p>
                                    <p className="text-xs font-black text-emerald-400 flex items-center gap-1.5 drop-shadow-sm">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgb(52,211,153,0.8)]"></span> 
                                        Status: Success
                                    </p>
                                </div>
                            </div>
                            <div className="text-2xl font-black text-emerald-400 md:text-right pl-16 md:pl-0 drop-shadow-lg">
                                +₹{(claim.amount || claim.payout_amount).toFixed(2)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
