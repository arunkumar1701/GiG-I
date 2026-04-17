import React, { useState } from 'react';
import axios from 'axios';
import { BadgeIndianRupee, Bike, Building2, Phone, Save, ShieldCheck } from 'lucide-react';

export default function ProfileView({ user, apiBase, authToken, currentUserId, onLogout, onSaved }) {
  const [form, setForm] = useState({
    city: user.city || '',
    zone: user.zone || 'Zone A',
    platform: user.platform || 'Zomato',
    weekly_income: user.weekly_income || 3000,
    vehicle_type: user.vehicle_type || 'Bike',
    vehicle_number: user.vehicle_number || '',
    bank_name: user.bank_name || '',
    bank_account_number: '',
    ifsc_code: '',
    upi_id: '',
    emergency_contact: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await axios.put(`${apiBase}/user/${currentUserId}/profile`, form, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      setMessage('Profile updated securely.');
      await onSaved?.();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.detail || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#26457d]">Partner profile</p>
          <h2 className="mt-2 text-4xl font-bold text-slate-900">Your details</h2>
          <p className="mt-2 text-sm text-slate-500">Keep payment and route details ready for real-time payouts.</p>
        </div>
        <button onClick={onLogout} className="rounded-2xl border border-[#d8cab7] bg-white px-3 py-2 text-xs font-bold text-slate-700">
          Logout
        </button>
      </div>

      <div className="rounded-[28px] bg-tata-bg p-5 shadow-neumorph-outer">
        <div className="flex items-center gap-4">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=f6ede0&color=26457d`}
            alt="Worker avatar"
            className="h-16 w-16 rounded-full border-4 border-white shadow-sm"
          />
          <div>
            <h3 className="text-3xl font-bold text-slate-900">{user.full_name}</h3>
            <p className="text-sm font-medium text-slate-500">{user.phone || 'Phone verified'} • {user.platform}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4">
            <Phone className="mb-2 h-4 w-4 text-[#26457d]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Emergency</p>
            <p className="mt-2 text-sm font-bold text-slate-900">{user.emergency_contact_masked || 'Add below'}</p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <Building2 className="mb-2 h-4 w-4 text-[#26457d]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Bank</p>
            <p className="mt-2 text-sm font-bold text-slate-900">
              {user.bank_name || 'Not set'} {user.bank_account_last4 ? `••${user.bank_account_last4}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-[28px] border border-[#eadfcd] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">City</label>
            <input value={form.city} onChange={(event) => updateField('city', event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Zone</label>
            <select value={form.zone} onChange={(event) => updateField('zone', event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none">
              <option>Zone A</option>
              <option>Zone B</option>
              <option>Zone C</option>
              <option>Zone D</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Platform</label>
            <select value={form.platform} onChange={(event) => updateField('platform', event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none">
              <option>Zomato</option>
              <option>Swiggy</option>
              <option>Blinkit</option>
              <option>Zepto</option>
              <option>Uber Eats</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Weekly earnings</label>
            <input value={form.weekly_income} onChange={(event) => updateField('weekly_income', Number(event.target.value) || 0)} type="number" min="0" className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Vehicle</label>
            <input value={form.vehicle_type} onChange={(event) => updateField('vehicle_type', event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Vehicle no.</label>
            <input value={form.vehicle_number} onChange={(event) => updateField('vehicle_number', event.target.value.toUpperCase())} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">UPI ID</label>
          <input value={form.upi_id} onChange={(event) => updateField('upi_id', event.target.value)} placeholder={user.has_upi ? 'UPI already linked' : 'name@upi'} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Bank</label>
            <input value={form.bank_name} onChange={(event) => updateField('bank_name', event.target.value)} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">IFSC</label>
            <input value={form.ifsc_code} onChange={(event) => updateField('ifsc_code', event.target.value.toUpperCase())} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Bank account</label>
          <input value={form.bank_account_number} onChange={(event) => updateField('bank_account_number', event.target.value.replace(/\D/g, ''))} placeholder={user.bank_account_last4 ? `Linked ••••${user.bank_account_last4}` : 'Account number'} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
        </div>

        <div>
          <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Emergency contact</label>
          <input value={form.emergency_contact} onChange={(event) => updateField('emergency_contact', event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder={user.emergency_contact_masked || '10-digit phone'} className="mt-2 w-full rounded-[20px] border border-[#e5d8c6] bg-[#fffaf4] px-4 py-3 text-sm font-semibold outline-none" />
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full rounded-[24px] bg-[#26457d] px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60">
          {saving ? 'Saving...' : <><Save className="mr-2 inline h-4 w-4" />Save secure profile</>}
        </button>
        {message ? <p className="text-center text-sm font-bold text-[#26457d]">{message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <Bike className="mb-2 h-4 w-4 text-[#26457d]" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Platform</p>
          <p className="mt-2 text-sm font-bold text-slate-900">{user.platform}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <BadgeIndianRupee className="mb-2 h-4 w-4 text-[#26457d]" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Weekly earnings</p>
          <p className="mt-2 text-sm font-bold text-slate-900">INR {user.weekly_income}</p>
        </div>
      </div>

      <div className="rounded-[24px] bg-[#fff8ef] p-4 text-sm font-medium text-slate-600">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-[#26457d]" />
        Sensitive payout details are stored encrypted; only masked values are shown back in the worker app.
      </div>
    </div>
  );
}
