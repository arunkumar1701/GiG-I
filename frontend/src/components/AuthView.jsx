import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function AuthView({ onLoginSuccess }) {
  const [step, setStep] = useState('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('Zone A');
  const [platform, setPlatform] = useState('Zomato');
  const [weeklyIncome, setWeeklyIncome] = useState(3000);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (mobileNumber.length < 10) return alert("Please enter a valid 10-digit mobile number.");
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setStep('otp');
    setIsLoading(false);
  };

  const handleVerifyOtp = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    try {
      const payload = {
          name: fullName || "Delivery Partner",
          city: city || "Bengaluru",
          zone: zone,
          platform: platform,
          weekly_income: parseFloat(weeklyIncome) || 3000
      };
      // In a real app auth might be different. Let's register user
      const res = await axios.post("http://127.0.0.1:8000/register", payload);
      // For demo, the token is simply the user ID
      const token = res.data.id.toString();
      localStorage.setItem('token', token);
      onLoginSuccess(token);
    } catch (e) { 
      console.error(e);
      alert("Registration failed. Please check backend."); 
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-slate-50 bg-slate-950 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-fuchsia-600/20 blur-[120px] pointer-events-none"></div>

      <div className="hidden lg:flex w-1/2 bg-black/40 backdrop-blur-3xl text-slate-200 flex-col justify-center px-16 relative overflow-hidden border-r border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.5)] z-10">
         <ShieldCheck className="w-16 h-16 text-cyan-400 mb-8 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
         <h1 className="text-5xl font-black tracking-tight mb-4 leading-tight text-white drop-shadow-xl">Gig-I Protection.<br/>Zero Claims.</h1>
         <p className="text-slate-400 font-medium text-lg max-w-md line-clamp-3">
            Secure your income against extreme weather, gridlock, and app outages with AI-priced parametric insurance designed exclusively for gig delivery partners.
         </p>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-transparent relative overflow-y-auto max-h-screen py-12 z-10">
        <div className="max-w-md w-full space-y-8 bg-slate-900/60 backdrop-blur-2xl p-8 md:p-10 rounded-3xl shadow-[0_8px_40px_rgb(0,0,0,0.3)] border border-white/10">
          <div>
             <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-md">Get Covered</h2>
             <p className="text-slate-400 mt-2 text-sm font-medium">Sign in and set up your coverage parameters.</p>
          </div>
          <div className="space-y-4">
            <div>
               <label className="text-xs font-bold uppercase tracking-widest text-cyan-400">Mobile Number</label>
               <input type="tel" value={mobileNumber} disabled={step==='otp'} onChange={e => setMobileNumber(e.target.value)} placeholder="e.g. 98765 43210" className="w-full mt-2 p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-semibold text-white disabled:opacity-50 placeholder-slate-600 shadow-inner" />
            </div>
            {step === 'otp' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
                 <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Ramesh K." className="w-full mt-1 p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-semibold text-white placeholder-slate-600 shadow-inner" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">City</label>
                        <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Bengaluru" className="w-full mt-1 p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-semibold text-white placeholder-slate-600 shadow-inner" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Zone</label>
                        <select value={zone} onChange={e => setZone(e.target.value)} className="w-full mt-1 p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-slate-200 shadow-inner appearance-none">
                           <option className="bg-slate-900">Zone A</option>
                           <option className="bg-slate-900">Zone B</option>
                           <option className="bg-slate-900">Zone C</option>
                        </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Platform</label>
                        <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full mt-1 p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-slate-200 shadow-inner appearance-none">
                           <option className="bg-slate-900">Zomato</option>
                           <option className="bg-slate-900">Swiggy</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Weekly Income (₹)</label>
                        <input type="number" value={weeklyIncome} onChange={e => setWeeklyIncome(e.target.value)} placeholder="3000" className="w-full mt-1 p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none font-semibold text-white placeholder-slate-600 shadow-inner" />
                    </div>
                 </div>
              </div>
            )}
            <button 
              disabled={isLoading}
              onClick={step === 'phone' ? handleRequestOtp : handleVerifyOtp} 
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black p-4 rounded-xl flex items-center justify-center gap-2 mt-4 disabled:opacity-80 disabled:cursor-wait shadow-[0_0_20px_rgb(6,182,212,0.3)] transition"
            >
               {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                 <>
                   {step === 'phone' ? 'Continue' : 'Register & Enter'}
                   <ArrowRight className="w-5 h-5" />
                 </>
               )}
            </button>
            
            <div className="text-center mt-6">
                <button 
                  onClick={() => { localStorage.setItem('token', 'admin-token'); onLoginSuccess('admin-token'); }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition underline underline-offset-4"
                >
                  Access Underwriter / System Admin Portal
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
