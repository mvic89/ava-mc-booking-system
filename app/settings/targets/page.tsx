'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { useRoleGuard } from '@/lib/useRoleGuard';
import { getTargets, upsertTarget, deleteTarget, type StaffTarget } from '@/lib/targets';
import { getLeads } from '@/lib/leads';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

interface FormState {
  staffEmail:    string;
  staffName:     string;
  periodYear:    number;
  periodMonth:   number;
  leadsTarget:   string;
  revenueTarget: string;
}

const EMPTY: FormState = {
  staffEmail:    '',
  staffName:     '',
  periodYear:    CURRENT_YEAR,
  periodMonth:   0,
  leadsTarget:   '',
  revenueTarget: '',
};

function kr(n: number) { return `${Math.round(n).toLocaleString('sv-SE')} kr`; }

export default function TargetsPage() {
  useRoleGuard('performance');
  const router = useRouter();
  const t = useTranslations('settingsTargets');

  const MONTHS = (t.raw('months') as string[]).map((label, i) => ({ value: i, label }));

  const [targets,     setTargets]     = useState<StaffTarget[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState<FormState>(EMPTY);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [yearFilter,  setYearFilter]  = useState(CURRENT_YEAR);

  // actuals from leads
  const [actuals, setActuals] = useState<Record<string, { leads: number; revenue: number }>>({});

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    load();
    loadActuals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [yearFilter]);

  async function load() {
    setLoading(true);
    setTargets(await getTargets(yearFilter));
    setLoading(false);
  }

  async function loadActuals() {
    const leads = await getLeads();
    const map: Record<string, { leads: number; revenue: number }> = {};
    leads.forEach(l => {
      const name = l.salesPersonName || '';
      if (!name) return;
      if (!map[name]) map[name] = { leads: 0, revenue: 0 };
      map[name].leads++;
      if (l.stage === 'closed') map[name].revenue += l.rawValue ?? 0;
    });
    setActuals(map);
  }

  function openNew() {
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(t: StaffTarget) {
    setForm({
      staffEmail:    t.staffEmail,
      staffName:     t.staffName,
      periodYear:    t.periodYear,
      periodMonth:   t.periodMonth,
      leadsTarget:   String(t.leadsTarget),
      revenueTarget: String(t.revenueTarget),
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.staffEmail.trim() || !form.staffName.trim()) {
      toast.error(t('toasts.nameEmailRequired'));
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertTarget({
        staffEmail:    form.staffEmail.trim(),
        staffName:     form.staffName.trim(),
        periodYear:    form.periodYear,
        periodMonth:   form.periodMonth,
        leadsTarget:   Number(form.leadsTarget)   || 0,
        revenueTarget: Number(form.revenueTarget) || 0,
      });
      setTargets(prev => {
        const idx = prev.findIndex(
          x => x.staffEmail === saved.staffEmail &&
               x.periodYear  === saved.periodYear &&
               x.periodMonth === saved.periodMonth
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      toast.success(t('toasts.saved'));
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(target: StaffTarget) {
    const period = target.periodMonth === 0
      ? `${target.periodYear} (${t('actions.fullYear')})`
      : `${MONTHS[target.periodMonth]?.label} ${target.periodYear}`;
    if (!confirm(t('deleteConfirm', { name: target.staffName, period }))) return;
    setDeleting(target.id);
    try {
      await deleteTarget(target.id);
      setTargets(prev => prev.filter(x => x.id !== target.id));
      toast.success(t('toasts.deleted'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  function exportCSV() {
    const rows = [
      [t('table.period'), 'E-post', t('table.period'), t('table.leadsTarget'), t('table.leadsActual'), t('table.leadsPct'), t('table.revenueTarget'), t('table.revenueActual'), t('table.revenuePct')],
      ...targets.map(tgt => {
        const act = actuals[tgt.staffName] ?? { leads: 0, revenue: 0 };
        const period = tgt.periodMonth === 0 ? `${tgt.periodYear} (${t('actions.fullYear')})` : `${MONTHS[tgt.periodMonth]?.label} ${tgt.periodYear}`;
        const leadsPct  = tgt.leadsTarget   > 0 ? Math.round((act.leads   / tgt.leadsTarget)   * 100) : 0;
        const revPct    = tgt.revenueTarget > 0 ? Math.round((act.revenue / tgt.revenueTarget) * 100) : 0;
        return [tgt.staffName, tgt.staffEmail, period, tgt.leadsTarget, act.leads, `${leadsPct}%`, tgt.revenueTarget, act.revenue, `${revPct}%`];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `targets_${yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('toasts.csvExported'));
  }

  // Group targets by staff member
  const grouped = useMemo(() => {
    const map: Record<string, StaffTarget[]> = {};
    targets.forEach(tgt => {
      if (!map[tgt.staffEmail]) map[tgt.staffEmail] = [];
      map[tgt.staffEmail].push(tgt);
    });
    return Object.entries(map).map(([email, rows]) => ({
      email,
      name: rows[0].staffName,
      rows: rows.sort((a, b) => a.periodMonth - b.periodMonth),
    }));
  }, [targets]);

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-6 md:px-10 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">{t('breadcrumb')}</Link>
                <span>→</span>
                <span className="text-slate-600 font-medium">{t('nav')}</span>
              </nav>
              <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
              <p className="text-sm text-slate-400 mt-0.5">{t('subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Year filter */}
              <select
                value={yearFilter}
                onChange={e => setYearFilter(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] bg-white"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                {t('exportCSV')}
              </button>
              <button
                onClick={openNew}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a20] text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('newTarget')}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 md:px-10 py-8">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => <div key={n} className="h-32 bg-white rounded-2xl animate-pulse" />)}
            </div>
          ) : grouped.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🎯</div>
              <p className="text-slate-700 font-semibold">{t('empty.title', { year: yearFilter })}</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">{t('empty.subtitle')}</p>
              <button onClick={openNew} className="px-4 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-semibold">
                {t('empty.button')}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ email, name, rows }) => {
                const act = actuals[name] ?? { leads: 0, revenue: 0 };
                return (
                  <div key={email} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    {/* Staff header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center font-bold text-[#FF6B2C] text-sm">
                          {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{name}</p>
                          <p className="text-xs text-slate-400">{email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{t('staff.totalActual')} <strong className="text-slate-900">{act.leads} {t('staff.leads')}</strong></span>
                        <span>{t('staff.revenue')} <strong className="text-slate-900">{kr(act.revenue)}</strong></span>
                      </div>
                    </div>

                    {/* Targets table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-50 bg-slate-50">
                            <th className="text-left px-6 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('table.period')}</th>
                            <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('table.leadsTarget')}</th>
                            <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('table.leadsActual')}</th>
                            <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('table.leadsPct')}</th>
                            <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('table.revenueTarget')}</th>
                            <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('table.revenueActual')}</th>
                            <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('table.revenuePct')}</th>
                            <th className="px-6 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => {
                            const leadsPct  = row.leadsTarget   > 0 ? Math.round((act.leads   / row.leadsTarget)   * 100) : null;
                            const revPct    = row.revenueTarget > 0 ? Math.round((act.revenue / row.revenueTarget) * 100) : null;
                            const period    = row.periodMonth === 0
                              ? `${row.periodYear} (${t('actions.fullYear')})`
                              : `${MONTHS[row.periodMonth]?.label} ${row.periodYear}`;
                            return (
                              <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 font-medium text-slate-700">{period}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{row.leadsTarget}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">{act.leads}</td>
                                <td className="px-4 py-3 text-right">
                                  {leadsPct !== null ? (
                                    <span className={`font-bold ${leadsPct >= 100 ? 'text-emerald-600' : leadsPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {leadsPct}%
                                    </span>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600">{kr(row.revenueTarget)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">{kr(act.revenue)}</td>
                                <td className="px-4 py-3 text-right">
                                  {revPct !== null ? (
                                    <span className={`font-bold ${revPct >= 100 ? 'text-emerald-600' : revPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {revPct}%
                                    </span>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => openEdit(row)}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                      {t('actions.edit')}
                                    </button>
                                    <button
                                      onClick={() => handleDelete(row)}
                                      disabled={deleting === row.id}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                      {deleting === row.id ? (
                                        <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Target form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{t('form.title')}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 text-xl">×</button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {/* Staff */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.name')}</label>
                  <input
                    value={form.staffName}
                    onChange={e => setForm(f => ({ ...f, staffName: e.target.value }))}
                    placeholder="Anna Andersson"
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] focus:ring-2 focus:ring-[#FF6B2C]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.email')}</label>
                  <input
                    type="email"
                    value={form.staffEmail}
                    onChange={e => setForm(f => ({ ...f, staffEmail: e.target.value }))}
                    placeholder="anna@dealer.se"
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all"
                  />
                </div>
              </div>

              {/* Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.year')}</label>
                  <select
                    value={form.periodYear}
                    onChange={e => setForm(f => ({ ...f, periodYear: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all bg-white"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.period')}</label>
                  <select
                    value={form.periodMonth}
                    onChange={e => setForm(f => ({ ...f, periodMonth: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all bg-white"
                  >
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Targets */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.leadsTarget')}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.leadsTarget}
                    onChange={e => setForm(f => ({ ...f, leadsTarget: e.target.value }))}
                    placeholder="50"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.revenueTarget')}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.revenueTarget}
                    onChange={e => setForm(f => ({ ...f, revenueTarget: e.target.value }))}
                    placeholder="500000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  {t('form.cancel')}
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a20] text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {saving ? t('form.saving') : t('form.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
