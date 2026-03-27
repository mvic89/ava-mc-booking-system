
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import CustomerImportModal from '@/components/CustomerImportModal';
import { getCustomers, deleteCustomers, type Customer, type Tag } from '@/lib/customers';
import { useAutoRefresh } from '@/lib/realtime';

type Tab = 'all' | 'active' | 'vip' | 'bankid' | 'inactive';

const TAG_STYLES: Record<Tag, string> = {
  VIP:      'bg-amber-100 text-amber-700',
  Active:   'bg-emerald-100 text-emerald-700',
  New:      'bg-blue-100 text-blue-700',
  Inactive: 'bg-slate-100 text-slate-500',
};

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];
function avatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function filterByTab(customers: Customer[], tab: Tab): Customer[] {
  switch (tab) {
    case 'active':   return customers.filter(c => c.tag === 'Active' || c.tag === 'VIP');
    case 'vip':      return customers.filter(c => c.tag === 'VIP');
    case 'bankid':   return customers.filter(c => c.bankidVerified);
    case 'inactive': return customers.filter(c => c.tag === 'Inactive');
    default:         return customers;
  }
}

function exportToCsv(rows: Customer[]) {
  const header = 'Förnamn,Efternamn,E-post,Telefon,Källa,Senaste aktivitet,Tag,Livstidsvärde (kr)\n';
  const csv = header + rows.map(c =>
    [c.firstName, c.lastName, c.email, c.phone, c.source, c.lastActivity, c.tag, c.lifetimeValue]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `kunder-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CustomersPage() {
  const router = useRouter();
  const t = useTranslations('customers');
  const [ready,         setReady]         = useState(false);
  const [customers,     setCustomers]     = useState<Customer[]>([]);
  const [tab,           setTab]           = useState<Tab>('all');
  const [search,        setSearch]        = useState('');
  const [showImport,    setShowImport]    = useState(false);
  const [selected,      setSelected]      = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.push('/auth/login'); return; }
    getCustomers().then(data => { setCustomers(data); setReady(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(() => { getCustomers().then(setCustomers); });

  const counts = useMemo(() => ({
    all:      customers.length,
    active:   customers.filter(c => c.tag === 'Active' || c.tag === 'VIP').length,
    vip:      customers.filter(c => c.tag === 'VIP').length,
    bankid:   customers.filter(c => c.bankidVerified).length,
    inactive: customers.filter(c => c.tag === 'Inactive').length,
  }), [customers]);

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'all',      label: t('tabs.all'),      count: counts.all },
    { id: 'active',   label: t('tabs.active'),   count: counts.active },
    { id: 'vip',      label: t('tabs.vip'),      count: counts.vip },
    { id: 'bankid',   label: t('tabs.bankid'),   count: counts.bankid },
    { id: 'inactive', label: t('tabs.inactive'), count: counts.inactive },
  ];

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tabFiltered = filterByTab(customers, tab);
  const displayed = tabFiltered.filter(c =>
    !search ||
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const allVisibleSelected = displayed.length > 0 && displayed.every(c => selected.has(c.id));
  const someSelected = selected.size > 0;

  const bankidCount     = counts.bankid;
  const protectedCount  = customers.filter(c => c.protectedIdentity).length;
  const unverifiedCount = customers.filter(c => !c.bankidVerified).length;
  const bankidPct       = customers.length > 0 ? Math.round((bankidCount / customers.length) * 100) : 0;
  const totalValue      = customers.reduce((s, c) => s + (c.lifetimeValue ?? 0), 0);

  function toggleRow(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(prev => { const n = new Set(prev); displayed.forEach(c => n.delete(c.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); displayed.forEach(c => n.add(c.id)); return n; });
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteCustomers([...selected]);
      const fresh = await getCustomers();
      setCustomers(fresh);
      setSelected(new Set());
      setConfirmDelete(false);
      toast.success(`${selected.size} kunder borttagna`);
    } catch {
      toast.error('Fel vid borttagning, försök igen');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-6 md:px-10 pt-8 pb-6 bg-white border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1.5">CRM</p>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('title')}</h1>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-sm font-bold rounded-full">
                  {customers.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#FF6B2C] focus:ring-2 focus:ring-[#FF6B2C]/20 outline-none w-56 transition-all"
                />
              </div>

              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Importera
              </button>

              <button
                onClick={() => exportToCsv(someSelected ? customers.filter(c => selected.has(c.id)) : displayed)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all"
                title={someSelected ? `Exportera ${selected.size} valda` : 'Exportera alla synliga'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4 4m0 0l4-4m-4 4V4" />
                </svg>
                {t('export')}
              </button>

              <Link
                href="/customers/new"
                className="flex items-center gap-2 bg-[#235971] hover:bg-[#1a4557] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('addWithBankID')}
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 md:px-10 py-6 overflow-x-auto">

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('stats.totalCustomers')}</span>
                <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-base">👥</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{customers.length}</div>
              <div className="text-xs text-slate-400 mt-1">{totalValue > 0 ? `${(totalValue / 1000).toFixed(0)}k kr totalt värde` : 'Inga köp ännu'}</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('stats.bankidVerified')}</span>
                <span className="w-8 h-8 rounded-xl bg-[#235971]/10 flex items-center justify-center text-base">🔐</span>
              </div>
              <div className="text-3xl font-bold text-[#235971]">{bankidCount}</div>
              <div className="text-xs text-slate-400 mt-1">{bankidPct}% av alla kunder</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('stats.protected')}</span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-base">🛡️</span>
              </div>
              <div className="text-3xl font-bold text-amber-600">{protectedCount}</div>
              <div className="text-xs text-slate-400 mt-1">Sekretessmarkerade</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('stats.unverified')}</span>
                <span className="w-8 h-8 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-base">⚠️</span>
              </div>
              <div className="text-3xl font-bold text-[#FF6B2C]">{unverifiedCount}</div>
              <div className="text-xs text-slate-400 mt-1">Ej verifierade med BankID</div>
            </div>
          </div>

          {/* Table card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

            {/* Tabs */}
            <div className="flex items-center border-b border-slate-100 px-2">
              {TABS.map(tabItem => (
                <button
                  key={tabItem.id}
                  onClick={() => { setTab(tabItem.id); setSelected(new Set()); }}
                  className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === tabItem.id
                      ? 'border-[#FF6B2C] text-[#FF6B2C]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tabItem.label}
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === tabItem.id ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tabItem.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Bulk action bar */}
            {someSelected && (
              <div className="flex items-center justify-between px-5 py-3 bg-[#FF6B2C]/5 border-b border-[#FF6B2C]/20">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#FF6B2C]">
                    {selected.size} vald{selected.size !== 1 ? 'a' : ''}
                  </span>
                  <button
                    onClick={() => exportToCsv(customers.filter(c => selected.has(c.id)))}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium transition-colors"
                  >
                    ↓ Exportera CSV
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                  >
                    🗑 Ta bort
                  </button>
                </div>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
                >×</button>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="w-10 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 accent-[#FF6B2C] cursor-pointer rounded"
                        title={allVisibleSelected ? 'Avmarkera alla' : 'Markera alla'}
                      />
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.name')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.email')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.phone')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.source')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.vehicles')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.lifetimeValue')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.lastActivity')}</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('table.tags')}</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((c, i) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className={`group border-b border-slate-50 cursor-pointer transition-colors ${
                        selected.has(c.id)
                          ? 'bg-[#FF6B2C]/5'
                          : 'hover:bg-slate-50/80'
                      } ${i === displayed.length - 1 ? 'border-none' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => {}}
                          onClick={e => toggleRow(c.id, e)}
                          className="w-4 h-4 accent-[#FF6B2C] cursor-pointer rounded"
                        />
                      </td>

                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${avatarColor(c.firstName)} text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm`}>
                            {(c.firstName?.[0] ?? '?').toUpperCase()}{(c.lastName?.[0] ?? '').toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-900">{c.firstName} {c.lastName}</span>
                              {c.protectedIdentity && <span title={t('stats.protected')} className="text-xs">🛡️</span>}
                            </div>
                            {c.personnummer && (
                              <div className="text-[11px] text-slate-400 font-mono tracking-tight">{c.personnummer}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600">{c.email || '—'}</span>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600">{c.phone || '—'}</span>
                      </td>

                      {/* Source */}
                      <td className="px-5 py-4">
                        {c.source === 'BankID' ? (
                          <span className="inline-flex items-center gap-1 bg-[#235971] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                            🔐 BankID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                            ✏️ {t('sourceBadge.manual')}
                          </span>
                        )}
                      </td>

                      {/* Vehicles */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                          🏍️ {c.vehicles}
                        </span>
                      </td>

                      {/* Lifetime Value */}
                      <td className="px-5 py-4">
                        <span className={`text-sm font-semibold ${c.lifetimeValue > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                          {c.lifetimeValue > 0 ? `${c.lifetimeValue.toLocaleString('sv-SE')} kr` : '—'}
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-500">{c.lastActivity || '—'}</span>
                      </td>

                      {/* Tag */}
                      <td className="px-5 py-4">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${TAG_STYLES[c.tag]}`}>
                          {c.tag}
                        </span>
                      </td>

                      {/* Per-row delete */}
                      <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setSelected(new Set([c.id])); setConfirmDelete(true); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                          title="Ta bort kund"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {displayed.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-3xl">👥</div>
                <p className="text-slate-700 font-semibold">{t('table.noResults')}</p>
                <p className="text-sm text-slate-400 mt-1">Prova att justera sökning eller filter</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {t('table.showing', { count: displayed.length })}
              </span>
              {someSelected && (
                <span className="text-xs text-[#FF6B2C] font-semibold">{selected.size} markerade</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Import modal */}
    {showImport && (
      <CustomerImportModal
        onClose={() => setShowImport(false)}
        onSuccess={() => getCustomers().then(setCustomers)}
      />
    )}

    {/* Delete confirmation */}
    {confirmDelete && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4 text-3xl">
            🗑
          </div>
          <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Ta bort kunder?</h3>
          <p className="text-sm text-slate-500 text-center mb-6">
            Du är på väg att ta bort{' '}
            <strong className="text-slate-700">{selected.size} kund{selected.size !== 1 ? 'er' : ''}</strong>.
            {' '}Det går inte att ångra.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              Avbryt
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {deleting
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Tar bort...</>
                : `Ta bort ${selected.size}`
              }
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
