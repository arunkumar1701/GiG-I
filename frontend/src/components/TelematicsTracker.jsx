import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, RadioTower } from 'lucide-react';

const ROUTE = [
  { lat: 13.0827, lng: 80.2707, x: 18, y: 72 },
  { lat: 13.0842, lng: 80.2732, x: 31, y: 61 },
  { lat: 13.0861, lng: 80.2765, x: 43, y: 50 },
  { lat: 13.0880, lng: 80.2782, x: 57, y: 42 },
  { lat: 13.0904, lng: 80.2810, x: 72, y: 30 },
];

export default function TelematicsTracker({ user, activePolicy, onShiftChange }) {
  const [routeIndex, setRouteIndex] = useState(0);
  const [online, setOnline] = useState(user?.shift_status === 'Active');

  useEffect(() => {
    if (!online) return undefined;
    const timer = window.setInterval(() => {
      setRouteIndex((previous) => (previous + 1) % ROUTE.length);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [online]);

  const currentPoint = ROUTE[routeIndex];
  const coverageLabel = activePolicy ? 'Coverage follows your active shift' : 'Buy a policy before going on-shift';

  const routePath = useMemo(() => ROUTE.map((point) => `${point.x},${point.y}`).join(' '), []);

  const toggleShift = () => {
    const next = !online;
    setOnline(next);
    onShiftChange?.(next ? 'Active' : 'Offline');
  };

  return (
    <div className="rounded-[28px] bg-tata-bg p-5 shadow-neumorph-outer">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-worker-blue">Live route</p>
          <h3 className="mt-1 text-3xl font-bold text-slate-900">Shift tracker</h3>
        </div>
        <button
          onClick={toggleShift}
          className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
            online ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 shadow-neumorph-inner'
          }`}
        >
          {online ? 'Online' : 'Go online'}
        </button>
      </div>

      <div className="relative h-56 overflow-hidden rounded-[26px] border border-[#e2d8ca] bg-[#efe7d9] shadow-neumorph-inner">
        <div className="absolute inset-0 opacity-60 [background:linear-gradient(90deg,rgba(38,69,125,0.08)_1px,transparent_1px),linear-gradient(rgba(38,69,125,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={routePath}
            fill="none"
            stroke="#26457d"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 4"
          />
        </svg>

        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-700 ease-out"
          style={{ left: `${currentPoint.x}%`, top: `${currentPoint.y}%` }}
        >
          <div className="rounded-full bg-worker-blue p-3 text-white shadow-[0_12px_24px_rgba(38,69,125,0.25)]">
            <Navigation className="h-5 w-5" />
          </div>
          <div className="mt-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
            You
          </div>
        </div>

        <div className="absolute left-4 top-4 rounded-2xl bg-white/85 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">
          <MapPin className="mr-1 inline h-3.5 w-3.5 text-worker-blue" />
          {user?.zone || 'Zone A'}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Coordinates</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{currentPoint.lat.toFixed(4)}, {currentPoint.lng.toFixed(4)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Coverage</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{coverageLabel}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#fff7ec] p-4 text-sm font-medium text-slate-600">
        <RadioTower className="mr-2 inline h-4 w-4 text-worker-blue" />
        Monsoon watch is on. If your zone crosses a trigger, we start claim tracking automatically.
      </div>
    </div>
  );
}
