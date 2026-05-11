'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';

interface VehicleSummary {
  key: string; vin: string; plate: string; vehicleName: string;
  customerName: string; customerPhone: string; customerId: number | null;
  orderCount: number; totalSpent: number; lastServiceDate: string; lastStatus: string;
}

const STATUS_COLORS: Record<string, string> = {
  created:       'bg-blue-100 text-blue-700',
  in_progress:   'bg-amber-100 text-amber-700',
  waiting_parts: 'bg-orange-100 text-orange-700',
  ready:         'bg-emerald-100 text-emerald-700',
  completed:     'bg-slate-100 text-slate-500',
  invoiced:      'bg-purple-100 text-purple-700',
};

export default function VehicleHistoryPage() {
  const router = useRouter();
  const t = useTranslations('service');

  const [vehicles, setVehicles]   = useState<VehicleSummary[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState('');
  const [query,    setQuery]      = useState('');

  const load = useCallback(async (q: string) => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setLoading(true);
    try {
      const url = `/api/service/vehicles?dealershipId=${encodeURIComponent(dealershipId)}${q ? `&search=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json() as { vehicles: VehicleSummary[] };
        setVehicles(json.vehicles ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    load('');
  }, [router, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search);
    load(search);
  }

  function clearSearch() {
    setSearch(''); setQuery('');
    load('');
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa] dark:bg-slate-900">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>›</span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">{t('vehicles.title')}</span>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524] dark:text-white">{t('vehicles.title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('vehicles.subtitle')}</p>
            </div>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mt-5 flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value.toUpperCase())}
                placeholder={t('vehicles.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white dark:bg-slate-700 dark:text-white font-mono tracking-wide"
              />
              {search && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>
              )}
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55a1f] transition-colors"
            >
              {t('vehicles.searchBtn')}
            </button>
          </form>
        </div>

        {/* Stats strip */}
        <div className="px-5 md:px-8 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center gap-6 text-xs text-slate-500">
          <span>{vehicles.length} {t('vehicles.totalVehicles')}</span>
          {query && <span className="bg-[#FF6B2C]/10 text-[#FF6B2C] px-2 py-0.5 rounded-md font-mono font-semibold">{query}</span>}
        </div>

        {/* Vehicle grid */}
        <div className="px-5 md:px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <div className="text-center">
                <div className="text-3xl mb-3 animate-spin">⚙️</div>
                <p className="text-sm">{t('common.loading')}</p>
              </div>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">🏍️</div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">{t('vehicles.empty')}</h3>
              <p className="text-sm text-slate-400 mt-1">{t('vehicles.emptyHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {vehicles.map(v => (
                <Link
                  key={v.key}
                  href={`/service/vehicles/${encodeURIComponent(v.key.trim())}`}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 hover:border-[#FF6B2C]/40 hover:shadow-md transition-all group"
                >
                  {/* Vehicle header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-xl shrink-0 group-hover:bg-[#FF6B2C]/20 transition-colors">
                      🏍️
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-[#FF6B2C]">
                        {v.vehicleName || t('vehicles.unknownModel')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {v.plate && (
                          <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                            {v.plate}
                          </span>
                        )}
                        {v.vin && v.vin !== v.key && (
                          <span className="text-xs text-slate-400 font-mono truncate">{v.vin.slice(-8)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                      {v.customerName ? v.customerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{v.customerName || '—'}</p>
                      {v.customerPhone && <p className="text-xs text-slate-400">{v.customerPhone}</p>}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-lg font-black text-[#FF6B2C]">{v.orderCount}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('vehicles.orders')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-800 dark:text-white">
                        {v.totalSpent > 0 ? `${v.totalSpent.toLocaleString('sv-SE')}` : '0'}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">kr {t('vehicles.spent')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {new Date(v.lastServiceDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('vehicles.lastService')}</p>
                    </div>
                  </div>

                  {/* Last status */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${STATUS_COLORS[v.lastStatus] ?? 'bg-slate-100 text-slate-500'}`}>
                      {t(`status.${v.lastStatus}` as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-xs text-[#FF6B2C] font-semibold group-hover:underline">
                      {t('vehicles.viewHistory')} →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
