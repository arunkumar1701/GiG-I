import React, { useMemo, useState } from 'react';
import { Copy, Loader2, Send, Wallet } from 'lucide-react';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function buildWalletAddress(user, currentUserId) {
  const phoneSuffix = String(user?.phone || '').slice(-4) || '0000';
  const zone = (user?.zone || 'zone-a').replace(/\s+/g, '-').toLowerCase();
  return `gig-i://${zone}/worker-${currentUserId || 'demo'}-${phoneSuffix}`;
}

export default function WalletView({ user, currentUserId, walletBalance, claims, onWithdraw }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const walletAddress = useMemo(() => buildWalletAddress(user, currentUserId), [currentUserId, user]);

  const handleWithdrawal = async () => {
    if (isProcessing || walletBalance <= 0) return;
    setIsProcessing(true);
    try {
      await onWithdraw();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopyMessage('Copied');
    } catch (error) {
      console.error('Wallet copy failed:', error);
      setCopyMessage('Copy unavailable');
    }
    window.setTimeout(() => setCopyMessage(''), 1800);
  };

  const handleShare = async () => {
    const text = `Gig-I wallet: ${walletAddress}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Gig-I Wallet', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopyMessage('Share text copied');
        window.setTimeout(() => setCopyMessage(''), 1800);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Wallet share failed:', error);
        setCopyMessage('Share unavailable');
        window.setTimeout(() => setCopyMessage(''), 1800);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Payout wallet</p>
        <h2 className="mt-2 text-4xl font-bold text-slate-900">Wallet & ledger</h2>
      </div>

      <div className="rounded-[30px] border border-[#eadfcd] bg-[#fff6ec] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Available balance</p>
            <h3 className="mt-2 text-5xl font-bold text-slate-900">{formatCurrency(walletBalance)}</h3>
          </div>
          <div className="rounded-[24px] border border-[#ece1d2] bg-white p-4 shadow-sm">
            <Wallet className="h-7 w-7 text-[#26457d]" />
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#eadfcd] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Wallet ID</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-800">{walletAddress}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={handleCopy} aria-label="Copy wallet address" className="rounded-2xl border border-[#d6c8b6] bg-[#fff8ef] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700">
              <Copy className="mr-2 inline h-4 w-4" />
              Copy
            </button>
            <button onClick={handleShare} aria-label="Share wallet address" className="rounded-2xl border border-[#d6c8b6] bg-[#fff8ef] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700">
              <Send className="mr-2 inline h-4 w-4" />
              Share
            </button>
          </div>
          {copyMessage ? <p className="mt-2 text-xs font-bold text-[#26457d]">{copyMessage}</p> : null}
        </div>

        <button
          onClick={handleWithdrawal}
          disabled={isProcessing || walletBalance <= 0}
          className="mt-4 w-full rounded-[24px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {isProcessing ? <><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Processing...</> : 'Withdraw to bank'}
        </button>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-3xl font-bold text-slate-900">Ledger</h3>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{claims.length} entries</p>
        </div>
        <div className="space-y-2">
          {claims.length === 0 ? (
            <div className="rounded-[22px] bg-[#fff8ef] p-4 text-sm text-slate-500">No payout entries yet.</div>
          ) : (
            claims.slice().reverse().map((claim) => (
              <div key={claim.id} className="rounded-[22px] bg-[#fff8ef] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{claim.trigger_type}</p>
                    <p className="text-xs text-slate-500">{new Date(claim.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#2f8f5b]">{formatCurrency(claim.payout_amount || claim.amount || 0)}</p>
                    <p className="text-xs text-slate-500">{claim.status}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
