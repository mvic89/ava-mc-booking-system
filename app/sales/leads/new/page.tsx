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
import { isValidEmail, isValidPhone } from '@/lib/validation';
import type { BankIDResult } from '@/types';

type TabType = 'bankid' | 'manual' | 'phone';
type LeadType = 'motorcycle' | 'accessories';

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
  const { motorcycles, accessories, spareParts } = useInventory();

  const [activeTab,   setActiveTab]   = useState<TabType>('bankid');
  const [showBankID,  setShowBankID]  = useState(false);
  const [bankIDData,  setBankIDData]  = useState<BankIDResult | null>(null);
  const [user,        setUser]        = useState<Record<string,unknown> | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});

  // Lead type: motorcycle purchase vs accessories/spare parts only
  const [leadType,     setLeadType]     = useState<LeadType>('motorcycle');
  const [itemSearch,   setItemSearch]   = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id: string; name: string; brand: string; price: number; qty: number; itemType: 'acc' | 'sp' }[]>([]);

  // Returning customer — set when URL contains ?customerId=
  const [returningCustomerId,   setReturningCustomerId]   = useState<string | null>(null);
  const [returningCustomerName, setReturningCustomerName] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '', address: '', dateOfBirth: '', gender: '',
    email: '', phone: '', source: 'Walk-in',
    notes: '', interest: '', estimatedValue: 0, costPrice: 0,
  });

  // Pre-fill from customer profile "New quote" button
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const name   = params.get('name')       ?? '';
    const email  = params.get('email')      ?? '';
    const phone  = params.get('phone')      ?? '';
    const cid    = params.get('customerId') ?? '';
    if (cid) {
      // Returning customer — skip all identity fields, link to existing record
      setReturningCustomerId(cid);
      setReturningCustomerName(name);
      setFormData(prev => ({ ...prev, name, email, phone }));
      setGdprConsent(true); // existing customer already consented
    } else if (name || email || phone) {
      setActiveTab('manual');
      setFormData(prev => ({ ...prev, name, email, phone }));
      setGdprConsent(true); // existing customer already consented
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [vehicleSearch, setVehicleSearch] = useState('');

  // ── Accessories/spare-parts picker ────────────────────────────────────────
  const allShopItems = useMemo(() => {
    const accs = accessories.map(a => ({ id: a.id, name: a.name, brand: a.brand, price: a.sellingPrice, stock: a.stock, itemType: 'acc' as const }));
    const sps  = spareParts.map(s  => ({ id: s.id, name: s.name, brand: s.brand, price: s.sellingPrice, stock: s.stock, itemType: 'sp'  as const }));
    return [...accs, ...sps];
  }, [accessories, spareParts]);

  const filteredShopItems = useMemo(() => {
    const q = itemSearch.toLowerCase().trim();
    const items = q ? allShopItems.filter(i => `${i.brand} ${i.name}`.toLowerCase().includes(q)) : allShopItems;
    return items.slice(0, 20);
  }, [allShopItems, itemSearch]);

  const selectedTotal = useMemo(
    () => selectedItems.reduce((s, i) => s + i.price * i.qty, 0),
    [selectedItems],
  );

  function toggleItem(item: typeof allShopItems[0]) {
    setSelectedItems(prev => {
      const exists = prev.find(p => p.id === item.id);
      if (exists) return prev.filter(p => p.id !== item.id);
      return [...prev, { id: item.id, name: item.name, brand: item.brand, price: item.price, qty: 1, itemType: item.itemType }];
    });
  }

  function changeQty(id: string, qty: number) {
    if (qty < 1) { setSelectedItems(prev => prev.filter(p => p.id !== id)); return; }
    setSelectedItems(prev => prev.map(p => p.id === id ? { ...p, qty } : p));
  }

  // ── Live vehicles: in-stock motorcycles ranked by interest-field relevance ──
  const liveVehicles = useMemo(() => {
    const inStock = motorcycles.filter(m => m.stock > 0);
    const q       = formData.interest.toLowerCase().trim();

    return inStock
      .map((m, i) => {
        const fullName = `${m.brand} ${m.name}`;
        const margin   = m.sellingPrice > 0
          ? Math.min(99, Math.round(((m.sellingPrice - m.cost) / m.sellingPrice) * 100))
          : 50;
        const textMatch = q ? fullName.toLowerCase().includes(q) : false;
        const score     = textMatch ? 100 + margin : margin;
        return {
          key:       `${m.brand}-${m.name}-${i}`,
          name:      fullName,
          price:     `${m.sellingPrice.toLocaleString('sv-SE')} kr`,
          rawPrice:  m.sellingPrice,
          stock:     m.stock,
          match:     textMatch ? Math.min(99, 70 + margin) : margin,
          score,
          color:     m.color     ?? '',
          year:      m.year      ?? 0,
          engineCC:  m.engineCC  ?? 0,
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
      .map((m, i) => ({
        key:      `${m.brand}-${m.name}-${i}`,
        name:     `${m.brand} ${m.name}`,
        price:    `${m.sellingPrice.toLocaleString('sv-SE')} kr`,
        rawPrice: m.sellingPrice,
        stock:    m.stock,
        color:    m.color    ?? '',
        year:     m.year     ?? 0,
        engineCC: m.engineCC ?? 0,
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
    const errs: { email?: string; phone?: string } = {};
    if (formData.email && !isValidEmail(formData.email)) errs.email = 'Enter a valid email address (e.g. name@domain.com)';
    if (formData.phone && !isValidPhone(formData.phone)) errs.phone = 'Enter a valid phone number (at least 7 digits)';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
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

      const bikeField = leadType === 'accessories'
        ? selectedItems.length > 0
          ? 'Tillbehör: ' + selectedItems.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')
          : formData.interest || 'Tillbehör / Reservdelar'
        : formData.interest || '—';

      const dealValue = leadType === 'accessories' && selectedTotal > 0
        ? selectedTotal
        : formData.estimatedValue || 0;

      const lead = await createLead({
        name:         formData.name,
        bike:         bikeField,
        value:        dealValue,
        cost_price:   formData.costPrice || 0,
        lead_status:  'warm',
        stage:        leadType === 'accessories' ? 'pending_payment' : 'new',
        email:        formData.email,
        phone:        formData.phone,
        personnummer: bankIDData?.user.personalNumber?.replace(/-/g, '') || null,
        source:           bankIDData ? 'BankID' : 'Walk-in',
        notes:            formData.notes || undefined,
        address:          streetPart    || null,
        city:             cityPart      || null,
        customer_id:      returningCustomerId ?? null,
        salesperson_name: (user?.name as string) || null,
        lead_type:        leadType,
        lead_items:       leadType === 'accessories' ? selectedItems : [],
      });
      notify('newLead', {
        type:    'lead',
        title:   tNotif('actions.newLead.title'),
        message: `${lead.name} ${tNotif('actions.newLead.interestedIn')} ${lead.bike}`,
        href:    '/sales/leads',
      });
      toast.success('Lead skapat!');
      if (leadType === 'accessories') {
        router.push(`/sales/leads/${lead.id}/payment`);
      } else {
        router.push('/sales/leads');
      }
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

            {/* Returning customer banner */}
            {returningCustomerId && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-8">
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                  {returningCustomerName[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-900">{returningCustomerName}</p>
                  <p className="text-xs text-blue-600">Befintlig kund — identitet hämtad från kundregistret</p>
                </div>
                <Link
                  href={`/customers/${returningCustomerId}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold shrink-0 underline"
                >
                  Visa profil →
                </Link>
              </div>
            )}

            {/* Identification tabs — hidden for returning customers */}
            {!returningCustomerId && (
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
            )}

            {/* BankID verified banner */}
            {bankIDData && !returningCustomerId && (
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

              {/* Identity fields — hidden when a returning customer is pre-selected */}
              {!returningCustomerId && (<>

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
                  onChange={e => { setFormData({ ...formData, email: e.target.value }); setFieldErrors(prev => ({ ...prev, email: undefined })); }}
                  onBlur={() => { if (formData.email && !isValidEmail(formData.email)) setFieldErrors(prev => ({ ...prev, email: 'Enter a valid email address (e.g. name@domain.com)' })); }}
                  className={fieldErrors.email ? 'w-full px-4 py-2.5 rounded-xl border border-red-400 bg-red-50 focus:outline-none text-sm' : inputCls(false, false)}
                  placeholder={t('newLead.placeholders.email')}
                  required
                />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('newLead.fields.phone')} <span className="text-red-400">*</span></label>
                  <AutoBadge type="manual" />
                </div>
                <PhoneInput
                  value={formData.phone}
                  onChange={v => { setFormData({ ...formData, phone: v }); setFieldErrors(prev => ({ ...prev, phone: undefined })); }}
                  placeholder={t('newLead.placeholders.phone')}
                  error={!!fieldErrors.phone}
                  required
                />
                {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-1" />

              </>)}

              {/* Lead type toggle */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Typ av köp</label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  {([
                    { id: 'motorcycle',  icon: '🏍',  label: 'Motorcykel'           },
                    { id: 'accessories', icon: '🛒', label: 'Tillbehör / Reservdelar' },
                  ] as { id: LeadType; icon: string; label: string }[]).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setLeadType(opt.id); setSelectedItems([]); setItemSearch(''); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-150 ${
                        leadType === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source row */}
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

              {/* Interest — only for motorcycle leads */}
              {leadType === 'motorcycle' && (
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
              )}

              {/* Selected accessories summary — only for accessories leads */}
              {leadType === 'accessories' && selectedItems.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Valda artiklar</label>
                  <div className="space-y-1.5">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                        <span className="text-xs text-slate-400 shrink-0">{item.itemType === 'acc' ? '🧤' : '🔧'}</span>
                        <span className="flex-1 text-xs font-medium text-slate-800 truncate">{item.brand} {item.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => changeQty(item.id, item.qty - 1)} className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold flex items-center justify-center transition-colors">−</button>
                          <span className="w-5 text-center text-xs font-bold text-slate-700">{item.qty}</span>
                          <button type="button" onClick={() => changeQty(item.id, item.qty + 1)} className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold flex items-center justify-center transition-colors">+</button>
                        </div>
                        <span className="text-xs font-semibold text-slate-600 w-20 text-right shrink-0">
                          {(item.price * item.qty).toLocaleString('sv-SE')} kr
                        </span>
                        <button type="button" onClick={() => changeQty(item.id, 0)} className="text-slate-300 hover:text-red-400 transition-colors ml-1 shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2 px-1">
                    <span className="text-xs text-slate-500">{selectedItems.reduce((s, i) => s + i.qty, 0)} artiklar</span>
                    <span className="text-sm font-bold text-slate-800">{selectedTotal.toLocaleString('sv-SE')} kr</span>
                  </div>
                </div>
              )}

              {/* Extra notes for accessories leads */}
              {leadType === 'accessories' && selectedItems.length === 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sök och välj artiklar →</label>
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center">
                    Använd panelen till höger för att välja tillbehör eller reservdelar
                  </p>
                </div>
              )}

              {/* Deal value + cost price side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('newLead.fields.dealValue')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={(leadType === 'accessories' && selectedTotal > 0 ? selectedTotal : formData.estimatedValue) || ''}
                      onChange={e => setFormData({ ...formData, estimatedValue: parseInt(e.target.value) || 0 })}
                      readOnly={leadType === 'accessories' && selectedTotal > 0}
                      className={`${inputCls(leadType === 'accessories' && selectedTotal > 0, leadType === 'accessories' && selectedTotal > 0)} pr-12`}
                      placeholder={t('newLead.placeholders.dealValue')}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium pointer-events-none">kr</span>
                  </div>
                  {leadType === 'accessories' && selectedTotal > 0 && (
                    <p className="text-[11px] mt-1 text-slate-400">Beräknat från valda artiklar</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Inköpspris
                    <span className="ml-1 text-[10px] font-normal text-slate-400">(valfri)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.costPrice || ''}
                      onChange={e => setFormData({ ...formData, costPrice: parseInt(e.target.value) || 0 })}
                      className={`${inputCls(false, false)} pr-12`}
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium pointer-events-none">kr</span>
                  </div>
                  {formData.costPrice > 0 && formData.estimatedValue > 0 && (
                    <p className={`text-[11px] mt-1 font-semibold ${
                      formData.estimatedValue - formData.costPrice >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      Marginal: {Math.round(((formData.estimatedValue - formData.costPrice) / formData.estimatedValue) * 100)}%
                    </p>
                  )}
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

            {/* Right panel: vehicle browser OR accessories/spare parts picker */}
            {leadType === 'accessories' ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    🛒 Tillbehör &amp; Reservdelar
                  </p>
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                    {allShopItems.length} artiklar
                  </span>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    placeholder="Sök artikel..."
                    className="w-full pl-7 pr-7 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                  />
                  {itemSearch && (
                    <button type="button" onClick={() => setItemSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-300 hover:bg-slate-400 text-white text-[10px] leading-none flex items-center justify-center">×</button>
                  )}
                </div>

                {allShopItems.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
                    <p className="text-2xl mb-2">📦</p>
                    <p className="text-xs text-slate-400 font-medium">Inga tillbehör eller reservdelar i lager</p>
                  </div>
                ) : filteredShopItems.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-5 text-center">
                    <p className="text-xs text-slate-400">Inga artiklar matchade &ldquo;{itemSearch}&rdquo;</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                    {filteredShopItems.map(item => {
                      const isSelected = selectedItems.some(s => s.id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItem(item)}
                          className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                            isSelected
                              ? 'border-[#FF6B2C] bg-[#FF6B2C]/5'
                              : 'border-transparent bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs shrink-0">{item.itemType === 'acc' ? '🧤' : '🔧'}</span>
                              <span className="text-xs font-bold text-slate-900 truncate">{item.brand} {item.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.stock === 0 ? (
                                <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Slut</span>
                              ) : (
                                <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{item.stock} st</span>
                              )}
                              {isSelected && (
                                <span className="text-[9px] font-bold text-[#FF6B2C] bg-[#FF6B2C]/10 px-1.5 py-0.5 rounded">✓</span>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.price.toLocaleString('sv-SE')} kr / st
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  Klicka för att lägga till · justera antal i formuläret
                </p>
              </div>
            ) : (
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
                          key={v.key}
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
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-slate-500">{v.price}</span>
                            {v.year > 0 && <span className="text-[10px] text-slate-400">{v.year}</span>}
                            {v.engineCC > 0 && <span className="text-[10px] text-slate-400">{v.engineCC} cc</span>}
                            {v.color && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full truncate max-w-30">
                                {v.color}
                              </span>
                            )}
                          </div>
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
                        key={v.key}
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
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {v.year > 0 && <span className="text-[10px] text-slate-400">{v.year}</span>}
                          {v.engineCC > 0 && <span className="text-[10px] text-slate-400">{v.engineCC} cc</span>}
                          {v.color && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full truncate max-w-30">
                              {v.color}
                            </span>
                          )}
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
            )}
          </div>
        </div>
      </div>

      {showBankID && (
        <BankIDModal
          mode="auth"
          action="auth"
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
