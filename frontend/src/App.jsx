import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AuthView from './components/AuthView';
import AppLayout from './components/AppLayout';
import Dashboard from './components/Dashboard';
import PolicyView from './components/PolicyView';
import WalletView from './components/WalletView';
import DevPanel from './components/DevPanel';
import LandingPage from './components/landing/LandingPage';
import AdminDashboard from './components/AdminDashboard'; // Import Admin Dashboard

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [dashboard, setDashboard] = useState(null);
  const [quote, setQuote] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [godModeVisible, setGodModeVisible] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  
  // App-Wide Toast Notification State
  const [toastMessage, setToastMessage] = useState(null);

  const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (!token) return;
    
    if (token === 'admin-token') {
        const interval = setInterval(() => {
             // Admin has its own polling logic within AdminDashboard.jsx
        }, 4000);
        return () => clearInterval(interval);
    }
    
    // Phase 2 requires an integer user ID. If an old JWT exists, clear it.
    if (isNaN(parseInt(token))) {
        localStorage.removeItem('token');
        setToken(null);
        return;
    }

    pollDashboard();
    const interval = setInterval(pollDashboard, 4000);
    
    const handleKeyDown = (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'G') setGodModeVisible(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => { clearInterval(interval); window.removeEventListener('keydown', handleKeyDown); };
  }, [token]);

  const pollDashboard = async () => {
    if (token === 'admin-token') return;
    try {
      // Assuming token is user_id for Phase 2 hackathon simplifcation
      const res = await axios.get(`${API_BASE}/user/${token}/dashboard`, getHeaders());
      setDashboard(res.data);
    } catch(err) {
      if (err.response?.status === 401 || err.response?.status === 422) {
        setToken(null);
        localStorage.removeItem('token');
      } else {
        console.error("Dashboard Poll Failed! Backend might be down:", err.message);
      }
    }
  };

  const handleGetQuote = async () => {
    try {
      const res = await axios.get(`${API_BASE}/quote/${token}`, getHeaders());
      setQuote(res.data);
    } catch (err) { console.error(err); }
  };

  const handleBuyCoverage = async () => {
    try {
      await axios.post(`${API_BASE}/policy/create`, { user_id: parseInt(token), premium_amount: quote.mock_premium }, getHeaders());
      setQuote(null);
      pollDashboard();
      setActiveTab('dashboard');
      showToast("✅ Policy successfully mapped & activated via parametric engine.");
    } catch (err) { console.error(err); }
  };

  const handleTriggerWebhook = async (type, amount, zone) => {
    try {
      const res = await axios.post(`${API_BASE}/simulate-event`, { zone, event_type: type, amount_per_claim: amount }, getHeaders());
      showToast(`⚠️ Simulated Event Triggered: ${res.data.message}`);
      pollDashboard();
    } catch(err) { console.error(err); }
  };

  const handleWithdrawal = async () => {
    showToast("✅ Success! Funds transferred to linked UPI via Mock Gateway.");
  };

  if (!token) {
      if (showAuth) {
        return <AuthView onLoginSuccess={(t) => { setToken(t); setShowAuth(false); }} />;
      } else {
        return <LandingPage onLoginClick={() => setShowAuth(true)} />;
      }
  }

  if (token === 'admin-token') {
      return (
         <div className="min-h-screen bg-slate-950 p-6 md:p-10 font-sans relative">
            <button onClick={() => { localStorage.removeItem('token'); setToken(null); }} className="absolute top-6 right-6 text-[10px] font-black tracking-widest text-white/50 hover:text-white bg-white/10 px-4 py-2 rounded uppercase transition">Exit Admin</button>
            <h1 className="text-white text-3xl font-black mb-6 tracking-tight border-b border-slate-800 pb-4">GLOBAL COMMAND <span className="text-blue-500">//</span> GIG-I PLATFORM</h1>
            <AdminDashboard />
         </div>
      );
  }

  if (!dashboard) return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4 bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-blue-50">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold tracking-tight text-sm uppercase">Loading Secure Ledger...</p>
          </div>
      </div>
  );

  return (
    <>
      <AppLayout activeTab={activeTab} setActiveTab={setActiveTab} isCovered={!!dashboard.active_policy} user={dashboard.user_meta}>
        {activeTab === 'dashboard' && <Dashboard user={dashboard.user_meta} activePolicy={dashboard.active_policy} claims={dashboard.claims} setActiveTab={setActiveTab} />}
        {activeTab === 'policy' && <PolicyView user={dashboard.user_meta} activePolicy={dashboard.active_policy} quote={quote} onGetQuote={handleGetQuote} onBuyCoverage={handleBuyCoverage} />}
        {activeTab === 'wallet' && <WalletView walletBalance={dashboard.wallet_balance} claims={dashboard.claims} onWithdraw={handleWithdrawal} />}
        {activeTab === 'admin' && <AdminDashboard />}
        
        {activeTab === 'profile' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-slate-800">Partner Credentials</h2>
                    <button onClick={() => { localStorage.removeItem('token'); setToken(null); }} className="text-sm font-bold text-rose-600 bg-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition border border-rose-100">Logout Session</button>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-blue-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        <img src={`https://ui-avatars.com/api/?name=${dashboard.user_meta.full_name}&background=eff6ff&color=1d4ed8&size=128`} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-white shadow-sm" />
                        <div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">{dashboard.user_meta.full_name}</h3>
                            <div className="flex flex-wrap gap-2">
                               <p className="text-blue-700 font-bold text-xs uppercase bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">{dashboard.user_meta.zone}</p>
                               <p className="text-slate-600 font-bold text-xs uppercase bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">{dashboard.user_meta.platform}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </AppLayout>
      <DevPanel isVisible={godModeVisible} toggleVisibility={() => setGodModeVisible(false)} activePolicy={dashboard.active_policy} onTriggerWebhook={handleTriggerWebhook} />
      
      {/* Global Toast Notification System */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 fade-in font-medium">
          {toastMessage}
        </div>
      )}

      {/* Persistent God Mode Button specifically optimized for Demo Videos */}
      {!godModeVisible && (
         <button onClick={() => setGodModeVisible(true)} className="fixed bottom-6 right-6 bg-slate-900 text-white font-black text-[10px] px-5 py-3 rounded-xl shadow-2xl hover:bg-slate-800 transition z-50 uppercase tracking-widest border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
           DEMO PANEL (REPLAY)
         </button>
      )}
    </>
  );
}
