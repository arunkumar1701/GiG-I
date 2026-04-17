import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, MapPin, Navigation, RadioTower, Wifi, WifiOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const PING_INTERVAL_MS = 30_000; // 30 seconds

function AccuracyBadge({ accuracy }) {
  if (accuracy == null) return null;
  const good = accuracy < 20;
  const ok = accuracy < 60;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
      good ? 'bg-emerald-100 text-emerald-700' : ok ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${good ? 'bg-emerald-500' : ok ? 'bg-amber-500' : 'bg-red-500'}`} />
      ±{Math.round(accuracy)}m
    </span>
  );
}

export default function TelematicsTracker({ user, activePolicy, onShiftChange, token }) {
  const [online, setOnline]         = useState(false);
  const [position, setPosition]     = useState(null);   // { lat, lon, accuracy, speed, heading }
  const [gpsError, setGpsError]     = useState(null);
  const [pingCount, setPingCount]   = useState(0);
  const [shiftId, setShiftId]       = useState(null);
  const [shiftStart, setShiftStart] = useState(null);
  const [status, setStatus]         = useState('idle'); // idle | requesting | active | error
  const [consent, setConsent]       = useState(false);
  const [consentAsked, setConsentAsked] = useState(false);

  const watchId   = useRef(null);
  const pingTimer = useRef(null);
  const latestPos = useRef(null);  // always holds most recent position for pings

  // ── Helpers ──────────────────────────────────────────────────────────────

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const sendPing = useCallback(async (pos) => {
    if (!pos || !shiftId) return;
    try {
      await fetch(`${API_URL}/api/v1/shift/ping`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          lat: pos.lat,
          lon: pos.lon,
          accuracy_m: pos.accuracy,
          speed_kmh: pos.speed != null ? pos.speed * 3.6 : null,  // m/s → km/h
          heading: pos.heading,
        }),
      });
      setPingCount(c => c + 1);
    } catch (err) {
      console.warn('[Telematics] Ping failed:', err);
    }
  }, [authHeaders, shiftId]);

  // ── GPS Watch ────────────────────────────────────────────────────────────

  const startGpsWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device.');
      setStatus('error');
      return;
    }
    setStatus('requesting');
    watchId.current = navigator.geolocation.watchPosition(
      (geo) => {
        const pos = {
          lat:      geo.coords.latitude,
          lon:      geo.coords.longitude,
          accuracy: geo.coords.accuracy,
          speed:    geo.coords.speed,
          heading:  geo.coords.heading,
        };
        setPosition(pos);
        latestPos.current = pos;
        setGpsError(null);
        setStatus('active');
      },
      (err) => {
        setGpsError(err.message);
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  const stopGpsWatch = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  // ── Shift Control ────────────────────────────────────────────────────────

  const startShift = useCallback(async (pos) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/shift/start`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ lat: pos.lat, lon: pos.lon, accuracy_m: pos.accuracy }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setShiftId(data.shift_id);
      setShiftStart(new Date());
      setPingCount(1);
      return data.shift_id;
    } catch (err) {
      console.error('[Telematics] Start shift failed:', err);
      throw err;
    }
  }, [authHeaders]);

  const endShift = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/v1/shift/end`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch (err) {
      console.warn('[Telematics] End shift failed:', err);
    }
    setShiftId(null);
    setShiftStart(null);
    setPingCount(0);
  }, [authHeaders]);

  // ── Toggle Online/Offline ─────────────────────────────────────────────────

  const handleToggle = useCallback(async () => {
    if (online) {
      // Go Offline
      clearInterval(pingTimer.current);
      stopGpsWatch();
      await endShift();
      setOnline(false);
      setStatus('idle');
      onShiftChange?.('Offline');
    } else {
      // Request consent then go online
      if (!consent) {
        setConsentAsked(true);
        return;
      }
      startGpsWatch();
    }
  }, [online, consent, startGpsWatch, stopGpsWatch, endShift, onShiftChange]);

  const acceptConsent = useCallback(() => {
    setConsent(true);
    setConsentAsked(false);
    startGpsWatch();
  }, [startGpsWatch]);

  // Once we get a position AND shift hasn't started → start shift
  useEffect(() => {
    if (status === 'active' && position && !shiftId && !online) {
      (async () => {
        try {
          const sid = await startShift(position);
          setOnline(true);
          onShiftChange?.('Active');

          // Start periodic pings
          pingTimer.current = setInterval(() => {
            if (latestPos.current) sendPing(latestPos.current);
          }, PING_INTERVAL_MS);

          console.log('[Telematics] Shift started, id=', sid);
        } catch {
          setStatus('error');
          setGpsError('Failed to start shift on server. Check your connection.');
          stopGpsWatch();
        }
      })();
    }
  }, [status, position, shiftId, online, startShift, sendPing, stopGpsWatch, onShiftChange]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(pingTimer.current);
    stopGpsWatch();
  }, [stopGpsWatch]);

  // ── Duration display ──────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState('00:00');
  useEffect(() => {
    if (!shiftStart) return;
    const t = setInterval(() => {
      const diff = Math.floor((Date.now() - shiftStart.getTime()) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(t);
  }, [shiftStart]);

  // ── Render ────────────────────────────────────────────────────────────────

  const coverageLabel = activePolicy
    ? 'Coverage tracks your active shift'
    : 'Buy a policy before going on-shift';

  return (
    <div className="rounded-[28px] bg-tata-bg p-5 shadow-neumorph-outer">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-worker-blue">Live GPS</p>
          <h3 className="mt-1 text-3xl font-bold text-slate-900">Shift tracker</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={status === 'requesting'}
          className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${
            online
              ? 'bg-emerald-600 text-white shadow-md'
              : status === 'requesting'
              ? 'cursor-wait bg-amber-400 text-white'
              : 'bg-white text-slate-600 shadow-neumorph-inner'
          }`}
        >
          {online ? 'Online ✓' : status === 'requesting' ? 'Locating…' : 'Go online'}
        </button>
      </div>

      {/* Consent Dialog */}
      {consentAsked && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-800">
            <MapPin className="h-4 w-4" /> Location required
          </p>
          <p className="mb-3 text-xs text-amber-700">
            GiG-I needs your GPS location to verify your presence during weather events and process claims. Your location is only tracked while you are on-shift.
          </p>
          <div className="flex gap-2">
            <button
              onClick={acceptConsent}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white"
            >
              Allow & Go Online
            </button>
            <button
              onClick={() => setConsentAsked(false)}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* GPS Error */}
      {gpsError && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {gpsError}
        </div>
      )}

      {/* Map / visualization */}
      <div className="relative h-48 overflow-hidden rounded-[26px] border border-[#e2d8ca] bg-[#efe7d9] shadow-neumorph-inner">
        <div className="absolute inset-0 opacity-60 [background:linear-gradient(90deg,rgba(38,69,125,0.08)_1px,transparent_1px),linear-gradient(rgba(38,69,125,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

        {online && position ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="rounded-full bg-worker-blue p-3 text-white shadow-[0_12px_24px_rgba(38,69,125,0.25)] animate-pulse">
              <Navigation className="h-5 w-5" />
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
              {position.lat.toFixed(5)}, {position.lon.toFixed(5)}
            </div>
            <AccuracyBadge accuracy={position.accuracy} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <WifiOff className="mx-auto mb-2 h-8 w-8" />
              <p className="text-xs font-medium">Go online to start tracking</p>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-2xl bg-white/85 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">
          <MapPin className="mr-1 inline h-3.5 w-3.5 text-worker-blue" />
          {user?.zone || 'Zone A'}
        </div>

        {online && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm">
            <Activity className="h-3 w-3" />
            LIVE
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Duration</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{online ? elapsed : '—'}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">GPS pings</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{online ? pingCount : '—'}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Speed</p>
          <p className="mt-2 text-sm font-bold text-slate-900">
            {online && position?.speed != null ? `${(position.speed * 3.6).toFixed(1)} km/h` : '—'}
          </p>
        </div>
      </div>

      {/* Status footer */}
      <div className={`mt-4 rounded-2xl p-4 text-sm font-medium ${
        online ? 'bg-emerald-50 text-emerald-800' : 'bg-[#fff7ec] text-slate-600'
      }`}>
        {online ? (
          <span className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Shift active · GPS recorded every 30s · Claims auto-filed on weather trigger
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <RadioTower className="h-4 w-4 text-worker-blue" />
            {coverageLabel}
          </span>
        )}
      </div>
    </div>
  );
}
