
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
  Active:   'bg-green-100 text-green-700',
  New:      'bg-blue-100 text-blue-700',
  Inactive: 'bg-slate-100 text-slate-500',
};

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

  const bankidCount     = counts.bankid;
  const protectedCount  = customers.filter(c => c.protectedIdentity).length;
  const unverifiedCount = customers.filter(c => !c.bankidVerified).length;
  const bankidPct       = customers.length > 0 ? Math.round((bankidCount / customers.length) * 100) : 0;

  return (
    <>
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">CRM</p>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                👥 {t('title')}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="text-sm px-3 py-2 rounded-xl border border-slate-200 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none w-48"
              />
              <Link
                href="/customers/new"
                className="flex items-center gap-2 bg-[#235971] hover:bg-[#1a4557] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                {t('addWithBankID')}
              </Link>
              <Link
                href="/customers/new"
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center text-lg transition-colors"
                title={t('addManuallyTitle')}
              >
                ＋
              </Link>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
              >
                ↑ Importera
              </button>
              <button
                onClick={() => exportToCsv(someSelected ? customers.filter(c => selected.has(c.id)) : displayed)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
                title={someSelected ? `Exportera ${selected.size} valda` : 'Exportera alla synliga'}
              >
                {t('export')}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-5 border-b border-slate-100 -mb-6">
            {TABS.map(tabItem => (
              <button
                key={tabItem.id}
                onClick={() => { setTab(tabItem.id); setSelected(new Set()); }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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
        </div>

        {/* Table */}
        <div className="flex-1 px-5 md:px-8 py-6 animate-fade-up overflow-x-auto">
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">

            {/* Bulk action bar */}
            {someSelected && (
              <div className="flex items-center justify-between px-5 py-3 bg-[#FF6B2C]/5 border-b border-[#FF6B2C]/20">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {selected.size} kund{selected.size !== 1 ? 'er' : ''} vald{selected.size !== 1 ? 'a' : ''}
                  </span>
                  <button
                    onClick={() => exportToCsv(customers.filter(c => selected.has(c.id)))}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium transition-colors"
                  >
                    ↓ Exportera CSV
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                  >
                    🗑 Ta bort
                  </button>
                </div>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
                  title="Avmarkera alla"
                >
                  ×
                </button>
              </div>
            )}

            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {/* Master checkbox */}
                  <th className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-[#FF6B2C] cursor-pointer rounded"
                      title={allVisibleSelected ? 'Avmarkera alla' : 'Markera alla'}
                    />
                  </th>
                  {[t('table.name'), t('table.email'), t('table.phone'), t('table.source'), t('table.vehicles'), t('table.lifetimeValue'), t('table.lastActivity'), t('table.tags')].map(col => (
                    <th key={col} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5">
                      {col}
                    </th>
                  ))}
                  {/* Actions column */}
                  <th className="w-10 px-3 py-3.5" />
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
                        : i % 2 === 0 ? 'hover:bg-[#FF6B2C]/5' : 'bg-slate-50/50 hover:bg-[#FF6B2C]/5'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => {}}
                        onClick={e => toggleRow(c.id, e)}
                        className="w-4 h-4 accent-[#FF6B2C] cursor-pointer rounded"
                      />
                    </td>
                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0b1524] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {(c.firstName[0] ?? c.lastName[0] ?? '?').toUpperCase()}{(c.lastName[0] ?? '').toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900">{c.firstName} {c.lastName}</span>
                            {c.protectedIdentity && <span title={t('stats.protected')}>🛡️</span>}
                          </div>
                          {c.personnummer && (
                            <div className="text-[11px] text-slate-400">{c.personnummer}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-5 py-3.5 text-sm text-slate-600">{c.email}</td>
                    {/* Phone */}
                    <td className="px-5 py-3.5 text-sm text-slate-600">{c.phone}</td>
                    {/* Source */}
                    <td className="px-5 py-3.5">
                      {c.source === 'BankID' ? (
                        <span className="inline-flex items-center gap-1 bg-[#235971] text-white text-[11px] font-bold px-2 py-1 rounded">
                          BankID
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-slate-100 text-slate-500 text-[11px] font-semibold px-2 py-1 rounded">
                          {t('sourceBadge.manual')}
                        </span>
                      )}
                    </td>
                    {/* Vehicles */}
                    <td className="px-5 py-3.5 text-sm text-slate-700 font-medium">{c.vehicles}</td>
                    {/* Lifetime Value */}
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">
                      {c.lifetimeValue > 0 ? `${c.lifetimeValue.toLocaleString('sv-SE')} kr` : '—'}
                    </td>
                    {/* Last Activity */}
                    <td className="px-5 py-3.5 text-sm text-slate-500">{c.lastActivity}</td>
                    {/* Tag */}
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${TAG_STYLES[c.tag]}`}>
                        {c.tag}
                      </span>
                    </td>
                    {/* Per-row delete */}
                    <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
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

            {displayed.length === 0 && (
              <div className="py-16 text-center text-slate-400 text-sm">
                {t('table.noResults')}
              </div>
            )}

            {/* Pagination hint */}
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 text-center">
              {t('table.showing', { count: displayed.length })}
              {someSelected && (
                <span className="ml-2 text-[#FF6B2C] font-medium">· {selected.size} markerade</span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom stats bar */}
        <div className="bg-white border-t border-slate-100 px-5 md:px-8 py-4">
          <div className="flex flex-wrap items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{customers.length}</div>
              <div className="text-xs text-slate-400 mt-0.5">{t('stats.totalCustomers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#235971]">{bankidCount}</div>
              <div className="text-xs text-slate-400 mt-0.5">{t('stats.bankidVerified')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{bankidPct}%</div>
              <div className="text-xs text-slate-400 mt-0.5">{t('stats.bankidShare')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{protectedCount}</div>
              <div className="text-xs text-slate-400 mt-0.5">{t('stats.protected')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#FF6B2C]">{unverifiedCount}</div>
              <div className="text-xs text-slate-400 mt-0.5">{t('stats.unverified')}</div>
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

    {/* Delete confirmation dialog */}
    {confirmDelete && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-fade-up">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-2xl">
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
