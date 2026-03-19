'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';

interface DealerRow {
  id:          string;
  name:        string | null;
  org_nr:      string | null;
  email:       string | null;
  phone:       string | null;
  city:        string | null;
  created_at:  string;
  staff_count: number;
  last_login:  string | null;
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const [dealers, setDealers]   = useState<DealerRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState('');

  // Guard: only platform_admin can access this page
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    if (user?.role !== 'platform_admin') {
      router.replace('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const sb = getSupabaseBrowser() as any;

      // Load all dealership settings rows (one per dealer)
      const { data: settings } = await sb
        .from('dealership_settings')
        .select('dealership_id, name, org_nr, email, phone, city, created_at')
        .order('created_at', { ascending: false });

      if (!settings || settings.length === 0) {
        setDealers([]);
        setLoading(false);
        return;
      }

      // For each dealership, count staff and get most recent login
      const rows: DealerRow[] = await Promise.all(
        settings.map(async (s: any) => {
          const { count } = await sb
            .from('staff_users')
            .select('id', { count: 'exact', head: true })
            .eq('dealership_id', s.dealership_id);

          const { data: latest } = await sb
            .from('staff_users')
            .select('last_login')
            .eq('dealership_id', s.dealership_id)
            .order('last_login', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id:          s.dealership_id,
            name:        s.name        ?? 'Unnamed Dealership',
            org_nr:      s.org_nr      ?? null,
            email:       s.email       ?? null,
            phone:       s.phone       ?? null,
            city:        s.city        ?? null,
            created_at:  s.created_at,
            staff_count: count ?? 0,
            last_login:  latest?.last_login ?? null,
          };
        }),
      );

      setDealers(rows);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = dealers.filter(d =>
    !search ||
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.city?.toLowerCase().includes(search.toLowerCase()) ||
    d.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('sv-SE');
  };

  const totalStaff = dealers.reduce((s, d) => s + d.staff_count, 0);

  return (
    <div className="flex h-screen bg-[#f5f7fa] overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 overflow-y-auto">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🌐</span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Platform Admin</h1>
              <span className="px-2 py-0.5 bg-[#FF6B2C]/10 text-[#FF6B2C] text-xs font-bold rounded-full border border-[#FF6B2C]/20">
                bikeme.now
              </span>
            </div>
            <p className="text-slate-500 text-sm ml-12">
              All dealerships registered on the BikeMeNow platform
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Dealers',  value: dealers.length,                  icon: '🏢' },
              { label: 'Total Staff',    value: totalStaff,                       icon: '👥' },
              { label: 'Active Today',   value: dealers.filter(d => {
                  if (!d.last_login) return false;
                  return new Date(d.last_login) > new Date(Date.now() - 86_400_000);
                }).length,                                                         icon: '🟢' },
              { label: 'New This Month', value: dealers.filter(d => {
                  return new Date(d.created_at) > new Date(new Date().setDate(1));
                }).length,                                                         icon: '✨' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="text-2xl mb-1">{card.icon}</div>
                <div className="text-2xl font-bold text-slate-900">{card.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search dealerships by name, city or email…"
              className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/30"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <div className="text-4xl mb-3">🏢</div>
                <p className="font-medium">No dealerships found</p>
                <p className="text-sm mt-1">Dealers appear here after signing up</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Dealership', 'City', 'Contact', 'Staff', 'Last Active', 'Registered'].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => (
                    <tr
                      key={d.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i === filtered.length - 1 ? 'border-none' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#FF6B2C]/10 flex items-center justify-center text-[#FF6B2C] font-bold text-sm shrink-0">
                            {(d.name ?? 'D')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{d.name}</p>
                            {d.org_nr && <p className="text-xs text-slate-400">{d.org_nr}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{d.city ?? '—'}</td>
                      <td className="px-5 py-4">
                        <p className="text-slate-600">{d.email ?? '—'}</p>
                        {d.phone && <p className="text-xs text-slate-400">{d.phone}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                          👥 {d.staff_count}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{fmtDate(d.last_login)}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            bikeme.now · Platform Admin · {dealers.length} dealership{dealers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </main>
    </div>
  );
}
