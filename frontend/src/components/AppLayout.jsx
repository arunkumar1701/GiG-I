import React from 'react';
import {
  CreditCard,
  FileText,
  Home,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

export default function AppLayout({ children, activeTab, setActiveTab, isCovered, user, theme = 'light', onToggleTheme }) {
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'policy', icon: FileText, label: 'Policy' },
    { id: 'wallet', icon: CreditCard, label: 'Wallet' },
    { id: 'profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className={`theme-${theme} min-h-screen px-4 py-6 ${
      theme === 'dark'
        ? 'bg-[radial-gradient(circle_at_top,#341108_0%,#160804_48%,#040404_100%)] text-[#fff5e6]'
        : 'bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6f1e7_58%,#efe5d5_100%)] text-slate-900'
    }`}>
      <div className={`mx-auto max-w-[430px] rounded-[38px] p-4 shadow-[0_35px_80px_rgba(73,58,32,0.18)] backdrop-blur ${
        theme === 'dark'
          ? 'border border-[#5a2312] bg-[rgba(14,7,5,0.92)]'
          : 'border border-white/80 bg-[#fbf7ef]/95'
      }`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className={`h-1.5 w-20 rounded-full ${theme === 'dark' ? 'bg-[#5a2312]' : 'bg-[#e5dccb]'}`} />
          <button
            onClick={onToggleTheme}
            className={`rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition ${
              theme === 'dark'
                ? 'border-[#ffb347]/40 bg-[#180b08] text-[#ffd27a] hover:bg-[#21100b]'
                : 'border-[#e2d8ca] bg-white/75 text-[#26457d] hover:bg-white'
            }`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className={`overflow-hidden rounded-[30px] shadow-[0_18px_40px_rgba(128,108,73,0.12)] ${
          theme === 'dark'
            ? 'border border-[#3d1a11] bg-[linear-gradient(180deg,rgba(38,13,8,0.96),rgba(15,8,6,0.92))]'
            : 'border border-[#ede2d3] bg-[#fffaf4]'
        }`}>
          <header className="border-b border-[#f0e6d8] bg-white/75 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-[#ece1d2] bg-[#fff8ef] p-2.5 shadow-inner">
                  <ShieldCheck className="h-5 w-5 text-[#26457d]" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">Gig-I</p>
                  <p className="text-[11px] font-semibold text-slate-500">{user?.zone || 'Worker wallet'}</p>
                </div>
              </div>

              <div className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] ${
                isCovered
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {isCovered ? 'Covered' : 'Needs cover'}
              </div>
            </div>

            {user ? (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#ede2d3] bg-[#fff6ec] px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{user.full_name}</p>
                  <p className="text-xs font-medium text-slate-500">{user.platform} • {user.vehicle_type || 'Bike'}</p>
                </div>
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=f6ede0&color=26457d`}
                  alt="Worker avatar"
                  className="h-11 w-11 rounded-full border-2 border-white"
                />
              </div>
            ) : null}
          </header>

          <main className="max-h-[calc(100vh-14rem)] min-h-[600px] overflow-y-auto px-5 py-5">
            {children}
          </main>

          <nav className="grid grid-cols-4 border-t border-[#f0e6d8] bg-white/75 px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition ${
                    isActive ? 'bg-[#26457d] text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
