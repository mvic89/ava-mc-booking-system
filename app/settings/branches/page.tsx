'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { useRoleGuard } from '@/lib/useRoleGuard';
import {
  getBranches, createBranch, updateBranch, deleteBranch,
  type Branch,
} from '@/lib/branches';

const EMPTY = { name: '', address: '', city: '', phone: '', managerName: '', active: true };

export default function BranchesPage() {
  useRoleGuard('branches');
  const router = useRouter();
  const t = useTranslations('settingsBranches');

  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Branch | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [form,      setForm]      = useState(EMPTY);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setBranches(await getBranches());
    setLoading(false);
  }

  function openNew() {
    setForm(EMPTY);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(b: Branch) {
    setForm({
      name:        b.name,
      address:     b.address ?? '',
      city:        b.city    ?? '',
      phone:       b.phone   ?? '',
      managerName: b.managerName ?? '',
      active:      b.active,
    });
    setEditing(b);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error(t('toasts.nameRequired')); return; }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateBranch(editing.id, form);
        setBranches(bs => bs.map(b => b.id === editing.id ? updated : b));
        toast.success(t('toasts.updated'));
      } else {
        const created = await createBranch(form);
        setBranches(bs => [...bs, created]);
        toast.success(t('toasts.created'));
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(b: Branch) {
    if (!confirm(t('deleteConfirm', { name: b.name }))) return;
    setDeleting(b.id);
    try {
      await deleteBranch(b.id);
      setBranches(bs => bs.filter(x => x.id !== b.id));
      toast.success(t('toasts.deleted'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  async function toggleActive(b: Branch) {
    try {
      const updated = await updateBranch(b.id, { active: !b.active });
      setBranches(bs => bs.map(x => x.id === b.id ? updated : x));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-6 md:px-10 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">{t('breadcrumb')}</Link>
                <span>→</span>
                <span className="text-slate-600 font-medium">{t('nav')}</span>
              </nav>
              <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
              <p className="text-sm text-slate-400 mt-0.5">{t('subtitle')}</p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a20] text-white text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('newBranch')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 md:px-10 py-8">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => <div key={n} className="h-20 bg-white rounded-2xl animate-pulse" />)}
            </div>
          ) : branches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🏢</div>
              <p className="text-slate-700 font-semibold">{t('empty.title')}</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">{t('empty.subtitle')}</p>
              <button onClick={openNew} className="px-4 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-semibold">
                {t('empty.button')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {branches.map(b => (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-lg">🏢</div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{b.name}</p>
                        {b.city && <p className="text-xs text-slate-400">{b.city}</p>}
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      b.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      {b.active ? t('status.active') : t('status.inactive')}
                    </span>
                  </div>

                  <div className="space-y-1 mb-4">
                    {b.address && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="text-slate-300">📍</span> {b.address}{b.city ? `, ${b.city}` : ''}
                      </p>
                    )}
                    {b.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="text-slate-300">📞</span> {b.phone}
                      </p>
                    )}
                    {b.managerName && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="text-slate-300">👤</span> {b.managerName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => openEdit(b)}
                      className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {t('actions.edit')}
                    </button>
                    <button
                      onClick={() => toggleActive(b)}
                      className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {b.active ? t('actions.deactivate') : t('actions.activate')}
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      disabled={deleting === b.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deleting === b.id ? (
                        <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branch form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editing ? t('form.titleEdit') : t('form.titleNew')}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 text-xl">×</button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.name')}</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('form.namePlaceholder')}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] focus:ring-2 focus:ring-[#FF6B2C]/20 transition-all"
                />
              </div>

              {/* Address + City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.address')}</label>
                  <input
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder={t('form.addressPlaceholder')}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.city')}</label>
                  <input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Stockholm"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all"
                  />
                </div>
              </div>

              {/* Phone + Manager */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.phone')}</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+46 8 123 456"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('form.manager')}</label>
                  <input
                    value={form.managerName}
                    onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
                    placeholder="Anna Andersson"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B2C] transition-all"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#FF6B2C]"
                />
                <span className="text-sm text-slate-600">{t('form.active')}</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  {t('form.cancel')}
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a20] text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {saving ? t('form.saving') : editing ? t('form.save') : t('form.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
