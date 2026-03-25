'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { notify } from '@/lib/notifications';
import { createLead } from '@/lib/leads';
import BankIDModal from '@/components/bankIdModel';
import PhoneInput from '@/components/PhoneInput';
import { useInventory } from '@/context/InventoryContext';
import type { BankIDResult } from '@/types';

type TabType = 'bankid' | 'manual' | 'phone';

const TABS: { id: TabType; icon: string; labelKey: string }[] = [
  { id: 'bankid', icon: '🔒', labelKey: 'tabs.bankid' },
  { id: 'manual', icon: '✏️', labelKey: 'tabs.manual' },
  { id: 'phone',  icon: '📞', labelKey: 'tabs.phone'  },
];

function matchColor(pct: number) {
  if (pct >= 90) return { text: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' };
  if (pct >= 80) return { text: 'text-blue-600',    bg: 'bg-blue-50',    bar: 'bg-blue-500'    };
  return          { text: 'text-slate-500',          bg: 'bg-slate-50',   bar: 'bg-slate-400'   };
}

export default function NewLeadPage() {
  const router   = useRouter();
  const t        = useTranslations();
  const tNotif   = useTranslations('notifications');
  const { motorcycles } = useInventory();

  const [activeTab,   setActiveTab]   = useState<TabType>('bankid');
  const [showBankID,  setShowBankID]  = useState(false);
  const [bankIDData,  setBankIDData]  = useState<BankIDResult | null>(null);
  const [user,        setUser]        = useState<Record<string,unknown> | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);

  const [formData, setFormData] = useState({
    name: '', address: '', dateOfBirth: '', gender: '',
    email: '', phone: '', source: 'Walk-in',
    notes: '', interest: '', estimatedValue: 0,
  });

  const [vehicleSearch, setVehicleSearch] = useState('');

  // ── Live vehicles: in-stock motorcycles ranked by interest-field relevance ──
  const liveVehicles = useMemo(() => {
    const inStock = motorcycles.filter(m => m.stock > 0);
    const q       = formData.interest.toLowerCase().trim();

    return inStock
      .map(m => {
        const fullName = `${m.brand} ${m.name}`;
        const margin   = m.sellingPrice > 0
          ? Math.min(99, Math.round(((m.sellingPrice - m.cost) / m.sellingPrice) * 100))
          : 50;
        const textMatch = q ? fullName.toLowerCase().includes(q) : false;
        const score     = textMatch ? 100 + margin : margin;
        return {
          name:     fullName,
          price:    `${m.sellingPrice.toLocaleString('sv-SE')} kr`,
          rawPrice: m.sellingPrice,
          stock:    m.stock,
          match:    textMatch ? Math.min(99, 70 + margin) : margin,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [motorcycles, formData.interest]);

  // ── Vehicle search: queries ALL motorcycles (including 0-stock) ──
  const vehicleSearchResults = useMemo(() => {
    const q = vehicleSearch.toLowerCase().trim();
    if (!q) return null;
    return motorcycles
      .filter(m => `${m.brand} ${m.name}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map(m => ({
        name:     `${m.brand} ${m.name}`,
        price:    `${m.sellingPrice.toLocaleString('sv-SE')} kr`,
        rawPrice: m.sellingPrice,
        stock:    m.stock,
      }));
  }, [motorcycles, vehicleSearch]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/auth/login'); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role === 'service') {
      toast.error('Creating leads is not available for Service users.');
      router.replace('/dashboard');
      return;
    }
    setUser(parsed);
  }, [router]);

  function handleBankIDComplete(result: BankIDResult) {
    setBankIDData(result);
    setShowBankID(false);
    const fullAddress = result.roaring?.address
      ? `${result.roaring.address.street}, ${result.roaring.address.postalCode} ${result.roaring.address.city}`
      : '';
    setFormData(prev => ({
      ...prev,
      name:        result.user.name,
      address:     fullAddress,
      dateOfBirth: (result.user as unknown as Record<string,unknown>).dateOfBirth as string || '',
      gender:      result.roaring?.gender || '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Parse address string "street, postalCode city" back into parts
      const addrRaw  = formData.address || '';
      const commaIdx = addrRaw.indexOf(',');
      const streetPart = commaIdx >= 0 ? addrRaw.slice(0, commaIdx).trim() : addrRaw.trim();
      const restPart   = commaIdx >= 0 ? addrRaw.slice(commaIdx + 1).trim() : '';
      // restPart is "postalCode city" e.g. "123 45 Stockholm"
      const postalMatch = restPart.match(/^(\d[\d\s]{3,6})\s+(.+)$/);
      const postalCode  = postalMatch ? postalMatch[1].replace(/\s/g, '') : null;
      const cityPart    = postalMatch ? postalMatch[2].trim() : restPart || null;

      const lead = await createLead({
        name:         formData.name,
        bike:         formData.interest || '—',
        value:        formData.estimatedValue || 0,
        lead_status:  'warm',
        stage:        'new',
        email:        formData.email,
        phone:        formData.phone,
        personnummer: bankIDData?.user.personalNumber?.replace(/-/g, '') || null,
        source:       bankIDData ? 'BankID' : 'Walk-in',
        notes:        formData.notes || undefined,
        address:      streetPart    || null,
        city:         cityPart      || null,
      });
      notify('newLead', {
        type:    'lead',
        title:   tNotif('actions.newLead.title'),
        message: `${lead.name} ${tNotif('actions.newLead.interestedIn')} ${lead.bike}`,
        href:    '/sales/leads',
      });
      toast.success('Lead skapat!');
      router.push('/sales/leads');
    } catch (err: unknown) {
      toast.error('Kunde inte skapa lead', { description: err instanceof Error ? err.message : String(err) });
    }
  }

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-6 md:px-10 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-slate-600 transition-colors">
              {t('newLead.breadcrumb.sales')}
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">{t('newLead.breadcrumb.newLead')}</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-xl">
              🏍
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t('newLead.title')}</h1>
              <p className="text-sm text-slate-400 mt-0.5">{t('newLead.identifyCustomerDesc')}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-auto">

          {/* ── Left: form ─────────────────────────────────────────────── */}
          <div className="flex-1 px-6 md:px-10 py-8 min-w-0">

            {/* Identification tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-8">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'bankid') setShowBankID(true);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{t(`newLead.${tab.labelKey}`)}</span>
                </button>
              ))}
            </div>

            {/* BankID verified banner */}
            {bankIDData && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-8">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{bankIDData.user.name}</p>
                  <p className="text-xs text-emerald-700">
                    {bankIDData.user.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')} · BankID verifierad
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('newLead.fields.name')}</label>
                  {bankIDData && <AutoBadge type="bankid" />}
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  disabled={!!bankIDData}
                  className={inputCls(!!bankIDData, false)}
                  required
                />
              </div>

              {/* Address */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('newLead.fields.address')}</label>
                  {bankIDData?.roaring && <AutoBadge type="roaring" />}
                </div>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  disabled={!!bankIDData?.roaring}
                  className={inputCls(!!bankIDData?.roaring, true)}
                  required
                />
              </div>

              {/* DOB + Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-slate-700">{t('newLead.fields.dateOfBirth')}</label>
                    {formData.dateOfBirth && <AutoBadge type="bankid" />}
                  </div>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    disabled={!!bankIDData}
                    className={inputCls(!!bankIDData, false)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-slate-700">{t('newLead.fields.gender')}</label>
                    {formData.gender && <AutoBadge type="roaring" />}
                  </div>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    disabled={!!bankIDData?.roaring && !!formData.gender}
                    className={inputCls(!!bankIDData?.roaring && !!formData.gender, true)}
                  >
                    <option value="">—</option>
                    <option value="M">{t('newLead.genderOptions.male')}</option>
                    <option value="F">{t('newLead.genderOptions.female')}</option>
                  </select>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-1" />

              {/* Email */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('newLead.fields.email')} <span className="text-red-400">*</span></label>
                  <AutoBadge type="manual" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={inputCls(false, false)}
                  placeholder={t('newLead.placeholders.email')}
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('newLead.fields.phone')} <span className="text-red-400">*</span></label>
                  <AutoBadge type="manual" />
                </div>
                <PhoneInput
                  value={formData.phone}
                  onChange={v => setFormData({ ...formData, phone: v })}
                  placeholder={t('newLead.placeholders.phone')}
                  className="rounded-xl border border-slate-200 focus-within:border-[#FF6B2C] focus-within:ring-2 focus-within:ring-[#FF6B2C]/20 transition-all bg-white"
                  required
                />
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-1" />

              {/* Source + Interest in a row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('newLead.fields.source')}</label>
                  <select
                    value={formData.source}
                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                    className={inputCls(false, false)}
                  >
                    <option>{t('newLead.sourceOptions.walkin')}</option>
                    <option>{t('newLead.sourceOptions.phone')}</option>
                    <option>{t('newLead.sourceOptions.website')}</option>
                    <option>{t('newLead.sourceOptions.referral')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('newLead.fields.interest')}</label>
                  <input
                    type="text"
                    value={formData.interest}
                    onChange={e => setFormData({ ...formData, interest: e.target.value })}
                    className={inputCls(false, false)}
                    placeholder={t('newLead.placeholders.interest')}
                  />
                </div>
              </div>

              {/* Deal value */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('newLead.fields.dealValue')}</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.estimatedValue || ''}
                    onChange={e => setFormData({ ...formData, estimatedValue: parseInt(e.target.value) || 0 })}
                    className={`${inputCls(false, false)} pr-12`}
                    placeholder={t('newLead.placeholders.dealValue')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium pointer-events-none">kr</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('newLead.fields.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:border-[#FF6B2C] focus:ring-2 focus:ring-[#FF6B2C]/20 outline-none transition-all resize-none text-slate-800 placeholder:text-slate-400"
                  placeholder={t('newLead.placeholders.notes')}
                  rows={3}
                />
              </div>

              {/* GDPR */}
              <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={gdprConsent}
                  onChange={e => setGdprConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#FF6B2C] shrink-0 cursor-pointer"
                />
                <span className="text-xs text-slate-500 leading-relaxed">
                  {t('newLead.gdprConsent')}{' '}
                  <Link href="/privacy" className="text-[#FF6B2C] underline hover:no-underline font-medium" target="_blank">
                    {t('newLead.privacyPolicyLink')}
                  </Link>
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={!gdprConsent}
                className="w-full bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md disabled:shadow-none"
              >
                {t('newLead.submitButton')}
              </button>
            </form>
          </div>

          {/* ── Right: info panel ───────────────────────────────────────── */}
          <div className="lg:w-80 xl:w-88 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white px-6 py-8 space-y-8">

            {/* Data enrichment legend */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Datakällor</p>
              <div className="space-y-2.5">
                {[
                  { dot: 'bg-[#235971]', label: 'BankID — Namn & personnummer (verifierat)' },
                  { dot: 'bg-emerald-500', label: 'Folkbokföring — Adress, postnr, ort, kön' },
                  { dot: 'bg-[#FF6B2C]', label: 'Manuellt — E-post, telefon (fråga kunden)' },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-2.5">
                    <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${row.dot}`} />
                    <span className="text-xs text-slate-600 leading-relaxed">{row.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1.5">
                {[
                  { icon: '📊', label: t('newLead.sidebar.existingCustomer') },
                  { icon: '🛡️', label: t('newLead.sidebar.protectedIdentity') },
                  { icon: '🎯', label: t('newLead.sidebar.highIntent') },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-2">
                    <span className="text-sm shrink-0">{row.icon}</span>
                    <span className="text-xs text-slate-500 leading-relaxed">{row.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Matching vehicles — live from inventory */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  🏍 {t('newLead.sidebar.matchingVehicles')}
                </p>
                {motorcycles.filter(m => m.stock > 0).length > 0 && (
                  <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    {motorcycles.filter(m => m.stock > 0).length} i lager
                  </span>
                )}
              </div>

              {/* Vehicle search */}
              <div className="relative mb-3">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={e => setVehicleSearch(e.target.value)}
                  placeholder="Sök alla fordon..."
                  className="w-full pl-7 pr-7 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                />
                {vehicleSearch && (
                  <button
                    type="button"
                    onClick={() => setVehicleSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-300 hover:bg-slate-400 text-white text-[10px] leading-none flex items-center justify-center transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>

              {vehicleSearchResults !== null ? (
                /* ── Search results ── */
                vehicleSearchResults.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-5 text-center">
                    <p className="text-xs text-slate-400">Inga fordon matchade &ldquo;{vehicleSearch}&rdquo;</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {vehicleSearchResults.map(v => {
                      const active = formData.interest === v.name;
                      return (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, interest: v.name, estimatedValue: v.rawPrice }));
                            setVehicleSearch('');
                          }}
                          className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                            active
                              ? 'border-[#FF6B2C] bg-[#FF6B2C]/5'
                              : 'border-transparent bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{v.name}</span>
                            {v.stock === 0 ? (
                              <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded shrink-0">Slut</span>
                            ) : (
                              <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded shrink-0">{v.stock} st</span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">{v.price}</span>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : liveVehicles.length === 0 ? (
                /* ── Empty inventory ── */
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
                  <p className="text-2xl mb-2">📦</p>
                  <p className="text-xs text-slate-400 font-medium">Inga motorcyklar i lager</p>
                  <Link href="/inventory" className="text-[10px] text-[#FF6B2C] font-semibold mt-1 inline-block hover:underline">
                    Gå till lager →
                  </Link>
                </div>
              ) : (
                /* ── Smart top-5 list ── */
                <div className="space-y-2">
                  {liveVehicles.map(v => {
                    const clr    = matchColor(v.match);
                    const active = formData.interest === v.name;
                    return (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, interest: v.name, estimatedValue: v.rawPrice }))}
                        className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                          active
                            ? 'border-[#FF6B2C] bg-[#FF6B2C]/5'
                            : 'border-transparent bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-bold text-slate-900 truncate pr-2">{v.name}</span>
                          <span className={`text-xs font-bold shrink-0 ${clr.text}`}>{v.match}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">{v.price}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-400">{v.stock} st</span>
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${clr.bar}`} style={{ width: `${v.match}%` }} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!vehicleSearch && (
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  {formData.interest
                    ? 'Sorterat efter träff på sökord · klicka för att välja'
                    : 'Sorterat efter bästa marginal · klicka för att välja'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBankID && (
        <BankIDModal
          mode="auth"
          onComplete={handleBankIDComplete}
          onCancel={() => setShowBankID(false)}
          autoStart
        />
      )}
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function inputCls(disabled: boolean, green: boolean) {
  if (disabled && green)
    return 'w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-slate-700 text-sm outline-none cursor-default';
  if (disabled)
    return 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm outline-none cursor-default';
  return 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:border-[#FF6B2C] focus:ring-2 focus:ring-[#FF6B2C]/20 outline-none transition-all placeholder:text-slate-400';
}

function AutoBadge({ type }: { type: 'bankid' | 'roaring' | 'manual' }) {
  const styles = {
    bankid: 'bg-[#235971]/10 text-[#235971]',
    roaring:'bg-emerald-100 text-emerald-700',
    manual: 'bg-[#FF6B2C]/10 text-[#FF6B2C]',
  };
  const labels = { bankid: 'BankID', roaring: 'Folkbokföring', manual: 'Manuellt' };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}
