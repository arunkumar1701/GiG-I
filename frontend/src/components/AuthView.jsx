import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];
const PLATFORMS = ['Zomato', 'Swiggy', 'Zepto', 'Blinkit'];

export default function AuthView({ onLoginSuccess, initialMode = 'worker' }) {
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('Zone A');
  const [platform, setPlatform] = useState('Zomato');
  const [weeklyIncome, setWeeklyIncome] = useState(3000);
  const [vehicleType, setVehicleType] = useState('Bike');
  const [adminUsername, setAdminUsername] = useState('gigadmin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [otpMeta, setOtpMeta] = useState(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const workerSteps = useMemo(() => (
    step === 'phone' ? 1 : step === 'otp' ? 2 : 3
  ), [step]);

  const normalizePhone = (value) => value.replace(/\D/g, '').slice(0, 10);

  const handleRequestOtp = async () => {
    const normalized = normalizePhone(mobileNumber);
    if (normalized.length !== 10) {
      setErrorMessage('Enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await axios.post(`${API_BASE}/auth/otp/request`, { phone: normalized });
      setMobileNumber(normalized);
      setOtpMeta(response.data);
      setStep('otp');
    } catch (error) {
      console.error(error);
      setErrorMessage(error.response?.data?.detail || 'Unable to send OTP right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await axios.post(`${API_BASE}/auth/otp/verify`, {
        phone: normalizePhone(mobileNumber),
        otp: otp.trim(),
      });

      try {
        const login = await axios.post(`${API_BASE}/login`, { phone: normalizePhone(mobileNumber) });
        onLoginSuccess({
          token: login.data.access_token,
          refreshToken: login.data.refresh_token,
          userId: login.data.user_id,
          isAdmin: false,
          user: login.data.user,
        });
      } catch (error) {
        if (error.response?.status === 404) {
          setStep('profile');
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error.response?.data?.detail || 'OTP verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await axios.post(`${API_BASE}/register`, {
        name: fullName || 'Delivery Partner',
        city: city || 'Chennai',
        zone,
        platform,
        weekly_income: parseFloat(weeklyIncome) || 3000,
        vehicle_type: vehicleType,
        phone: normalizePhone(mobileNumber),
      });

      onLoginSuccess({
        token: response.data.access_token,
        refreshToken: response.data.refresh_token,
        userId: response.data.user_id,
        isAdmin: false,
        user: response.data.user,
      });
    } catch (error) {
      console.error(error);
      setErrorMessage(error.response?.data?.detail || 'Registration failed. Please check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await axios.post(`${API_BASE}/admin/login`, {
        username: adminUsername,
        password: adminPassword,
        otp: adminOtp,
      });
      onLoginSuccess({
        token: res.data.access_token,
        refreshToken: res.data.refresh_token,
        userId: res.data.user_id,
        isAdmin: true,
        user: res.data.user,
      });
    } catch (error) {
      console.error(error);
      setErrorMessage('Admin login failed. Check username, password, and MFA code.');
    } finally {
      setIsLoading(false);
    }
  };

  const workerBody = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#26457d]">Worker access</p>
          <h2 className="mt-2 text-5xl font-bold text-slate-900">
            {step === 'phone' ? 'Enter your phone' : step === 'otp' ? 'Verify OTP' : 'Complete profile'}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {step === 'phone'
              ? 'We use your phone number to restore your policy and wallet instantly.'
              : step === 'otp'
                ? 'Enter the one-time code to continue to your protected worker account.'
                : 'Add the basics once so pricing and claims can be tailored to your route.'}
          </p>
        </div>
        <div className="rounded-[24px] border border-[#efe4d4] bg-[#fffaf1] p-4 shadow-inner">
          <Smartphone className="h-6 w-6 text-[#26457d]" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full ${workerSteps >= index ? 'bg-[#26457d]' : 'bg-[#e8dece]'}`}
          />
        ))}
      </div>

      {step === 'phone' && (
        <div className="mt-8 space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Phone number</label>
            <div className="mt-2 flex items-center rounded-[22px] border border-[#e5d8c6] bg-white px-4 py-4 shadow-sm">
              <span className="mr-3 border-r border-[#ece1d3] pr-3 font-bold text-slate-500">+91</span>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(normalizePhone(event.target.value))}
                placeholder="9876543210"
                className="w-full bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <button
            disabled={isLoading}
            onClick={handleRequestOtp}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="mt-8 space-y-4">
          <div className="rounded-[24px] border border-[#eadfcd] bg-[#fffaf2] p-4 text-sm text-slate-600">
            <p className="font-semibold">Sending code to {otpMeta?.phoneMasked || 'your phone'}.</p>
            {otpMeta?.demoOtp ? (
              <p className="mt-2 rounded-xl bg-[#f3ecdf] px-3 py-2 text-xs font-bold text-[#26457d]">
                Demo OTP: {otpMeta.demoOtp}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">One-time code</label>
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
              className="mt-2 w-full rounded-[22px] border border-[#e5d8c6] bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-400 shadow-sm"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('phone')}
              className="flex items-center justify-center gap-2 rounded-[22px] border border-[#d8cab7] bg-white px-4 py-4 text-sm font-bold text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              disabled={isLoading}
              onClick={handleVerifyOtp}
              className="flex flex-1 items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Verify & Continue <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      )}

      {step === 'profile' && (
        <div className="mt-8 space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Full name</label>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm" placeholder="Ravi Kumar" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">City</label>
              <input value={city} onChange={(event) => setCity(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm" placeholder="Chennai" />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Zone</label>
              <select value={zone} onChange={(event) => setZone(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm">
                {ZONES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Platform</label>
              <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm">
                {PLATFORMS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Vehicle</label>
              <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm">
                <option>Bike</option>
                <option>Scooter</option>
                <option>EV Bike</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Weekly income</label>
            <input value={weeklyIncome} onChange={(event) => setWeeklyIncome(event.target.value)} type="number" className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm" placeholder="3000" />
          </div>
          <button
            disabled={isLoading}
            onClick={handleRegister}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create worker account <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6f1e7_58%,#efe5d5_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center gap-10">
        <div className="hidden max-w-md lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e9e0d3] bg-white/70 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#26457d] shadow-sm backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            Worker-first onboarding
          </div>
          <h1 className="mt-6 text-6xl font-bold leading-none text-slate-900">Simple enough for the road.</h1>
          <p className="mt-5 text-lg font-medium leading-8 text-slate-600">
            Phone login, low-friction profile setup, and a clear path to policy, claims, and wallet payout history.
          </p>
        </div>

        <div className="w-full max-w-[410px] rounded-[38px] border border-white/70 bg-[#fbf7ef]/95 p-5 shadow-[0_30px_80px_rgba(73,58,32,0.16)] backdrop-blur">
          <div className="mx-auto mb-5 h-1.5 w-20 rounded-full bg-[#e5dccb]" />

          <div className="rounded-[30px] border border-[#efe4d4] bg-white/75 p-6 shadow-[0_18px_40px_rgba(128,108,73,0.12)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-slate-900">GigShield</p>
                <p className="text-sm text-slate-500">Income protection for delivery partners</p>
              </div>
              <button
                onClick={() => {
                  setMode(mode === 'worker' ? 'admin' : 'worker');
                  setStep('phone');
                  setErrorMessage('');
                }}
                className="rounded-2xl border border-[#d8cab7] bg-[#fff9f2] px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600"
              >
                {mode === 'worker' ? 'Admin' : 'Worker'}
              </button>
            </div>

            {mode === 'worker' ? workerBody : (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#26457d]">Admin access</p>
                <h2 className="mt-2 text-5xl font-bold text-slate-900">Underwriter login</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">Enter credentials and MFA to review held claims.</p>
                <div className="mt-8 space-y-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Username</label>
                    <input value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Password</label>
                    <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">MFA code</label>
                    <input value={adminOtp} onChange={(event) => setAdminOtp(event.target.value)} placeholder="6-digit TOTP" className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm" />
                  </div>
                  <button
                    disabled={isLoading}
                    onClick={handleAdminLogin}
                    className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enter admin console <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {errorMessage ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
