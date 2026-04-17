import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  PauseCircle,
  Radar,
  RefreshCcw,
  Search,
  ShieldAlert,
  Terminal,
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

export default function AdminDashboard({ apiBase, authToken, embedded = false }) {
  const [claims, setClaims] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedClaimId, setExpandedClaimId] = useState(null);

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

  const handleReview = async (claimId, decision) => {
    try {
      setSubmittingId(claimId);
      await axios.post(
        `${apiBase}/admin/review/${claimId}`,
        { decision },
        { headers },
      );
      await fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmittingId(null);
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

  return (
    <div className={`space-y-6 ${embedded ? 'pt-0' : ''}`}>
      <div className="mx-auto grid max-w-[1600px] gap-4 md:grid-cols-4">
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
            <Radar className="h-4 w-4 text-emerald-400" />
            Zones Watched
          </div>
          <div className="mt-3 text-lg font-black text-white">
            {(monitorStatus?.zones_monitored || []).join(', ') || 'None'}
          </div>
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
          <div className="mt-3 text-lg font-black text-white">₹{totals.payouts.toFixed(0)}</div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[1.2fr_0.8fr]">
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
                            <div className="mt-1 text-xs text-slate-500">₹{Number(claim.payout_amount || 0).toFixed(0)} payout</div>
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
                          {/* GPS Telemetry Evidence */}
                          <div>
                            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-cyan-400">
                              📡 GPS Telemetry Evidence
                            </p>
                            <div className="grid gap-2">
                              {[
                                { label: 'GPS Continuity', key: 'telemetry_continuity', invert: true, desc: 'Higher = more continuous tracking (good)' },
                                { label: 'Speed Anomaly', key: 'telemetry_speed_risk', invert: false, desc: '>0.9 = possible GPS spoofing' },
                                { label: 'GPS Stale Risk', key: 'telemetry_gps_stale', invert: false, desc: '>0.8 = GPS vanished near trigger' },
                                { label: 'Accuracy Risk', key: 'telemetry_accuracy_risk', invert: false, desc: '>0.8 = poor location accuracy' },
                              ].map(({ label, key, invert, desc }) => {
                                const raw = claim[key];
                                if (raw == null) return null;
                                const val = Number(raw);
                                const riskVal = invert ? (1 - val) : val;
                                const color = riskVal >= 0.75 ? 'bg-rose-500' : riskVal >= 0.4 ? 'bg-amber-400' : 'bg-emerald-400';
                                return (
                                  <div key={key}>
                                    <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                      <span>{label}</span>
                                      <span className={riskVal >= 0.75 ? 'text-rose-400' : riskVal >= 0.4 ? 'text-amber-400' : 'text-emerald-400'}>
                                        {val.toFixed(3)}
                                      </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-950">
                                      <div className={`h-full transition-all ${color}`} style={{ width: `${Math.min(riskVal * 100, 100)}%` }} />
                                    </div>
                                    <p className="mt-0.5 text-[9px] text-slate-600">{desc}</p>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
                              <div className="rounded-lg bg-slate-800 p-2">
                                <p className="text-[9px] font-bold uppercase text-slate-500">GPS Pings</p>
                                <p className="font-bold text-white">{claim.telemetry_ping_count ?? '—'}</p>
                              </div>
                              <div className="rounded-lg bg-slate-800 p-2">
                                <p className="text-[9px] font-bold uppercase text-slate-500">Distance</p>
                                <p className="font-bold text-white">
                                  {claim.telemetry_distance_km != null ? `${Number(claim.telemetry_distance_km).toFixed(2)} km` : '—'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Weather Evidence</p>
                              <div className="mt-3 space-y-2 text-xs text-slate-300">
                                <p>Rain at trigger: <span className="font-bold text-cyan-300">{claim.rain_mm_at_trigger ?? '--'} mm/hr</span></p>
                                <p>AQI at trigger: <span className="font-bold text-cyan-300">{claim.aqi_at_trigger ?? '--'}</span></p>
                                <p>Cluster flagged: <span className={claim.cluster_flagged ? 'font-bold text-rose-400' : 'text-slate-400'}>{claim.cluster_flagged ? 'Yes ⚠' : 'No'}</span></p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Location</p>
                              <div className="mt-3 space-y-2 text-xs text-slate-300">
                                {claim.driver_lat && claim.driver_lon ? (
                                  <>
                                    <p>Lat: <span className="font-bold text-cyan-300">{Number(claim.driver_lat).toFixed(5)}</span></p>
                                    <p>Lon: <span className="font-bold text-cyan-300">{Number(claim.driver_lon).toFixed(5)}</span></p>
                                    <a
                                      href={`https://www.openstreetmap.org/?mlat=${claim.driver_lat}&mlon=${claim.driver_lon}&zoom=14`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-block rounded-lg bg-blue-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-blue-500"
                                    >
                                      View on Map ↗
                                    </a>
                                  </>
                                ) : (
                                  <p className="text-slate-500">No GPS coordinates recorded</p>
                                )}
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chain & Device</p>
                              <div className="mt-3 space-y-1 text-[10px] text-slate-400 break-all">
                                {claim.transaction_id && <p>tx id: <span className="text-slate-300">{claim.transaction_id}</span></p>}
                                {claim.data_hash && <p>data hash: <span className="text-slate-300">{claim.data_hash}</span></p>}
                                {claim.device_hash && <p>device: <span className="text-slate-300">{claim.device_hash}</span></p>}
                              </div>
                            </div>

                            {claim.status === 'Hold' && (
                              <div className="md:col-span-2 flex gap-2 pt-2">
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
              <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgb(34,197,94,0.8)] animate-pulse" />
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
