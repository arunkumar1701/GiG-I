import React, { useEffect, useRef, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Smartphone, Flame } from 'lucide-react';
import axios from 'axios';
import { setupRecaptcha, sendOtp, auth } from '../firebase';
import { signOut } from 'firebase/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];
const PLATFORMS = ['Zomato', 'Swiggy', 'Zepto', 'Blinkit'];

export default function AuthView({ onLoginSuccess, initialMode = 'worker', theme = 'light', onToggleTheme }) {
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
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [adminUsername, setAdminUsername] = useState('gigadmin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [adminOtpMeta, setAdminOtpMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [otpSentMasked, setOtpSentMasked] = useState('');
  const [firebaseProvider, setFirebaseProvider] = useState(null); // Firebase ConfirmationResult

  // keep a ref to the current phone for the profile step
  const verifiedPhoneRef = useRef('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const workerSteps = useMemo(() => (
    step === 'phone' ? 1 : step === 'otp' ? 2 : 3
  ), [step]);

  const normalizePhone = (value) => value.replace(/\D/g, '').slice(0, 10);

  // ------------------------------------------------------------------
  // Step 1 — Firebase: send OTP via invisible reCAPTCHA
  // ------------------------------------------------------------------
  const handleRequestOtp = async () => {
    const normalized = normalizePhone(mobileNumber);
    if (normalized.length !== 10) {
      setErrorMessage('Enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const verifier = setupRecaptcha('recaptcha-container');
      const confirmationResult = await sendOtp(normalized, verifier);
      setFirebaseProvider(confirmationResult);
      setMobileNumber(normalized);
      setOtpSentMasked(`+91 ******${normalized.slice(-4)}`);
      setStep('otp');
    } catch (error) {
      console.error('[Firebase OTP]', error);
      // Firebase error codes: https://firebase.google.com/docs/reference/js/auth#autherrorcodes
      const code = error?.code || '';
      if (code === 'auth/invalid-phone-number') {
        setErrorMessage('Invalid phone number format.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Too many OTP attempts. Please wait and try again.');
      } else if (code === 'auth/captcha-check-failed') {
        setErrorMessage('reCAPTCHA check failed. Please refresh and try again.');
      } else {
        setErrorMessage(error.message || 'Unable to send OTP via Firebase. Check your Firebase config.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Step 2 — Firebase: verify OTP, then call backend /login
  // ------------------------------------------------------------------
  const handleVerifyOtp = async () => {
    if (!firebaseProvider) {
      setErrorMessage('Session expired. Please go back and request a new OTP.');
      return;
    }
    if (otp.trim().length !== 6) {
      setErrorMessage('Enter the 6-digit OTP.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      // Confirm the code with Firebase — throws if wrong
      await firebaseProvider.confirm(otp.trim());

      // Firebase verified. Sign out of Firebase immediately —
      // our app uses backend JWT, not Firebase sessions.
      await signOut(auth);

      const phone = normalizePhone(mobileNumber);
      verifiedPhoneRef.current = phone;

      // Try to log in to the backend with the verified phone
      try {
        const login = await axios.post(`${API_BASE}/login`, { phone });
        onLoginSuccess({
          token: login.data.access_token,
          refreshToken: login.data.refresh_token,
          userId: login.data.user_id,
          isAdmin: false,
          user: login.data.user,
        });
      } catch (error) {
        if (error.response?.status === 404) {
          // New user — show profile setup
          setStep('profile');
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('[Firebase OTP Verify]', error);
      const code = error?.code || '';
      if (code === 'auth/invalid-verification-code') {
        setErrorMessage('Incorrect OTP. Please try again.');
      } else if (code === 'auth/code-expired') {
        setErrorMessage('OTP has expired. Please go back and request a new one.');
      } else if (code === 'auth/session-expired') {
        setErrorMessage('Session expired. Please request a new OTP.');
      } else {
        setErrorMessage(error.response?.data?.detail || error.message || 'OTP verification failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Step 3 — Register new worker profile
  // ------------------------------------------------------------------
  const handleRegister = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const phone = verifiedPhoneRef.current || normalizePhone(mobileNumber);
      const emergencyContactPhone = emergencyContact ? normalizePhone(emergencyContact) : null;
      
      const response = await axios.post(`${API_BASE}/register`, {
        name: fullName || 'Delivery Partner',
        city: city || 'Chennai',
        zone,
        platform,
        weekly_income: parseFloat(weeklyIncome) || 3000,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber || null,
        plan_tier: 'Standard',
        phone: phone || null,
        upi_id: upiId || null,
        bank_name: bankName || null,
        bank_account_number: bankAccountNumber || null,
        ifsc_code: ifscCode || null,
        emergency_contact: emergencyContactPhone,
      });

      onLoginSuccess({
        token: response.data.access_token,
        refreshToken: response.data.refresh_token,
        userId: response.data.user_id,
        isAdmin: false,
        user: response.data.user,
      });
    } catch (error) {
      console.error('Registration error:', error);
      // Handle Pydantic validation errors (422)
      if (error.response?.status === 422) {
        const validationErrors = error.response?.data?.detail;
        let errorMsg = 'Validation error: ';
        if (Array.isArray(validationErrors)) {
          errorMsg += validationErrors.map(e => `${e.loc?.join('.')} - ${e.msg}`).join('; ');
        } else {
          errorMsg += JSON.stringify(validationErrors);
        }
        setErrorMessage(errorMsg);
      } else {
        setErrorMessage(error.response?.data?.detail || error.message || 'Registration failed. Please check backend.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Admin OTP (still uses backend Fast2SMS/Twilio/Demo)
  // ------------------------------------------------------------------
  const handleAdminSendOtp = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await axios.post(`${API_BASE}/api/v1/admin/send-otp`, {
        username: adminUsername,
        password: adminPassword,
      });
      setAdminOtpMeta(response.data);
      // Auto-fill the OTP field when the backend provides a demo code
      if (response.data?.demoOtp) {
        setAdminOtp(response.data.demoOtp);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error.response?.data?.detail || 'Unable to send admin OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await axios.post(`${API_BASE}/api/v1/admin/verify-otp`, {
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
      setErrorMessage(error.response?.data?.detail || 'Admin login failed. Check credentials and OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Render — Worker auth body
  // ------------------------------------------------------------------
  const workerBody = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1 mb-2">
            <Flame className="h-3 w-3 text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">
              Powered by Firebase
            </span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#26457d]">Worker access</p>
          <h2 className="mt-2 text-5xl font-bold text-slate-900">
            {step === 'phone' ? 'Enter your phone' : step === 'otp' ? 'Verify OTP' : 'Complete profile'}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {step === 'phone'
              ? 'We use Firebase Phone Auth to verify your identity securely.'
              : step === 'otp'
                ? 'Enter the one-time code sent to your phone.'
                : 'Add the basics once so pricing and claims can be tailored to your route.'}
          </p>
        </div>
        <div className="rounded-[24px] border border-[#efe4d4] bg-[#fffaf1] p-4 shadow-inner flex-shrink-0">
          <Smartphone className="h-6 w-6 text-[#26457d]" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${workerSteps >= index ? 'bg-[#26457d]' : 'bg-[#e8dece]'}`}
          />
        ))}
      </div>

      {/* ---- Step 1: Phone Input ---- */}
      {step === 'phone' && (
        <div className="mt-8 space-y-4">
          {/* Invisible reCAPTCHA mount point */}
          <div id="recaptcha-container" />

          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Phone number</label>
            <div className="mt-2 flex items-center rounded-[22px] border border-[#e5d8c6] bg-white px-4 py-4 shadow-sm focus-within:border-[#26457d] transition-colors">
              <span className="mr-3 border-r border-[#ece1d3] pr-3 font-bold text-slate-500">+91</span>
              <input
                id="worker-phone-input"
                type="tel"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(normalizePhone(event.target.value))}
                placeholder="9876543210"
                className="w-full bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
              />
            </div>
          </div>

          <button
            id="worker-send-otp-btn"
            disabled={isLoading}
            onClick={handleRequestOtp}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] active:scale-[0.98] disabled:opacity-60"
          >
            {isLoading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <><Flame className="h-4 w-4 text-orange-300" /> Send OTP via Firebase <ArrowRight className="h-4 w-4" /></>
            }
          </button>
        </div>
      )}

      {/* ---- Step 2: OTP Verification ---- */}
      {step === 'otp' && (
        <div className="mt-8 space-y-4">
          <div className="rounded-[24px] border border-[#eadfcd] bg-[#fffaf2] p-4 text-sm text-slate-600">
            <p className="font-semibold">OTP sent to <span className="text-[#26457d]">{otpSentMasked}</span></p>
            <p className="mt-1 text-xs text-slate-400">Delivered via Firebase Phone Authentication</p>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">One-time code</label>
            <input
              id="worker-otp-input"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
              className="mt-2 w-full rounded-[22px] border border-[#e5d8c6] bg-white px-4 py-4 text-lg font-semibold tracking-[0.5em] text-slate-900 outline-none placeholder:text-slate-400 placeholder:tracking-normal shadow-sm focus:border-[#26457d] transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
            />
          </div>

          <div className="flex gap-3">
            <button
              id="worker-otp-back-btn"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setFirebaseProvider(null);
              }}
              className="flex items-center justify-center gap-2 rounded-[22px] border border-[#d8cab7] bg-white px-4 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              id="worker-verify-otp-btn"
              disabled={isLoading || otp.length !== 6}
              onClick={handleVerifyOtp}
              className="flex flex-1 items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] active:scale-[0.98] disabled:opacity-60"
            >
              {isLoading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <>Verify &amp; Continue <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </div>

          <button
            className="w-full text-center text-xs text-slate-400 hover:text-[#26457d] transition mt-1"
            onClick={() => {
              setStep('phone');
              setOtp('');
              setFirebaseProvider(null);
            }}
          >
            Didn&apos;t receive it? Go back and resend
          </button>
        </div>
      )}

      {/* ---- Step 3: Profile Setup ---- */}
      {step === 'profile' && (
        <div className="mt-8 space-y-4">
          <div className="rounded-[20px] bg-green-50 border border-green-200 px-4 py-2 text-xs font-bold text-green-700">
            ✅ Phone verified via Firebase! Complete your profile to get started.
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Full name</label>
            <input
              id="profile-name-input"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              placeholder="Ravi Kumar"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">City</label>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
                placeholder="Chennai"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Zone</label>
              <select
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              >
                {ZONES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Platform</label>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              >
                {PLATFORMS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Vehicle</label>
              <select
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              >
                <option>Bike</option>
                <option>Scooter</option>
                <option>EV Bike</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Weekly income</label>
            <input
              value={weeklyIncome}
              onChange={(event) => setWeeklyIncome(event.target.value)}
              type="number"
              className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              placeholder="3000"
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Vehicle number</label>
            <input
              value={vehicleNumber}
              onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())}
              className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              placeholder="TN 09 AB 1234"
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">UPI ID</label>
            <input
              value={upiId}
              onChange={(event) => setUpiId(event.target.value)}
              className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              placeholder="ravi@upi"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Bank</label>
              <input
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
                placeholder="HDFC"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">IFSC</label>
              <input
                value={ifscCode}
                onChange={(event) => setIfscCode(event.target.value.toUpperCase())}
                className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
                placeholder="HDFC0001234"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Bank account number</label>
            <input
              value={bankAccountNumber}
              onChange={(event) => setBankAccountNumber(event.target.value.replace(/\D/g, ''))}
              className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              placeholder="Only last four are shown later"
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Emergency contact</label>
            <input
              value={emergencyContact}
              onChange={(event) => setEmergencyContact(normalizePhone(event.target.value))}
              className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
              placeholder="Family phone number"
            />
          </div>
          <button
            id="worker-register-btn"
            disabled={isLoading}
            onClick={handleRegister}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] active:scale-[0.98] disabled:opacity-60"
          >
            {isLoading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <>Create worker account <ArrowRight className="h-4 w-4" /></>
            }
          </button>
        </div>
      )}
    </>
  );

  // ------------------------------------------------------------------
  // Full page render
  // ------------------------------------------------------------------
  return (
    <div className={`theme-${theme} min-h-screen px-4 py-8 ${
      theme === 'dark'
        ? 'bg-[radial-gradient(circle_at_top,#341108_0%,#160804_45%,#040404_100%)] text-[#fff5e6]'
        : 'bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6f1e7_58%,#efe5d5_100%)] text-slate-900'
    }`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center gap-10">

        {/* Left panel — visible on large screens */}
        <div className="hidden max-w-md lg:block">
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.25em] shadow-sm backdrop-blur ${
            theme === 'dark'
              ? 'border border-[#6b2a15] bg-black/25 text-[#ffd27a]'
              : 'border border-[#e9e0d3] bg-white/70 text-[#26457d]'
          }`}>
            <ShieldCheck className="h-4 w-4" />
            Worker-first onboarding
          </div>
          <h1 className={`mt-6 text-6xl font-bold leading-none ${theme === 'dark' ? 'text-[#fff2db]' : 'text-slate-900'}`}>Simple enough for the road.</h1>
          <p className={`mt-5 text-lg font-medium leading-8 ${theme === 'dark' ? 'text-[#f4cab3]' : 'text-slate-600'}`}>
            Firebase Phone Auth delivers OTPs with military-grade reliability. Low-friction onboarding straight to policy, claims, and wallet payout history.
          </p>
          <div className={`mt-6 flex items-center gap-3 rounded-2xl px-5 py-4 ${
            theme === 'dark'
              ? 'border border-[#5a2312] bg-[linear-gradient(135deg,rgba(255,106,0,0.14),rgba(242,182,61,0.08))]'
              : 'bg-orange-50 border border-orange-100'
          }`}>
            <Flame className={`h-8 w-8 flex-shrink-0 ${theme === 'dark' ? 'text-[#ff9d2e]' : 'text-orange-400'}`} />
            <div>
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-[#ffd27a]' : 'text-orange-800'}`}>Firebase Phone Auth</p>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-[#f0b47d]' : 'text-orange-600'}`}>OTPs delivered by Google's infrastructure. No SMS gateway config needed.</p>
            </div>
          </div>
        </div>

        {/* Right panel — auth card */}
        <div className={`relative w-full max-w-[410px] rounded-[38px] p-5 shadow-[0_30px_80px_rgba(73,58,32,0.16)] backdrop-blur ${
          theme === 'dark'
            ? 'border border-[#5a2312] bg-[rgba(14,7,5,0.92)]'
            : 'border border-white/70 bg-[#fbf7ef]/95'
        }`}>
          <button
            onClick={onToggleTheme}
            className={`absolute right-5 top-5 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition ${
              theme === 'dark'
                ? 'border-[#ffb347]/40 bg-[#180b08] text-[#ffd27a] hover:bg-[#21100b]'
                : 'border-[#e2d8ca] bg-white/75 text-[#26457d] hover:bg-white'
            }`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <div className={`mx-auto mb-5 h-1.5 w-20 rounded-full ${theme === 'dark' ? 'bg-[#5a2312]' : 'bg-[#e5dccb]'}`} />

          <div className={`rounded-[30px] p-6 shadow-[0_18px_40px_rgba(128,108,73,0.12)] ${
            theme === 'dark'
              ? 'border border-[#3d1a11] bg-[linear-gradient(180deg,rgba(38,13,8,0.96),rgba(15,8,6,0.92))]'
              : 'border border-[#efe4d4] bg-white/75'
          }`}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-slate-900">Gig-I</p>
                <p className="text-sm text-slate-500">Income protection for delivery partners</p>
              </div>
              <button
                id="toggle-mode-btn"
                onClick={() => {
                  setMode(mode === 'worker' ? 'admin' : 'worker');
                  setStep('phone');
                  setErrorMessage('');
                  setFirebaseProvider(null);
                  setOtp('');
                }}
                className="rounded-2xl border border-[#d8cab7] bg-[#fff9f2] px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-[#f0e8d8] transition"
              >
                {mode === 'worker' ? 'Admin' : 'Worker'}
              </button>
            </div>

            {mode === 'worker' ? workerBody : (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#26457d]">Admin access</p>
                <h2 className="mt-2 text-5xl font-bold text-slate-900">Underwriter login</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">Enter credentials, request an admin OTP, then review held claims.</p>
                <div className="mt-8 space-y-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Username</label>
                    <input
                      id="admin-username-input"
                      value={adminUsername}
                      onChange={(event) => setAdminUsername(event.target.value)}
                      className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Password</label>
                    <input
                      id="admin-password-input"
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm"
                    />
                  </div>

                  {/* Firebase test number info — visible before OTP is requested */}
                  {!adminOtpMeta && (
                    <div className="flex items-center gap-3 rounded-[16px] border border-blue-200 bg-blue-50 px-4 py-3">
                      <span className="text-blue-400 text-base">📱</span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-700">Firebase test number</p>
                        <p className="text-sm font-bold text-blue-900">+91 95735 87724</p>
                        <p className="text-[10px] text-blue-500 mt-0.5">OTP will be auto-filled after clicking Send</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Admin OTP</label>
                    <input
                      id="admin-otp-input"
                      value={adminOtp}
                      onChange={(event) => setAdminOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Click 'Send Admin OTP' first"
                      className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none shadow-sm tracking-[0.4em] placeholder:tracking-normal"
                    />
                    {adminOtpMeta?.demoOtp ? (
                      <div className="mt-2 flex items-center gap-3 rounded-[16px] border-2 border-amber-400 bg-amber-50 px-4 py-3">
                        <span className="text-amber-500 text-lg">🔑</span>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Firebase OTP — auto-filled</p>
                          <p className="text-xl font-black tracking-[0.4em] text-amber-900">{adminOtpMeta.demoOtp}</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">Sent to +91 {adminOtpMeta.phoneMasked}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    id="admin-send-otp-btn"
                    disabled={isLoading}
                    onClick={handleAdminSendOtp}
                    className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-[#d8cab7] bg-white px-4 py-4 text-sm font-bold text-slate-700 transition hover:bg-[#faf4ea] disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : '📲 Send Admin OTP'}
                  </button>
                  <button
                    id="admin-login-btn"
                    disabled={isLoading || !adminOtpMeta}
                    onClick={handleAdminLogin}
                    className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white transition hover:bg-[#1f3967] disabled:opacity-60"
                  >
                    {isLoading
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : <>Enter admin console <ArrowRight className="h-4 w-4" /></>
                    }
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
