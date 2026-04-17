import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  CloudRain,
  Loader2,
  ShieldCheck,
  ThermometerSun,
} from 'lucide-react';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function buildPricingHighlights(user, quoteLike) {
  return [
    {
      label: 'Weekly earnings',
      value: formatCurrency(user.weekly_income),
      detail: 'Higher income means a bigger protected payout base.',
    },
    {
      label: 'Route risk',
      value: `${user.zone} | ${user.platform}`,
      detail: 'Zone, platform, and city conditions tune the weekly price.',
    },
    {
      label: 'Vehicle',
      value: user.vehicle_type || 'Bike',
      detail: 'Vehicle type changes exposure during active delivery hours.',
    },
    {
      label: 'Disruption window',
      value: `${quoteLike?.lost_hours_est ?? 0}h`,
      detail: 'Live forecast hours for rain, heat, or shutdown risk.',
    },
  ];
}

const COVERAGE_ITEMS = [
  { title: 'Covered', body: 'Heavy rain, heatwave, flood alert, and official shutdown events during an active shift.' },
  { title: 'Not covered', body: 'Offline hours, wrong zone claims, duplicate device activity, or GPS evidence that does not match the route.' },
  { title: 'Payout rule', body: 'Valid events are checked automatically and credited to the worker wallet after fraud review.' },
];

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

  const claims = policyDetail?.claims || [];
  const latestClaim = claims[0] || null;
  const approvedClaims = useMemo(
    () => claims.filter((claim) => claim.status === 'Approved'),
    [claims],
  );
  const livePremium = policyDetail?.liveQuote?.premium ?? quote?.premium ?? activePolicy?.premium_amount ?? 0;
  const liveQuoteForDisplay = policyDetail?.liveQuote || quote;
  const pricingHighlights = buildPricingHighlights(user, liveQuoteForDisplay);
  const claimStage = latestClaim?.status === 'Approved' ? 4 : latestClaim?.status === 'Hold' ? 2 : latestClaim ? 1 : 0;
  const claimSteps = ['Claim initiated', 'Checking route', 'Approved', 'Payout sent'];

  if (!activePolicy && !loadingPolicies && policies.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Protection plan</p>
          <h2 className="mt-2 text-4xl font-bold text-slate-900">Choose your weekly cover</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your weekly premium is calculated from earnings, city zone, vehicle, and live disruption conditions.
          </p>
        </div>

        <div className="rounded-[28px] border border-[#eadfcd] bg-[#fff6ec] p-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(135px,1fr))] gap-3">
            <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Zone</p>
              <p className="mt-2 font-bold text-slate-900">{user.zone}</p>
            </div>
            <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Weekly earnings</p>
              <p className="mt-2 font-bold text-slate-900">{formatCurrency(user.weekly_income)}</p>
            </div>
            <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Platform</p>
              <p className="mt-2 font-bold text-slate-900">{user.platform}</p>
            </div>
            <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Vehicle</p>
              <p className="mt-2 font-bold text-slate-900">{user.vehicle_type || 'Bike'}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {COVERAGE_ITEMS.map((item) => (
            <div key={item.title} className="rounded-[20px] border border-[#eadfcd] bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
            </div>
          ))}
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
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Current quote</p>
              <h3 className="mt-2 text-4xl font-bold text-slate-900">{formatCurrency(quote.premium)}</h3>
              <p className="mt-2 text-sm text-slate-500">
                per week with automatic claim tracking during active shifts
              </p>
            </div>

            <div className="grid gap-3">
              {pricingHighlights.map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#fff8ef] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{item.value}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onBuyCoverage}
              className="w-full rounded-[24px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white"
            >
              Activate this cover
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
          <p className="mt-2 text-sm text-slate-500">
            Weekly cover is locked for the active cycle and pays automatically when a valid disruption hits your shift.
          </p>
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
              <div className="text-right">
                <p className="font-bold text-[#26457d]">{formatCurrency(policy.premium_amount)}</p>
                <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.14em] ${policy.active_status ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {policy.active_status ? 'Active' : 'History'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-[#fff6ec] p-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Live weekly price</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(livePremium)}
            </p>
            {policyDetail?.policy?.premium_amount != null ? (
              <p className="mt-1 text-xs text-slate-500">
                Active cover locked at {formatCurrency(policyDetail.policy.premium_amount)}
              </p>
            ) : null}
            {policyDetail?.policy?.premium_amount != null && Number(livePremium) !== Number(policyDetail.policy.premium_amount) ? (
              <p className="mt-1 text-xs font-bold text-[#26457d]">
                Next quote updates to {formatCurrency(livePremium)}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Coverage remaining</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(policyDetail?.coverageRemaining || 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Claims filed</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{claims.length}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Payouts received</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{approvedClaims.length}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-[#26457d]" />
              <p className="font-bold text-slate-900">Rain trigger</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {policyDetail?.triggerRules?.heavyRain || 'Configured in backend weather monitor'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <div className="flex items-center gap-2">
              <ThermometerSun className="h-4 w-4 text-[#26457d]" />
              <p className="font-bold text-slate-900">Heat trigger</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {policyDetail?.triggerRules?.extremeHeat || 'Configured in backend weather monitor'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#26457d]" />
              <p className="font-bold text-slate-900">Pricing basis</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Your active cover keeps the agreed weekly premium until this cycle ends. A fresh renewal quote uses your latest
              earnings, {user.platform}, {user.vehicle_type || 'Bike'}, {user.zone}, and forecast disruption hours.
            </p>
          </div>

          <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#26457d]" />
              <p className="font-bold text-slate-900">What is covered</p>
            </div>
            <div className="mt-3 space-y-3">
              {COVERAGE_ITEMS.map((item) => (
                <div key={item.title}>
                  <p className="text-sm font-bold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] bg-tata-bg p-5 shadow-neumorph-outer">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-3xl font-bold text-slate-900">Claim tracking</h3>
          <ShieldCheck className="h-5 w-5 text-[#26457d]" />
        </div>
        {latestClaim ? (
          <div>
            <div className="relative mb-6 mt-3 h-2 rounded-full bg-[#e7dccb]">
              <div
                className="h-2 rounded-full bg-[#26457d] transition-all duration-500"
                style={{ width: `${Math.max((claimStage / 4) * 100, 8)}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {claimSteps.map((step, index) => (
                <div key={step} className="text-center">
                  <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${
                    claimStage >= index + 1 ? 'bg-[#26457d] text-white' : 'bg-white text-slate-400'
                  }`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[22px] bg-white p-4">
              <p className="text-sm font-bold text-slate-900">{latestClaim.trigger_type}</p>
              <p className="mt-1 text-sm text-slate-500">
                {latestClaim.status} | {new Date(latestClaim.timestamp).toLocaleString()}
              </p>
              <p className="mt-2 text-sm font-semibold text-[#2f8f5b]">
                {formatCurrency(latestClaim.payout_amount || 0)}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-[22px] bg-white p-4 text-sm text-slate-500">
            No claim is active right now. If a covered disruption hits your shift, tracking appears here automatically.
          </p>
        )}
      </div>
    </div>
  );
}
