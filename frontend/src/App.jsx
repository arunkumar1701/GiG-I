import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AuthView from './components/AuthView';
import AppLayout from './components/AppLayout';
import Dashboard from './components/Dashboard';
import PolicyView from './components/PolicyView';
import WalletView from './components/WalletView';
import LandingPage from './components/landing/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import ProfileView from './components/ProfileView';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const AUTH_STORAGE_KEY = 'gig-i-auth';
const THEME_STORAGE_KEY = 'gig-i-theme';
const DASHBOARD_POLL_MS = 15000;

const buildDashboardFromAuth = (authState) => {
  if (!authState?.token || authState?.isAdmin) return null;

  const user = authState.user || {};
  const weeklyIncome = Number(user.weekly_income || 3000);
  return {
    user_meta: {
      full_name: user.full_name || user.name || 'Delivery Partner',
      city: user.city || 'Chennai',
      zone: user.zone || 'Zone A',
      platform: user.platform || 'Zomato',
      weekly_income: weeklyIncome,
      vehicle_type: user.vehicle_type || 'Bike',
      vehicle_number: user.vehicle_number || null,
      phone: user.phone || null,
      plan_tier: user.plan_tier || 'Standard',
      shift_status: user.shift_status || 'Offline',
      bank_name: user.bank_name || null,
      bank_account_last4: user.bank_account_last4 || null,
      has_upi: Boolean(user.has_upi),
      emergency_contact_masked: user.emergency_contact_masked || null,
    },
    active_policy: null,
    wallet_balance: 0,
    claims: [],
    latest_fraud_risk: null,
    live_quote: {
      premium: Math.round(Math.max(weeklyIncome * 0.03, 120)),
      ml_factors: ['Estimated while live pricing refreshes'],
      lost_hours_est: 0,
      source: 'instant_estimate',
    },
    demo_pricing: null,
    is_bootstrap: true,
  };
};

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
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'light');
  const [dashboard, setDashboard] = useState(null);
  const [quote, setQuote] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const [authEntryMode, setAuthEntryMode] = useState('worker');
  const [toastMessage, setToastMessage] = useState(null);

  const token = auth?.token || null;
  const refreshToken = auth?.refreshToken || null;
  const currentUserId = auth?.userId || null;
  const isAdmin = Boolean(auth?.isAdmin);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  };

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
        {
          ...(activeToken ? { headers: { Authorization: `Bearer ${activeToken}` } } : {}),
          timeout: 8000,
        },
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

    setDashboard((currentDashboard) => currentDashboard || buildDashboardFromAuth(auth));
    pollDashboard();
    const interval = window.setInterval(pollDashboard, DASHBOARD_POLL_MS);
    return () => {
      window.clearInterval(interval);
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
      if (!quote?.premium) {
        await handleGetQuote();
      }
      await withAutoRefresh((activeToken) =>
        axios.post(
          `${API_BASE}/policy/create`,
          { user_id: currentUserId, premium_amount: quote?.premium || 0 },
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

  const handleWithdrawal = async () => {
    showToast('Funds transferred to linked UPI via sandbox payout flow.');
  };

  if (!token) {
    if (showAuth) {
      return (
        <AuthView
          theme={theme}
          onToggleTheme={toggleTheme}
          initialMode={authEntryMode}
          onLoginSuccess={(nextAuth) => {
            persistAuth(nextAuth);
            setDashboard(buildDashboardFromAuth(nextAuth));
            setShowAuth(false);
          }}
        />
      );
    }

    return (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onLoginClick={(mode = 'worker') => {
          setAuthEntryMode(mode);
          setShowAuth(true);
        }}
      />
    );
  }

  if (isAdmin) {
    return (
      <div className={`min-h-screen p-6 md:p-10 font-sans relative ${theme === 'dark' ? 'theme-dark bg-[radial-gradient(circle_at_top,#2a0e07_0%,#140804_52%,#040404_100%)] text-white' : 'theme-light bg-slate-950 text-white'}`}>
        <button
          onClick={clearAuth}
          className="absolute top-6 right-6 text-[10px] font-black tracking-widest text-white/50 hover:text-white bg-white/10 px-4 py-2 rounded uppercase transition"
        >
          Exit Admin
        </button>
        <button
          onClick={toggleTheme}
          className={`absolute top-6 right-36 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition ${
            theme === 'dark'
              ? 'border-[#ffb347]/40 bg-[#2b130d] text-[#ffd27a] hover:bg-[#35160f]'
              : 'border-white/10 bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
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
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'theme-dark bg-[radial-gradient(circle_at_top,#2a0e07_0%,#140804_52%,#040404_100%)]' : 'theme-light bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6f1e7_58%,#efe5d5_100%)]'}`}>
        <div className={`flex flex-col items-center gap-4 rounded-[32px] p-10 shadow-[0_20px_50px_rgba(73,58,32,0.12)] ${theme === 'dark' ? 'border border-[#5d2412] bg-[#160d0a] text-[#f7e7cb]' : 'border border-[#eadfcd] bg-[#fffaf2]'}`}>
          <div className={`h-10 w-10 rounded-full border-4 border-t-transparent animate-spin ${theme === 'dark' ? 'border-[#ff9d2e]' : 'border-[#26457d]'}`}></div>
          <p className={`text-sm font-bold uppercase tracking-[0.24em] ${theme === 'dark' ? 'text-[#f3c56c]' : 'text-slate-500'}`}>Loading worker wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppLayout
        theme={theme}
        onToggleTheme={toggleTheme}
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
            walletBalance={dashboard.wallet_balance}
            liveQuote={dashboard.live_quote}
            setActiveTab={setActiveTab}
            apiBase={API_BASE}
            authToken={token}
            currentUserId={currentUserId}
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
          <ProfileView
            user={dashboard.user_meta}
            apiBase={API_BASE}
            authToken={token}
            currentUserId={currentUserId}
            onLogout={clearAuth}
            onSaved={async () => {
              setQuote(null);
              await pollDashboard();
              showToast('Profile saved. Your next weekly quote is refreshed.');
            }}
          />
        )}
      </AppLayout>

      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 fade-in font-medium">
          {toastMessage}
        </div>
      )}
    </>
  );
}
