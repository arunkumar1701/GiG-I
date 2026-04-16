import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CloudRain, Loader2, ShieldCheck, ThermometerSun } from 'lucide-react';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function PolicyView({
  user,
  activePolicy,
  quote,
  onGetQuote,
  onBuyCoverage,
  apiBase,
  authToken,
  currentUserId,
}) {
  const [policies, setPolicies] = useState([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [policyDetail, setPolicyDetail] = useState(null);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

  useEffect(() => {
    if (!currentUserId || !apiBase) return;
    const fetchPolicies = async () => {
      setLoadingPolicies(true);
      try {
        const response = await axios.get(`${apiBase}/policies/${currentUserId}`, { headers });
        const nextPolicies = response.data?.policies || [];
        setPolicies(nextPolicies);
        setSelectedPolicyId(nextPolicies[0]?.id || activePolicy?.id || null);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingPolicies(false);
      }
    };
    fetchPolicies();
  }, [activePolicy?.id, apiBase, authToken, currentUserId]);

  useEffect(() => {
    if (!selectedPolicyId || !apiBase) return;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const response = await axios.get(`${apiBase}/policy/${selectedPolicyId}`, { headers });
        setPolicyDetail(response.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [apiBase, authToken, selectedPolicyId]);

  const signalRows = useMemo(() => {
    const signals = policyDetail?.latestFraudSignals || {};
    return [
      ['Event', Number(signals.event || 0)],
      ['Location', Number(signals.location || 0)],
      ['Device', Number(signals.device || 0)],
      ['Behavior', Number(signals.behavior || 0)],
      ['Network', Number(signals.network || 0)],
    ];
  }, [policyDetail]);

  if (!activePolicy && !loadingPolicies && policies.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Protection plan</p>
          <h2 className="mt-2 text-4xl font-bold text-slate-900">Choose your first weekly cover</h2>
        </div>

        <div className="rounded-[28px] border border-[#eadfcd] bg-[#fff6ec] p-5">
          <p className="text-sm text-slate-600">
            Coverage is priced against your city, route zone, and expected disruption risk.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Zone</p>
              <p className="mt-2 font-bold text-slate-900">{user.zone}</p>
            </div>
            <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Platform</p>
              <p className="mt-2 font-bold text-slate-900">{user.platform}</p>
            </div>
          </div>
        </div>

        {!quote ? (
          <button
            onClick={onGetQuote}
            className="w-full rounded-[24px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white"
          >
            Calculate weekly premium
          </button>
        ) : (
          <div className="space-y-4 rounded-[28px] border border-[#eadfcd] bg-white p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Premium plan</p>
              <h3 className="mt-2 text-4xl font-bold text-slate-900">{formatCurrency(quote.premium)}</h3>
              <p className="mt-2 text-sm text-slate-500">per week with rapid claim settlement to the in-app wallet</p>
            </div>
            <button
              onClick={onBuyCoverage}
              className="w-full rounded-[24px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white"
            >
              Confirm plan
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Policy details</p>
          <h2 className="mt-2 text-4xl font-bold text-slate-900">Your protection plan</h2>
        </div>
        {(loadingPolicies || loadingDetail) && <Loader2 className="h-5 w-5 animate-spin text-[#26457d]" />}
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {policies.map((policy) => (
            <button
              key={policy.id}
              onClick={() => setSelectedPolicyId(policy.id)}
              className={`flex w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left ${
                selectedPolicyId === policy.id
                  ? 'border-[#26457d] bg-[#eef2f8]'
                  : 'border-[#eadfcd] bg-[#fff8ef]'
              }`}
            >
              <div>
                <p className="font-bold text-slate-900">Policy #{policy.id}</p>
                <p className="text-xs text-slate-500">
                  {new Date(policy.start_date).toLocaleDateString()} to {new Date(policy.end_date).toLocaleDateString()}
                </p>
              </div>
              <p className="font-bold text-[#26457d]">{formatCurrency(policy.premium_amount)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-[#fff6ec] p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Coverage remaining</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(policyDetail?.coverageRemaining || 0)}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Open claims</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{policyDetail?.claims?.length || 0}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-[#26457d]" />
              <p className="font-bold text-slate-900">Rain trigger</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">{policyDetail?.triggerRules?.heavyRain || 'Configured in backend weather monitor'}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <div className="flex items-center gap-2">
              <ThermometerSun className="h-4 w-4 text-[#26457d]" />
              <p className="font-bold text-slate-900">Heat trigger</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">{policyDetail?.triggerRules?.extremeHeat || 'Configured in backend weather monitor'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-3xl font-bold text-slate-900">Fraud signal view</h3>
          <ShieldCheck className="h-5 w-5 text-[#26457d]" />
        </div>
        <div className="space-y-3">
          {signalRows.map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <span>{label}</span>
                <span>{Math.round(value * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#efe4d4]">
                <div
                  className={`h-2 rounded-full ${value >= 0.75 ? 'bg-rose-400' : value >= 0.45 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.max(value * 100, 6)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
