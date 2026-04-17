import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  CloudRain,
  CreditCard,
  MapPin,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import TelematicsTracker from './TelematicsTracker';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function Dashboard({
  user,
  activePolicy,
  claims,
  setActiveTab,
  apiBase,
  authToken,
  currentUserId,
}) {
  const [weatherByZone, setWeatherByZone] = useState(null);
  const [shiftStatus, setShiftStatus] = useState(user?.shift_status || 'Offline');

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await axios.get(
          `${apiBase}/weather/live`,
          authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
        );
        setWeatherByZone(res.data);
      } catch (error) {
        console.error('Weather fetch failed:', error.message);
      }
    };

    fetchWeather();
    const interval = window.setInterval(fetchWeather, 60000);
    return () => window.clearInterval(interval);
  }, [apiBase, authToken]);

  if (!user) return null;

  const zoneWeather = weatherByZone?.[user.zone];
  const approvedClaims = claims.filter((claim) => claim.status === 'Approved');

  const handleShiftChange = async (nextStatus) => {
    setShiftStatus(nextStatus);
    if (!currentUserId) return;
    try {
      await axios.put(
        `${apiBase}/user/${currentUserId}/profile`,
        { shift_status: nextStatus },
        authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
      );
    } catch (error) {
      console.error('Shift status update failed:', error);
    }
  };

  // Calculate FRS and dynamic premium based on claims history
  const rejectedClaims = claims.filter((claim) => claim.status === 'Rejected').length;
  const legitClaims = approvedClaims.length;
  // 100 base score, drop 20 for fraud, add 5 for legit behavior
  const frsScore = Math.max(0, Math.min(100, 100 - (rejectedClaims * 20) + (legitClaims * 5)));
  const basePremium = 50; 
  // Base x RiskMultiplier (where RiskMultiplier = 100/FRS)
  const dynamicPremium = frsScore > 0 ? basePremium * (100 / frsScore) : basePremium * 3;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Today&apos;s view</p>
        <h2 className="mt-2 text-4xl font-bold text-slate-900">Good afternoon, {user.full_name?.split(' ')[0]}</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Go online, follow zone conditions, and track payouts without insurance jargon.
        </p>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-[#fff6ec] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Active Weekly Protection</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-900">
              {activePolicy ? 'Covered' : 'Not active'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {activePolicy
                ? `Valid until ${new Date(activePolicy.end_date).toLocaleDateString()}`
                : 'Buy a weekly policy to unlock automated disruption payouts.'}
            </p>
          </div>
          <div className="rounded-[24px] border border-[#ece1d2] bg-white p-4 shadow-sm">
            <ShieldCheck className="h-7 w-7 text-[#26457d]" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Shift status</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{shiftStatus}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Trust Score (FRS)</p>
            <p className={`mt-2 text-2xl font-bold ${frsScore < 80 ? 'text-red-600' : 'text-emerald-600'}`}>{frsScore}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Weekly Premium</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(dynamicPremium)}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Paid claims</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{approvedClaims.length}</p>
          </div>
        </div>
      </div>

      <TelematicsTracker
        user={{ ...user, shift_status: shiftStatus }}
        activePolicy={activePolicy}
        onShiftChange={(next) => setShiftStatus(next)}
        token={authToken}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[24px] border border-[#eadfcd] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <CloudRain className="h-4 w-4 text-[#26457d]" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em]">Zone radar</p>
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900">{zoneWeather?.description || 'Loading weather'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {zoneWeather ? `${zoneWeather.temp_c}C • ${zoneWeather.rain_mm_per_hr} mm/hr rain` : 'Checking live conditions'}
          </p>
        </div>

        <div className="rounded-[24px] border border-[#eadfcd] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <MapPin className="h-4 w-4 text-[#26457d]" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em]">Operating zone</p>
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900">{user.zone}</p>
          <p className="mt-1 text-sm text-slate-500">{user.city}</p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-3xl font-bold text-slate-900">Quick actions</h3>
        </div>
        <div className="grid gap-3">
          <button
            onClick={() => setActiveTab('policy')}
            className="flex items-center justify-between rounded-[24px] border border-[#eadfcd] bg-white p-4 text-left shadow-sm transition hover:bg-[#faf4ea]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#eef2f8] p-3">
                <Activity className="h-5 w-5 text-[#26457d]" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Review your policy</p>
                <p className="text-sm text-slate-500">Coverage, premium, and claim status</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('simulate')}
            className="flex items-center justify-between rounded-[24px] border border-[#eadfcd] bg-white p-4 text-left shadow-sm transition hover:bg-[#faf4ea]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#eef2f8] p-3">
                <CreditCard className="h-5 w-5 text-[#26457d]" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Run a simulation</p>
                <p className="text-sm text-slate-500">Demo the trigger to payout flow</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-3xl font-bold text-slate-900">Recent activity</h3>
          <button
            onClick={() => setActiveTab('wallet')}
            className="text-xs font-bold uppercase tracking-[0.2em] text-[#26457d]"
          >
            See wallet
          </button>
        </div>

        <div className="rounded-[26px] border border-[#eadfcd] bg-white p-2 shadow-sm">
          {claims.length === 0 ? (
            <div className="rounded-[22px] bg-[#fff8ef] p-5 text-sm text-slate-500">
              No claim events yet. Run a replay to show wallet updates and payout tracking.
            </div>
          ) : (
            <div className="space-y-2">
              {claims.slice().reverse().slice(0, 3).map((claim) => (
                <div key={claim.id} className="flex items-center justify-between rounded-[22px] bg-[#fff8ef] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white p-2 shadow-sm">
                      <Wallet className="h-4 w-4 text-[#26457d]" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{claim.trigger_type}</p>
                      <p className="text-xs text-slate-500">{claim.status}</p>
                    </div>
                  </div>
                  <p className="font-bold text-[#2f8f5b]">{formatCurrency(claim.payout_amount || claim.amount || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
