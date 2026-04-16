import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AuthView from './components/AuthView';
import AppLayout from './components/AppLayout';
import Dashboard from './components/Dashboard';
import PolicyView from './components/PolicyView';
import WalletView from './components/WalletView';
import DevPanel from './components/DevPanel';
import LandingPage from './components/landing/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import Simulator from './components/Simulator';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const AUTH_STORAGE_KEY = 'gig-i-auth';

const loadStoredAuth = () => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }
  return null;
};

export default function App() {
  const [auth, setAuth] = useState(() => loadStoredAuth());
  const [dashboard, setDashboard] = useState(null);
  const [quote, setQuote] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [godModeVisible, setGodModeVisible] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authEntryMode, setAuthEntryMode] = useState('worker');
  const [toastMessage, setToastMessage] = useState(null);

  const token = auth?.token || null;
  const refreshToken = auth?.refreshToken || null;
  const currentUserId = auth?.userId || null;
  const isAdmin = Boolean(auth?.isAdmin);

  const persistAuth = (nextAuth) => {
    if (nextAuth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
      if (nextAuth.token) {
        localStorage.setItem('token', nextAuth.token);
      }
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('token');
    }
    setAuth(nextAuth);
  };

  const clearAuth = () => {
    persistAuth(null);
    setDashboard(null);
    setQuote(null);
    setActiveTab('dashboard');
    setGodModeVisible(false);
  };

  const getHeaders = () => (
    token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {}
  );

  const refreshSession = async () => {
    if (!refreshToken) return null;
    const res = await axios.post(`${API_BASE}/token/refresh`, { refresh_token: refreshToken });
    const nextAuth = {
      ...auth,
      token: res.data.access_token,
      refreshToken: res.data.refresh_token,
      userId: res.data.user_id,
      user: res.data.user,
    };
    persistAuth(nextAuth);
    return nextAuth;
  };

  const withAutoRefresh = async (requestFactory) => {
    try {
      return await requestFactory(token);
    } catch (error) {
      if (error.response?.status === 401 && refreshToken) {
        const nextAuth = await refreshSession();
        if (!nextAuth) throw error;
        return await requestFactory(nextAuth.token);
      }
      throw error;
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    window.clearTimeout(window.__gigIToastTimer);
    window.__gigIToastTimer = window.setTimeout(() => setToastMessage(null), 4000);
  };

  const pollDashboard = async () => {
    if (!token || !currentUserId || isAdmin) return;

    try {
      const res = await withAutoRefresh((activeToken) => axios.get(
        `${API_BASE}/user/${currentUserId}/dashboard`,
        activeToken ? { headers: { Authorization: `Bearer ${activeToken}` } } : {},
      ));
      setDashboard(res.data);
    } catch (error) {
      if ([401, 403, 422].includes(error.response?.status)) {
        clearAuth();
      } else {
        console.error('Dashboard poll failed:', error.message);
      }
    }
  };

  useEffect(() => {
    if (!token) return undefined;
    if (isAdmin) return undefined;
    if (!currentUserId) {
      clearAuth();
      return undefined;
    }

    pollDashboard();
    const interval = window.setInterval(pollDashboard, 4000);
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'G') {
        setGodModeVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [token, currentUserId, isAdmin]);

  const handleGetQuote = async () => {
    try {
      const res = await withAutoRefresh((activeToken) =>
        axios.get(`${API_BASE}/quote/${currentUserId}`, activeToken ? { headers: { Authorization: `Bearer ${activeToken}` } } : {}),
      );
      setQuote(res.data);
    } catch (error) {
      console.error(error);
      showToast('Unable to fetch quote right now.');
    }
  };

  const handleBuyCoverage = async () => {
    try {
      await withAutoRefresh((activeToken) =>
        axios.post(
          `${API_BASE}/policy/create`,
          { user_id: currentUserId, premium_amount: quote.premium },
          activeToken ? { headers: { Authorization: `Bearer ${activeToken}` } } : {},
        ),
      );
      setQuote(null);
      await pollDashboard();
      setActiveTab('dashboard');
      showToast('Policy successfully activated.');
    } catch (error) {
      console.error(error);
      showToast('Policy purchase failed.');
    }
  };

  const handleTriggerWebhook = async (type, amount, zone, location) => {
    try {
      const res = await withAutoRefresh((activeToken) =>
        axios.post(
          `${API_BASE}/simulate-event`,
          {
            zone,
            eventType: type,
            amountPerClaim: amount,
            driverId: currentUserId,
            location,
          },
          activeToken ? { headers: { Authorization: `Bearer ${activeToken}` } } : {},
        ),
      );
      showToast(`Simulated event triggered: ${res.data.message}`);
      await pollDashboard();
    } catch (error) {
      console.error(error);
      showToast('Simulation failed.');
    }
  };

  const handleWithdrawal = async () => {
    showToast('Funds transferred to linked UPI via sandbox payout flow.');
  };

  if (!token) {
    if (showAuth) {
      return (
        <AuthView
          initialMode={authEntryMode}
          onLoginSuccess={(nextAuth) => {
            persistAuth(nextAuth);
            setShowAuth(false);
          }}
        />
      );
    }

    return <LandingPage onLoginClick={(mode = 'worker') => {
      setAuthEntryMode(mode);
      setShowAuth(true);
    }} />;
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 md:p-10 font-sans relative">
        <button
          onClick={clearAuth}
          className="absolute top-6 right-6 text-[10px] font-black tracking-widest text-white/50 hover:text-white bg-white/10 px-4 py-2 rounded uppercase transition"
        >
          Exit Admin
        </button>
        <h1 className="text-white text-3xl font-black mb-6 tracking-tight border-b border-slate-800 pb-4">
          GLOBAL COMMAND <span className="text-blue-500">//</span> GIG-I PLATFORM
        </h1>
        <AdminDashboard apiBase={API_BASE} authToken={token} />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6f1e7_58%,#efe5d5_100%)]">
        <div className="flex flex-col items-center gap-4 rounded-[32px] border border-[#eadfcd] bg-[#fffaf2] p-10 shadow-[0_20px_50px_rgba(73,58,32,0.12)]">
          <div className="h-10 w-10 rounded-full border-4 border-[#26457d] border-t-transparent animate-spin"></div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">Loading worker wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCovered={!!dashboard.active_policy}
        user={dashboard.user_meta}
        isAdmin={false}
      >
        {activeTab === 'dashboard' && (
          <Dashboard
            user={dashboard.user_meta}
            activePolicy={dashboard.active_policy}
            claims={dashboard.claims}
            setActiveTab={setActiveTab}
            apiBase={API_BASE}
            authToken={token}
          />
        )}
        {activeTab === 'policy' && (
          <PolicyView
            user={dashboard.user_meta}
            activePolicy={dashboard.active_policy}
            quote={quote}
            onGetQuote={handleGetQuote}
            onBuyCoverage={handleBuyCoverage}
            apiBase={API_BASE}
            authToken={token}
            currentUserId={currentUserId}
          />
        )}
        {activeTab === 'simulate' && (
          <Simulator
            user={dashboard.user_meta}
            activePolicy={dashboard.active_policy}
            apiBase={API_BASE}
            authToken={token}
            currentUserId={currentUserId}
            onSimulationComplete={pollDashboard}
            showToast={showToast}
          />
        )}
        {activeTab === 'wallet' && (
          <WalletView
            user={dashboard.user_meta}
            currentUserId={currentUserId}
            walletBalance={dashboard.wallet_balance}
            claims={dashboard.claims}
            onWithdraw={handleWithdrawal}
          />
        )}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-bold text-slate-900">Worker Profile</h2>
              <button
                onClick={clearAuth}
                className="rounded-2xl border border-[#dccfc0] bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-[#faf4ea]"
              >
                Logout Session
              </button>
            </div>

            <div className="rounded-[30px] border border-[#e8dfd0] bg-[#fffaf4] p-6 shadow-[0_16px_40px_rgba(73,58,32,0.10)]">
              <div className="flex items-start gap-5">
                <img
                  src={`https://ui-avatars.com/api/?name=${dashboard.user_meta.full_name}&background=eff6ff&color=1d4ed8&size=128`}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full border-4 border-white shadow-sm"
                />
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{dashboard.user_meta.full_name}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <p className="rounded-xl border border-[#d7d0c7] bg-white px-3 py-1.5 text-xs font-bold uppercase text-slate-700">
                      {dashboard.user_meta.zone}
                    </p>
                    <p className="rounded-xl border border-[#d7d0c7] bg-white px-3 py-1.5 text-xs font-bold uppercase text-slate-700">
                      {dashboard.user_meta.platform}
                    </p>
                    <p className="rounded-xl border border-[#d7d0c7] bg-white px-3 py-1.5 text-xs font-bold uppercase text-slate-700">
                      {dashboard.user_meta.vehicle_type}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Phone</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{dashboard.user_meta.phone || 'Not shared'}</p>
                </div>
                <div className="rounded-2xl border border-[#eadfcd] bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Weekly Earnings</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">INR {dashboard.user_meta.weekly_income}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AppLayout>

      <DevPanel
        isVisible={godModeVisible}
        toggleVisibility={() => setGodModeVisible(false)}
        activePolicy={dashboard.active_policy}
        onTriggerWebhook={handleTriggerWebhook}
      />

      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 fade-in font-medium">
          {toastMessage}
        </div>
      )}

      {!godModeVisible && (
        <button
          onClick={() => setGodModeVisible(true)}
          className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[#d6c8b6] bg-white/90 px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-700 shadow-[0_10px_30px_rgba(73,58,32,0.18)] transition hover:bg-[#faf4ea]"
        >
          Demo Panel (Replay)
        </button>
      )}
    </>
  );
}
