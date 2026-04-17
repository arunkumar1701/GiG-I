import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
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
  walletBalance,
  liveQuote,
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

  const zoneWeather = weatherByZone?.[user?.zone];
  const approvedClaims = useMemo(
    () => claims.filter((claim) => claim.status === 'Approved'),
    [claims],
  );
  const openClaims = useMemo(
    () => claims.filter((claim) => ['Pending', 'Hold'].includes(claim.status)),
    [claims],
  );
  const latestClaim = claims.length > 0 ? claims.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] : null;
  const displayedPremium = liveQuote?.premium ?? activePolicy?.premium_amount ?? 0;

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Today&apos;s cover</p>
        <h2 className="mt-2 text-4xl font-bold text-slate-900">
          Good afternoon, {user.full_name?.split(' ')[0]}
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Track your shift, stay covered during active hours, and watch payouts land automatically.
        </p>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-[#fff6ec] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Weekly protection</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-900">
              {activePolicy ? 'Protection active' : 'Protection inactive'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {activePolicy
                ? `Covered until ${new Date(activePolicy.end_date).toLocaleDateString()}`
                : 'Buy a weekly cover before going online to unlock automatic disruption payouts.'}
            </p>
          </div>
          <div className="rounded-[24px] border border-[#ece1d2] bg-white p-4 shadow-sm">
            <ShieldCheck className="h-7 w-7 text-[#26457d]" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(135px,1fr))] gap-3">
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Shift</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{shiftStatus}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Weekly price</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(displayedPremium)}
            </p>
            {activePolicy ? (
              <p className="mt-1 text-xs text-slate-500">
                Current cover bought at {formatCurrency(activePolicy.premium_amount)}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Open claims</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{openClaims.length}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Wallet</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(walletBalance)}</p>
          </div>
        </div>
      </div>

      <TelematicsTracker
        user={{ ...user, shift_status: shiftStatus }}
        activePolicy={activePolicy}
        onShiftChange={handleShiftChange}
        token={authToken}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-[#eadfcd] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <CloudRain className="h-4 w-4 text-[#26457d]" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em]">Zone weather</p>
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900">
            {zoneWeather?.description || 'Loading weather'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {zoneWeather
              ? `${zoneWeather.temp_c}C | ${zoneWeather.rain_mm_per_hr} mm/hr rain`
              : 'Checking live conditions'}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#26457d]">
            {zoneWeather?.trigger || 'No active disruption in your zone'}
          </p>
        </div>

        <div className="rounded-[24px] border border-[#eadfcd] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <MapPin className="h-4 w-4 text-[#26457d]" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em]">Working zone</p>
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900">{user.zone}</p>
          <p className="mt-1 text-sm text-slate-500">{user.city}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {activePolicy ? `${user.platform} | ${user.vehicle_type || 'Bike'}` : 'Activate cover before shift start'}
          </p>
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
                <CreditCard className="h-5 w-5 text-[#26457d]" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Review policy</p>
                <p className="text-sm text-slate-500">Check weekly premium, triggers, and claim status</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className="flex items-center justify-between rounded-[24px] border border-[#eadfcd] bg-white p-4 text-left shadow-sm transition hover:bg-[#faf4ea]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#eef2f8] p-3">
                <Wallet className="h-5 w-5 text-[#26457d]" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Open wallet</p>
                <p className="text-sm text-slate-500">See payout history and withdraw available funds</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-3xl font-bold text-slate-900">Recent activity</h3>
          {approvedClaims.length > 0 ? (
            <button
              onClick={() => setActiveTab('wallet')}
              className="text-xs font-bold uppercase tracking-[0.2em] text-[#26457d]"
            >
              View payouts
            </button>
          ) : null}
        </div>

        <div className="rounded-[26px] border border-[#eadfcd] bg-white p-2 shadow-sm">
          {!latestClaim ? (
            <div className="rounded-[22px] bg-[#fff8ef] p-5 text-sm text-slate-500">
              No claim events yet. When a covered disruption hits your active shift, it will appear here automatically.
            </div>
          ) : (
            <div className="space-y-2">
              {claims.slice().reverse().slice(0, 3).map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between rounded-[22px] bg-[#fff8ef] px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-slate-900">{claim.trigger_type}</p>
                    <p className="text-xs text-slate-500">
                      {claim.status} | {new Date(claim.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="font-bold text-[#2f8f5b]">
                    {formatCurrency(claim.payout_amount || claim.amount || 0)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
