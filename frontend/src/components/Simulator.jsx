import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { Download, Loader2, PlayCircle } from 'lucide-react';

const EVENT_PRESETS = [
  { type: 'Heavy Rain', amount: 500, severity: 'Moderate' },
  { type: 'Heatwave', amount: 400, severity: 'High' },
  { type: 'Curfew', amount: 800, severity: 'Critical' },
  { type: 'Flood Alert', amount: 1200, severity: 'Severe' },
];

const ZONE_LOCATIONS = {
  'Zone A': { lat: 13.0827, lon: 80.2707 },
  'Zone B': { lat: 13.0604, lon: 80.2496 },
  'Zone C': { lat: 12.9941, lon: 80.2404 },
  'Zone D': { lat: 12.9716, lon: 80.2209 },
};

function toCsv(result) {
  const rows = [
    ['status', result?.status || ''],
    ['message', result?.message || ''],
    ['fraudRiskScore', result?.fraudRiskScore ?? ''],
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}

export default function Simulator({
  user,
  activePolicy,
  apiBase,
  authToken,
  currentUserId,
  onSimulationComplete,
  showToast,
}) {
  const [selectedType, setSelectedType] = useState(EVENT_PRESETS[0].type);
  const [selectedZone, setSelectedZone] = useState(user?.zone || 'Zone A');
  const [customAmount, setCustomAmount] = useState(EVENT_PRESETS[0].amount);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPreset = useMemo(
    () => EVENT_PRESETS.find((item) => item.type === selectedType) || EVENT_PRESETS[0],
    [selectedType],
  );

  const exportResult = () => {
    if (!result) return;
    const blob = new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gigshield-simulation.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const runSimulation = async () => {
    if (!activePolicy) {
      showToast?.('Activate a policy before running a simulation.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(
        `${apiBase}/simulate-event`,
        {
          zone: selectedZone,
          eventType: selectedType,
          amountPerClaim: Number(customAmount),
          driverId: currentUserId,
          location: ZONE_LOCATIONS[selectedZone],
        },
        authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
      );
      setResult(response.data);
      showToast?.('Simulation completed.');
      await onSimulationComplete?.();
    } catch (error) {
      console.error(error);
      showToast?.('Simulation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const timelineSteps = result?.processed?.[0]
    ? [
        ['Tier-1', 'Event and location validated'],
        ['Tier-2', 'Signal scoring completed'],
        ['Tier-3', `Final FRS ${result.processed[0].fraudRiskScore?.toFixed?.(2) || result.fraudRiskScore || '--'}`],
        ['Decision', `${result.processed[0].status} pushed to wallet/admin views`],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Replay studio</p>
        <h2 className="mt-2 text-4xl font-bold text-slate-900">Simulate a disruption</h2>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-[#fff6ec] p-5">
        <div className="grid gap-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Event type</label>
            <select value={selectedType} onChange={(event) => {
              const nextType = event.target.value;
              const preset = EVENT_PRESETS.find((item) => item.type === nextType) || EVENT_PRESETS[0];
              setSelectedType(nextType);
              setCustomAmount(preset.amount);
            }} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 font-semibold text-slate-900 outline-none shadow-sm">
              {EVENT_PRESETS.map((eventPreset) => <option key={eventPreset.type}>{eventPreset.type}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Zone</label>
              <select value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 font-semibold text-slate-900 outline-none shadow-sm">
                {Object.keys(ZONE_LOCATIONS).map((zone) => <option key={zone}>{zone}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Severity</label>
              <div className="mt-2 rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 font-semibold text-slate-900 shadow-sm">
                {selectedPreset.severity}
              </div>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Payout amount</label>
            <input type="number" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 font-semibold text-slate-900 outline-none shadow-sm" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={runSimulation}
              disabled={submitting || !activePolicy}
              className="flex flex-1 items-center justify-center gap-2 rounded-[24px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
              Run simulation
            </button>
            <button
              onClick={exportResult}
              disabled={!result}
              className="rounded-[24px] border border-[#d6c8b6] bg-white px-4 py-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 disabled:opacity-40"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#eadfcd] bg-white p-5 shadow-sm">
        <h3 className="text-3xl font-bold text-slate-900">Validation timeline</h3>
        {!result ? (
          <p className="mt-3 rounded-[22px] bg-[#fff8ef] p-4 text-sm text-slate-500">
            Run a simulation to show the fraud checks, decision, and wallet update path.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-[24px] bg-[#fff8ef] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Outcome</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{result.processed?.[0]?.status || result.status}</p>
              <p className="mt-2 text-sm text-slate-500">{result.message}</p>
            </div>
            {timelineSteps.map(([label, detail]) => (
              <div key={label} className="rounded-[22px] bg-[#fff8ef] px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">{label}</p>
                <p className="mt-1 text-sm text-slate-700">{detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
