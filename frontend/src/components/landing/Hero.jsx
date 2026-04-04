import React from 'react';

export default function Hero({ onGetQuote }) {
  return (
    <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 bg-slate-50 overflow-hidden border-b border-slate-200">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white opacity-80"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
        
        <div className="lg:w-1/2 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200 mx-auto lg:mx-0">
             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
             <span className="text-[10px] font-bold uppercase tracking-widest">Active Protection Available</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Uninterrupted <span className="text-blue-700">Earnings.</span> Guaranteed.
          </h1>
          <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
            India’s first AI-powered income protection for delivery partners. When the weather stops, or the app goes down, your earnings don't.
          </p>
        </div>

        <div className="lg:w-1/2 w-full max-w-md mx-auto lg:mx-0 shadow-2xl">
           <div className="bg-white rounded-3xl p-8 border border-slate-100 h-full">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Secure Your Week in Seconds</h3>
              <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onGetQuote(); }}>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Mobile Number</label>
                    <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition">
                       <span className="bg-slate-100 px-4 py-4 text-slate-500 font-semibold border-r border-slate-200">+91</span>
                       <input type="tel" placeholder="98765 43210" className="w-full bg-transparent p-4 outline-none font-semibold text-slate-900" required />
                    </div>
                 </div>
                 
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Primary App</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900 transition">
                       <option value="zomato">Zomato</option>
                       <option value="swiggy">Swiggy</option>
                       <option value="zepto">Zepto</option>
                    </select>
                 </div>

                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Base Zone</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900 transition">
                       <option value="blr_kora">Koramangala, Bengaluru</option>
                       <option value="del_south">South Delhi</option>
                       <option value="mum_cp">Connaught Place, Mumbai</option>
                    </select>
                 </div>

                 <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg transition active:scale-[0.98] mt-4">
                    Calculate Weekly Premium
                 </button>
              </form>
           </div>
        </div>

      </div>
    </section>
  );
}
