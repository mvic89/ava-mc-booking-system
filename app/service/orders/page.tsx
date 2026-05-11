'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import {
  getWorkOrders, deleteWorkOrder, type WorkOrder, type WorkOrderStatus,
  WO_STATUS_COLORS, PRIORITY_COLORS,
} from '@/lib/service';

function WorkOrdersContent() {
  const router  = useRouter();
  const params  = useSearchParams();
  const t = useTranslations('service');

  const STATUS_TABS: { key: WorkOrderStatus | 'all'; label: string }[] = [
    { key: 'all',           label: t('orders.tabs.all') },
    { key: 'created',       label: t('orders.tabs.created') },
    { key: 'in_progress',   label: t('orders.tabs.in_progress') },
    { key: 'waiting_parts', label: t('orders.tabs.waiting_parts') },
    { key: 'ready',         label: t('orders.tabs.ready') },
    { key: 'completed',     label: t('orders.tabs.completed') },
    { key: 'invoiced',      label: t('orders.tabs.invoiced') },
  ];

  const [orders,    setOrders]    = useState<WorkOrder[]>([]);
  const [ready,     setReady]     = useState(false);
  const [tab,       setTab]       = useState<WorkOrderStatus | 'all'>(
    (params.get('status') as WorkOrderStatus) || 'all'
  );
  const [search,    setSearch]    = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await deleteWorkOrder(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      setConfirmId(null);
      toast.success(`AO-${id} raderad`);
    } catch {
      toast.error('Kunde inte radera arbetsorder');
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    getWorkOrders().then(o => { setOrders(o); setReady(true); });
  }, [router]);

  const filtered = useMemo(() => {
    let list = tab === 'all' ? orders : orders.filter(o => o.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.customer_name.toLowerCase().includes(q) ||
        o.vehicle_name.toLowerCase().includes(q) ||
        o.plate.toLowerCase().includes(q) ||
        String(o.id).includes(q)
      );
    }
    return list;
  }, [orders, tab, search]);

  const woStatusLabel = (status: WorkOrder['status']) =>
    t(`status.${status}` as Parameters<typeof t>[0]);
  const priorityLabel = (p: WorkOrder['priority']) =>
    t(`priority.${p}` as Parameters<typeof t>[0]);

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('orders.title')}</span>
          </nav>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">{t('orders.title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('orders.total', { count: orders.length })}</p>
            </div>
            <Link
              href="/service/orders/new"
              className="px-4 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold transition-colors"
            >
              {t('orders.newOrder')}
            </Link>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 space-y-5">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 flex-wrap">
              {STATUS_TABS.map(t_ => (
                <button
                  key={t_.key}
                  onClick={() => setTab(t_.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    tab === t_.key ? 'bg-[#FF6B2C] text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t_.label}
                  <span className="ml-1.5 opacity-60">
                    {t_.key === 'all' ? orders.length : orders.filter(o => o.status === t_.key).length}
                  </span>
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('orders.searchPlaceholder')}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 w-60"
            />
          </div>

          {/* Orders grid */}
          {!ready ? (
            <div className="py-12 text-center text-slate-400 text-sm">{t('orders.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-slate-100">
              <p className="text-2xl mb-2">🔧</p>
              <p className="text-sm text-slate-500">{t('orders.noResults')}</p>
              <Link href="/service/orders/new" className="mt-3 inline-block text-sm text-[#FF6B2C] font-semibold hover:underline">
                {t('orders.createFirst')}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(o => (
                <div key={o.id} className="relative bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group">
                  <Link href={`/service/orders/${o.id}`} className="block p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400">AO-{o.id}</p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">{o.customer_name || '—'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 pr-6">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${WO_STATUS_COLORS[o.status]}`}>
                          {woStatusLabel(o.status)}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[o.priority]}`}>
                          {priorityLabel(o.priority)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 truncate mb-1">{o.vehicle_name || t('orders.noVehicle')}{o.plate ? ` · ${o.plate}` : ''}</p>
                    {o.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">{o.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div>
                        <p className="text-[10px] text-slate-400">{t('orders.card.technician')}</p>
                        <p className="text-xs font-semibold text-slate-700">{o.assigned_tech || t('orders.card.notAssigned')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">{t('orders.card.total')}</p>
                        <p className="text-sm font-black text-[#FF6B2C]">{o.total_cost > 0 ? `${o.total_cost.toLocaleString('sv-SE')} kr` : '—'}</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-2">
                      {new Date(o.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </Link>

                  {/* Delete control — top-right corner */}
                  {confirmId === o.id ? (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-white border border-red-200 rounded-xl px-2 py-1 shadow-sm z-10">
                      <button
                        onClick={() => handleDelete(o.id)}
                        disabled={deleting}
                        className="text-[10px] font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting ? '...' : 'Radera'}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-700"
                      >
                        Avbryt
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(o.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                      title="Radera arbetsorder"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 flex-1 flex items-center justify-center text-slate-400">Laddar...</div>
      </div>
    }>
      <WorkOrdersContent />
    </Suspense>
  );
}
