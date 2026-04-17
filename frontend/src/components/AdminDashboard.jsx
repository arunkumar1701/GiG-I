import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudRain,
  PauseCircle,
  PlayCircle,
  Radar,
  RefreshCcw,
  Search,
  ShieldAlert,
  Terminal,
  Users2,
  XCircle,
} from 'lucide-react';

const SIGNALS = [
  ['Location', 'frs_location'],
  ['Device', 'frs_device'],
  ['Behavior', 'frs_behavior'],
  ['Network', 'frs_network'],
  ['Event', 'frs_event'],
];

const statusStyles = {
  Approved: 'text-green-400',
  Hold: 'text-amber-400',
  Rejected: 'text-rose-500',
};

const SIMULATION_SCENARIOS = [
  { key: 'legit', label: 'Clean Rain Payout', eventType: 'Heavy Rain', amount: 500, zone: 'Zone A' },
  { key: 'manual', label: 'Shutdown Review', eventType: 'Curfew', amount: 900, zone: 'Zone A' },
  { key: 'duplicate', label: 'Duplicate Device Risk', eventType: 'Heavy Rain', amount: 500, zone: 'Zone A' },
  { key: 'heat', label: 'Heatwave Payout', eventType: 'Heatwave', amount: 400, zone: 'Zone B' },
];

const ZONE_LOCATIONS = {
  'Zone A': { lat: 13.0827, lon: 80.2707 },
  'Zone B': { lat: 13.0604, lon: 80.2496 },
  'Zone C': { lat: 12.9941, lon: 80.2404 },
  'Zone D': { lat: 12.9716, lon: 80.2209 },
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatRatio(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export default function AdminDashboard({ apiBase, authToken, embedded = false }) {
  const [claims, setClaims] = useState([]);
  const [summary, setSummary] = useState(null);
  const [zoneExposure, setZoneExposure] = useState([]);
  const [demoWorkers, setDemoWorkers] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedClaimId, setExpandedClaimId] = useState(null);
  const [simulationForm, setSimulationForm] = useState({
    workerId: '',
    zone: 'Zone A',
    eventType: 'Heavy Rain',
    amount: 500,
  });
  const [fraudTestMode, setFraudTestMode] = useState(false);
  const [fraudParameters, setFraudParameters] = useState({
    deviceClaims: 3,
    ipClaims: 2,
    upiClaims: 1,
  });
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulationRunning, setSimulationRunning] = useState(false);

  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClaims, resLogs, resStatus] = await Promise.all([
        axios.get(`${apiBase}/admin/dashboard`, { headers }),
        axios.get(`${apiBase}/admin/agent-logs`, { headers }),
        axios.get(`${apiBase}/admin/monitor-status`, { headers }),
      ]);
      setClaims(resClaims?.data?.claims || []);
      setSummary(resClaims?.data?.summary || null);
      setZoneExposure(resClaims?.data?.zone_exposure || []);
      setDemoWorkers(resClaims?.data?.demo_workers || []);
      setAgentLogs(resLogs?.data?.logs || []);
      setMonitorStatus(resStatus?.data || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 60000);
    return () => window.clearInterval(interval);
  }, [apiBase, authToken]);

  useEffect(() => {
    if (!demoWorkers.length) return;
    setSimulationForm((current) => {
      const activeWorker = demoWorkers.find((worker) => worker.active_policy_id) || demoWorkers[0];
      if (!activeWorker) return current;
      if (current.workerId && demoWorkers.some((worker) => String(worker.user_id) === String(current.workerId))) {
        return current;
      }
      return {
        ...current,
        workerId: String(activeWorker.user_id),
        zone: activeWorker.zone || current.zone,
      };
    });
  }, [demoWorkers]);

  const handleReview = async (claimId, decision) => {
    try {
      setSubmittingId(claimId);
      await axios.post(`${apiBase}/admin/review/${claimId}`, { decision }, { headers });
      await fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmittingId(null);
    }
  };

  const applySimulationScenario = (scenarioKey) => {
    const scenario = SIMULATION_SCENARIOS.find((item) => item.key === scenarioKey) || SIMULATION_SCENARIOS[0];
    setSimulationForm((current) => ({
      ...current,
      zone: scenario.zone,
      eventType: scenario.eventType,
      amount: scenario.amount,
    }));
  };

  const handleSimulation = async () => {
    if (!simulationForm.workerId) return;
    setSimulationRunning(true);
    try {
      const payload = {
        zone: simulationForm.zone,
        eventType: simulationForm.eventType,
        amountPerClaim: Number(simulationForm.amount),
        driverId: Number(simulationForm.workerId),
        location: ZONE_LOCATIONS[simulationForm.zone],
      };

      // Add fraud test mode parameters if enabled
      if (fraudTestMode) {
        payload.fraudTestMode = true;
        payload.fraudDeviceClaims = fraudParameters.deviceClaims;
        payload.fraudIpClaims = fraudParameters.ipClaims;
        payload.fraudUpiClaims = fraudParameters.upiClaims;
      }

      const response = await axios.post(`${apiBase}/simulate-event`, payload, { headers });
      setSimulationResult(response.data);
      await fetchData();
    } catch (error) {
      console.error(error);
      setSimulationResult({
        status: 'error',
        message: error.response?.data?.detail || 'Simulation failed.',
      });
    } finally {
      setSimulationRunning(false);
    }
  };

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesSearch = !query || [
        String(claim.id),
        String(claim.policy_id || ''),
        claim.trigger_type || '',
        claim.status || '',
        claim.transaction_id || '',
      ].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [claims, searchTerm, statusFilter]);

  const totals = useMemo(() => ({
    total: claims.length,
    flagged: claims.filter((claim) => claim.status === 'Hold').length,
    approved: claims.filter((claim) => claim.status === 'Approved').length,
    payouts: claims
      .filter((claim) => claim.status === 'Approved')
      .reduce((sum, claim) => sum + Number(claim.payout_amount || 0), 0),
  }), [claims]);

  const selectedWorker = useMemo(
    () => demoWorkers.find((worker) => String(worker.user_id) === String(simulationForm.workerId)) || null,
    [demoWorkers, simulationForm.workerId],
  );

  return (
    <div className={`space-y-6 ${embedded ? 'pt-0' : ''}`}>
      <div className="mx-auto grid max-w-[1600px] gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Clock3 className="h-4 w-4 text-cyan-400" />
            Last Monitor Run
          </div>
          <div className="mt-3 text-lg font-black text-white">
            {monitorStatus?.last_run ? new Date(monitorStatus.last_run).toLocaleString() : 'Waiting'}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Users2 className="h-4 w-4 text-emerald-400" />
            Active Shifts
          </div>
          <div className="mt-3 text-lg font-black text-white">{summary?.active_shifts ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Radar className="h-4 w-4 text-emerald-400" />
            Projected Claims
          </div>
          <div className="mt-3 text-lg font-black text-white">{summary?.projected_claims_next_week ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Flagged Claims
          </div>
          <div className="mt-3 text-lg font-black text-white">{totals.flagged}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Paid Out
          </div>
          <div className="mt-3 text-lg font-black text-white">{formatCurrency(totals.payouts)}</div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Exposure forecast</p>
                <h3 className="mt-2 text-2xl font-black text-white">Claims and fund health</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Premium pool</p>
                  <p className="mt-2 text-lg font-black text-white">{formatCurrency(summary?.total_premium_collected)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Projected payout</p>
                  <p className="mt-2 text-lg font-black text-white">{formatCurrency(summary?.projected_payout_next_week)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Projected loss ratio</p>
                  <p className="mt-2 text-lg font-black text-white">{formatRatio(summary?.projected_loss_ratio)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {zoneExposure.map((zone) => (
                <div key={zone.zone} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{zone.zone}</p>
                      <p className="mt-1 text-xs text-slate-400">{zone.weather?.description || 'Weather loading'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${zone.trigger_live ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {zone.trigger_live ? 'Trigger live' : 'Watch'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-950/80 p-3">
                      <p className="font-bold uppercase tracking-widest text-slate-500">Active workers</p>
                      <p className="mt-2 text-lg font-black text-white">{zone.active_workers}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 p-3">
                      <p className="font-bold uppercase tracking-widest text-slate-500">Expected claims</p>
                      <p className="mt-2 text-lg font-black text-white">{zone.expected_claims}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 p-3">
                      <p className="font-bold uppercase tracking-widest text-slate-500">Rain intensity</p>
                      <p className="mt-2 text-lg font-black text-white">{zone.weather?.rain_mm_per_hr ?? 0} mm/hr</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 p-3">
                      <p className="font-bold uppercase tracking-widest text-slate-500">Projected payout</p>
                      <p className="mt-2 text-lg font-black text-white">{formatCurrency(zone.projected_payout)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Disruption simulator</p>
                <h3 className="mt-2 text-2xl font-black text-white">Operational event controls</h3>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Trigger a controlled weather or shutdown event for a selected worker. The same claim, wallet, and review
                  flow is used for operations and testing.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {SIMULATION_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.key}
                    onClick={() => applySimulationScenario(scenario.key)}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-black/30"
                  >
                    <p className="text-sm font-black text-white">{scenario.label}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {scenario.eventType} | {formatCurrency(scenario.amount)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Worker</label>
                    <select
                      value={simulationForm.workerId}
                      onChange={(event) => {
                        const nextWorker = demoWorkers.find((worker) => String(worker.user_id) === event.target.value);
                        setSimulationForm((current) => ({
                          ...current,
                          workerId: event.target.value,
                          zone: nextWorker?.zone || current.zone,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-slate-200 outline-none"
                    >
                      <option value="">Select rider</option>
                      {demoWorkers.map((worker) => (
                        <option key={worker.user_id} value={worker.user_id}>
                          {worker.full_name} | #{worker.user_id} | {worker.zone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Zone</label>
                    <select
                      value={simulationForm.zone}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, zone: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-slate-200 outline-none"
                    >
                      {Object.keys(ZONE_LOCATIONS).map((zone) => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Event type</label>
                    <select
                      value={simulationForm.eventType}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, eventType: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-slate-200 outline-none"
                    >
                      <option value="Heavy Rain">Heavy Rain</option>
                      <option value="Heatwave">Heatwave</option>
                      <option value="Curfew">Curfew</option>
                      <option value="Flood Alert">Flood Alert</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payout amount</label>
                    <input
                      value={simulationForm.amount}
                      onChange={(event) => setSimulationForm((current) => ({ ...current, amount: event.target.value }))}
                      type="number"
                      min="0"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div className={`rounded-xl border p-4 ${fraudTestMode ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="fraudTestMode"
                      checked={fraudTestMode}
                      onChange={(e) => setFraudTestMode(e.target.checked)}
                      className="mt-0.5 h-5 w-5 cursor-pointer rounded border-white/20 bg-slate-950 text-amber-500"
                    />
                    <div>
                      <p className={`text-sm font-bold ${fraudTestMode ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {fraudTestMode ? 'Fraud demo mode' : 'Clean claim mode'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {fraudTestMode
                          ? 'Adds device reuse, network collisions, cluster risk, and GPS anomalies for manual review testing.'
                          : 'Runs a normal disruption claim with clean telemetry and expected payout handling.'}
                      </p>
                    </div>
                    <label htmlFor="fraudTestMode" className="sr-only">
                      Fraud demo mode toggle
                    </label>
                  </div>

                  {fraudTestMode && (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-400">Device Claims (24h)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={fraudParameters.deviceClaims}
                          onChange={(e) => setFraudParameters((current) => ({ ...current, deviceClaims: Number(e.target.value) }))}
                          className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm font-semibold text-amber-200 outline-none"
                        />
                        <p className="mt-1 text-xs text-amber-400/70">3+ shows device reuse risk</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-400">IP Claims (1h)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={fraudParameters.ipClaims}
                          onChange={(e) => setFraudParameters((current) => ({ ...current, ipClaims: Number(e.target.value) }))}
                          className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm font-semibold text-amber-200 outline-none"
                        />
                        <p className="mt-1 text-xs text-amber-400/70">2+ shows burst risk</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-400">UPI Claims (24h)</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={fraudParameters.upiClaims}
                          onChange={(e) => setFraudParameters((current) => ({ ...current, upiClaims: Number(e.target.value) }))}
                          className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm font-semibold text-amber-200 outline-none"
                        />
                        <p className="mt-1 text-xs text-amber-400/70">1+ shows wallet convergence</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={handleSimulation}
                    disabled={simulationRunning || !simulationForm.workerId}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50 ${fraudTestMode ? 'bg-amber-500 text-slate-950' : 'bg-cyan-500 text-slate-950'}`}
                  >
                    <PlayCircle className="h-4 w-4" />
                    {simulationRunning ? 'Running scenario...' : `Run ${fraudTestMode ? 'fraud review' : 'clean payout'} scenario`}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Selected rider</p>
                {selectedWorker ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p className="font-bold text-white">{selectedWorker.full_name}</p>
                    <p>{selectedWorker.platform} | {selectedWorker.vehicle_type || 'Bike'}</p>
                    <p>Zone {selectedWorker.zone} | Shift {selectedWorker.shift_status}</p>
                    <p>Weekly earnings {formatCurrency(selectedWorker.weekly_income)}</p>
                    <p>
                      {selectedWorker.active_policy_id
                        ? `Active policy #${selectedWorker.active_policy_id} at ${formatCurrency(selectedWorker.premium_amount)}`
                        : 'No active policy'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Pick a rider to run the end-to-end flow.</p>
                )}

                <div className="mt-4 rounded-xl bg-slate-950/80 p-4 text-xs text-slate-400">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <CloudRain className="h-4 w-4" />
                    <span className="font-black uppercase tracking-widest">Demo notes</span>
                  </div>
                  <p className="mt-2 text-sm leading-5">
                    {fraudTestMode
                      ? 'Fraud mode adds device, network, wallet, and GPS risk signals for review routing.'
                      : 'Clean mode simulates a standard covered event with payout and policy tracking.'}
                  </p>
                  <p className="sr-only">
                    {fraudTestMode 
                      ? 'Fraud mode active: claim should route to Hold or Reject.'
                      : 'Clean claim mode active.'}
                  </p>
                </div>

                {simulationResult ? (
                  <div className={`mt-4 rounded-xl border p-4 ${
                    simulationResult.processed?.[0]?.status === 'Rejected' ? 'border-rose-500/50 bg-rose-950/30' :
                    simulationResult.processed?.[0]?.status === 'Hold' ? 'border-amber-500/50 bg-amber-950/30' :
                    simulationResult.processed?.[0]?.status === 'Approved' ? 'border-emerald-500/50 bg-emerald-950/30' :
                    'border-white/10 bg-slate-950/80'
                  }`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Latest run</p>
                    <p className={`mt-2 text-lg font-black ${
                      simulationResult.processed?.[0]?.status === 'Rejected' ? 'text-rose-400' :
                      simulationResult.processed?.[0]?.status === 'Hold' ? 'text-amber-300' :
                      simulationResult.processed?.[0]?.status === 'Approved' ? 'text-emerald-400' :
                      'text-white'
                    }`}>
                      {simulationResult.processed?.[0]?.status || simulationResult.status || 'Completed'}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">{simulationResult.message}</p>
                    {simulationResult.weather ? (
                      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="font-black uppercase tracking-widest text-slate-500">Rain</p>
                          <p className="mt-1 font-bold text-white">{simulationResult.weather.rain_mm_per_hr ?? 0} mm/hr</p>
                        </div>
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="font-black uppercase tracking-widest text-slate-500">Temp</p>
                          <p className="mt-1 font-bold text-white">{simulationResult.weather.temp_c ?? '--'} C</p>
                        </div>
                        <div className="rounded-lg bg-black/20 p-2">
                          <p className="font-black uppercase tracking-widest text-slate-500">Disruption</p>
                          <p className="mt-1 font-bold text-white">{simulationResult.disruptionHours ?? 0}h</p>
                        </div>
                      </div>
                    ) : null}
                    {simulationResult.processed?.[0]?.fraudRiskScore != null ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-semibold text-amber-300">
                          Composite FRS: {Number(simulationResult.processed[0].fraudRiskScore).toFixed(3)}
                        </p>
                        {fraudTestMode && <p className="text-xs text-amber-400">✓ Fraud test mode successfully injected signals</p>}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex min-h-[720px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2 text-white">
                  <ShieldAlert className="h-5 w-5 text-blue-500" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Fraud Review Console</h3>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <label className="relative min-w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search claim, policy, trigger, tx"
                      className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-9 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/40"
                    />
                  </label>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold text-slate-200 outline-none"
                  >
                    <option value="all">All statuses</option>
                    <option value="Hold">Hold</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <button
                    onClick={fetchData}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-300 transition hover:bg-white/10"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-bold text-slate-400">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Total {totals.total}</span>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-amber-300">Hold {totals.flagged}</span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">Approved {totals.approved}</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loading && claims.length === 0 ? (
                <div className="flex h-full items-center justify-center font-bold text-slate-500">Connecting to core system...</div>
              ) : filteredClaims.length === 0 ? (
                <div className="flex h-full items-center justify-center font-bold text-slate-600">No claims match the current filters.</div>
              ) : (
                <div className="space-y-3">
                  {filteredClaims.map((claim) => {
                    const expanded = expandedClaimId === claim.id;
                    return (
                      <div key={claim.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-bold tracking-wide text-white">Claim #{claim.id}</div>
                              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Policy {claim.policy_id}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest ${statusStyles[claim.status] || 'text-slate-300'}`}>
                                {claim.status === 'Approved' && <CheckCircle2 className="h-3 w-3" />}
                                {claim.status === 'Rejected' && <XCircle className="h-3 w-3" />}
                                {claim.status === 'Hold' && <PauseCircle className="h-3 w-3" />}
                                {claim.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-cyan-300">{claim.trigger_type}</p>
                            <p className="mt-1 text-xs text-slate-400">{new Date(claim.timestamp).toLocaleString()}</p>
                            <p className="mt-2 text-xs font-medium text-blue-300">{claim.explanation || 'No explanation logged.'}</p>
                          </div>

                          <div className="flex shrink-0 flex-col items-start gap-3 xl:items-end">
                            <div className="text-right">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Composite FRS</div>
                              <div className="mt-1 text-2xl font-black text-white">{Number(claim.frs3 || 0).toFixed(2)}</div>
                              <div className="mt-1 text-xs text-slate-500">{formatCurrency(claim.payout_amount || 0)} payout</div>
                            </div>
                            <button
                              onClick={() => setExpandedClaimId(expanded ? null : claim.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-white/10"
                            >
                              Details
                              <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {SIGNALS.map(([label, key]) => {
                            const value = Number(claim[key] || 0);
                            return (
                              <div key={key}>
                                <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  <span>{label}</span>
                                  <span>{value.toFixed(2)}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                                  <div
                                    className={`h-full ${value >= 0.75 ? 'bg-rose-500' : value >= 0.4 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${Math.min(value * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {expanded && (
                          <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-xl bg-slate-900/70 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">GPS telemetry</p>
                                <div className="mt-3 space-y-2 text-xs text-slate-300">
                                  <p>Continuity: {claim.telemetry_continuity != null ? Number(claim.telemetry_continuity).toFixed(3) : '--'}</p>
                                  <p>Speed risk: {claim.telemetry_speed_risk != null ? Number(claim.telemetry_speed_risk).toFixed(3) : '--'}</p>
                                  <p>GPS stale risk: {claim.telemetry_gps_stale != null ? Number(claim.telemetry_gps_stale).toFixed(3) : '--'}</p>
                                  <p>Accuracy risk: {claim.telemetry_accuracy_risk != null ? Number(claim.telemetry_accuracy_risk).toFixed(3) : '--'}</p>
                                  <p>Pings: {claim.telemetry_ping_count ?? '--'}</p>
                                  <p>Distance: {claim.telemetry_distance_km != null ? `${Number(claim.telemetry_distance_km).toFixed(2)} km` : '--'}</p>
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-900/70 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Event context</p>
                                <div className="mt-3 space-y-2 text-xs text-slate-300">
                                  <p>Rain at trigger: {claim.rain_mm_at_trigger ?? '--'} mm/hr</p>
                                  <p>AQI at trigger: {claim.aqi_at_trigger ?? '--'}</p>
                                  <p>Cluster flagged: {claim.cluster_flagged ? 'Yes' : 'No'}</p>
                                  <p>Lat: {claim.driver_lat != null ? Number(claim.driver_lat).toFixed(5) : '--'}</p>
                                  <p>Lon: {claim.driver_lon != null ? Number(claim.driver_lon).toFixed(5) : '--'}</p>
                                </div>
                              </div>
                            </div>

                            {claim.status === 'Hold' && (
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={() => handleReview(claim.id, 'Approve')}
                                  disabled={submittingId === claim.id}
                                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReview(claim.id, 'Reject')}
                                  disabled={submittingId === claim.id}
                                  className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[720px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-black font-mono shadow-2xl">
          <div className="absolute top-0 z-10 flex w-full items-center gap-2 border-b border-slate-800 bg-slate-900 p-3">
            <div className="h-3 w-3 rounded-full bg-rose-500" />
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <div className="ml-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <Terminal className="h-3 w-3" />
              Live Agent Logs
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_10px_rgb(34,197,94,0.8)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Active</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5 pt-16 text-[11px] leading-relaxed">
            {agentLogs.length === 0 ? (
              <div className="text-slate-600">Waiting for events to trigger AI evaluation matrix...</div>
            ) : (
              <div className="space-y-4">
                {agentLogs.map((log, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="w-32 shrink-0 whitespace-nowrap text-slate-600">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                    </div>
                    <div className="w-24 shrink-0 text-green-500">[{log.step}]</div>
                    <div className={log.step === 'DECISION' ? (log.log_message.includes('Reject') ? 'font-bold text-rose-400' : 'font-bold text-blue-400') : 'text-slate-300'}>
                      {log.claim_id ? <span className="mr-2 text-slate-500">[Claim #{log.claim_id}]</span> : null}
                      {log.log_message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
