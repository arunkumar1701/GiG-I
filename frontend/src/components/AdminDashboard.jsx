import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle2, XCircle, Search, RefreshCcw, Terminal } from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

export default function AdminDashboard() {
  const [claims, setClaims] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClaims, resLogs] = await Promise.all([
         axios.get(`${API_BASE}/admin/dashboard`),
         axios.get(`${API_BASE}/admin/agent-logs`)
      ]);
      setClaims(resClaims?.data?.claims || []);
      setAgentLogs(resLogs?.data?.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Polling for demo
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto h-[calc(100vh-8rem)]">
      
      {/* Claims Ledger */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
           <div className="flex items-center gap-2 text-white">
              <ShieldAlert className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold tracking-widest text-sm uppercase text-slate-300">Underwriting Ledger</h3>
           </div>
           <button onClick={fetchData} className="text-slate-500 hover:text-white transition">
              <RefreshCcw className="w-4 h-4" />
           </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
           {loading && claims.length === 0 ? (
             <div className="h-full flex items-center justify-center font-bold text-slate-500">Connecting to Core System...</div>
           ) : claims.length === 0 ? (
             <div className="h-full flex items-center justify-center font-bold text-slate-600">No events simulated.</div>
           ) : (
             <div className="space-y-3">
               {claims?.map((claim) => (
                 <div key={claim.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-white font-bold text-sm tracking-wide">ID: #{claim.id} &middot; {claim.trigger_type}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">FRS1: {claim.frs1?.toFixed(3)} | FRS2: {claim.frs2?.toFixed(3) || '-'} | FRS3: {claim.frs3?.toFixed(3) || '-'}</div>
                        <p className="text-xs text-blue-400 font-medium mt-1.5">{claim.explanation}</p>
                    </div>
                    <div className="text-right">
                       {claim.status === "Approved" ? (
                          <>
                            <div className="inline-flex items-center gap-1 text-green-400 text-xs font-black uppercase tracking-widest"><CheckCircle2 className="w-3 h-3"/> Approved</div>
                            <div className="text-white font-bold mt-1">₹{claim.payout_amount}</div>
                            {claim.transaction_id && <div className="text-[9px] text-slate-500 font-mono mt-1">{claim.transaction_id}</div>}
                          </>
                       ) : (
                          <div className="inline-flex items-center gap-1 text-rose-500 text-xs font-black uppercase tracking-widest"><XCircle className="w-3 h-3"/> Rejected</div>
                       )}
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* AI Agent Realtime Terminal */}
      <div className="bg-black rounded-2xl border border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden font-mono relative">
        <div className="p-3 border-b border-slate-800 flex gap-2 items-center bg-slate-900 absolute top-0 w-full z-10">
            <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="ml-2 text-xs font-bold text-slate-400 tracking-widest uppercase flex items-center gap-2">
               <Terminal className="w-3 h-3" />
               Live Agent Logs
            </div>
            <div className="ml-auto flex items-center gap-2">
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgb(34,197,94,0.8)]"></span>
               <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Active</span>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto p-5 pt-16 custom-scrollbar text-[11px] leading-relaxed">
           {agentLogs.length === 0 ? (
               <div className="text-slate-600">Waiting for events to trigger AI Evaluation Matrix...</div>
           ) : (
              <div className="space-y-4">
                 {agentLogs?.map((log, i) => (
                    <div key={i} className="flex gap-4">
                        <div className="text-slate-600 shrink-0 w-32 whitespace-nowrap">
                           {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                        </div>
                        <div className="text-green-500 shrink-0 w-24">
                           [{log.step}]
                        </div>
                        <div className={`${log.step === 'DECISION' ? (log.log_message.includes('Reject') ? 'text-rose-400 font-bold' : 'text-blue-400 font-bold') : 'text-slate-300'}`}>
                            {log.claim_id && <span className="text-slate-500 mr-2">[Claim #{log.claim_id}]</span>}
                            {log.log_message}
                        </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </div>
      
    </div>
  );
}
