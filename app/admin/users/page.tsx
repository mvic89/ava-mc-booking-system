'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

interface AdminUser {
  id:         string;
  name:       string;
  email:      string;
  status:     string;
  last_login: string | null;
  created_at: string;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('sv-SE') : '—';

export default function SystemAdminsPage() {
  const router = useRouter();
  const [admins,   setAdmins]   = useState<AdminUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    if (user?.role !== 'platform_admin') router.replace('/dashboard');
  }, [router]);

  const load = async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/users');
    const data = await res.json();
    setAdmins(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error ?? 'Failed to add admin'); return; }
      toast.success(`${form.name} added as system admin`);
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (admin: AdminUser) => {
    if (!confirm(`Deactivate ${admin.name}? They will no longer be able to log in.`)) return;
    const res  = await fetch(`/api/admin/users?id=${admin.id}`, { method: 'DELETE' });
    const body = await res.json();
    if (!res.ok) { toast.error(body.error ?? 'Failed to deactivate'); return; }
    toast.success(`${admin.name} deactivated`);
    load();
  };

  return (
    <div className="flex h-screen bg-[#f5f7fa] overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 overflow-y-auto">
        <div className="p-6 md:p-10 max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🔐</span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">System Admins</h1>
              <span className="px-2 py-0.5 bg-[#FF6B2C]/10 text-[#FF6B2C] text-xs font-bold rounded-full border border-[#FF6B2C]/20">
                platform_admin
              </span>
            </div>
            <p className="text-slate-500 text-sm ml-12">
              These accounts have full platform access across all dealerships
            </p>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-slate-500">
              {admins.filter(a => a.status === 'active').length} active administrator{admins.filter(a => a.status === 'active').length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              <span className="text-base leading-none">+</span>
              Add Admin
            </button>
          </div>

          {/* Add admin form */}
          {showForm && (
            <form
              onSubmit={handleAdd}
              className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm"
            >
              <h3 className="font-semibold text-slate-800 mb-4">New System Administrator</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jane@bikeme.now"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Temporary Password</label>
                  <div className="relative">
                    <input
                      required
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 8 characters"
                      minLength={8}
                      className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                    >
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-all"
                >
                  {saving ? 'Adding…' : 'Add Administrator'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm({ name: '', email: '', password: '' }); }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <div className="text-4xl mb-3">🔐</div>
                <p className="font-medium">No system admins found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Administrator', 'Email', 'Status', 'Last Login', 'Added', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a, i) => (
                    <tr key={a.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i === admins.length - 1 ? 'border-none' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF6B2C]/10 flex items-center justify-center text-[#FF6B2C] font-bold text-sm shrink-0">
                            {a.name[0]?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{a.email}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          a.status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                          {a.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{fmtDate(a.last_login)}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{fmtDate(a.created_at)}</td>
                      <td className="px-5 py-4">
                        {a.status === 'active' && (
                          <button
                            onClick={() => handleDeactivate(a)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
