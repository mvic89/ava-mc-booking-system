'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import PhoneInput from '@/components/PhoneInput';
import type { BankIDResult } from '@/types';
import { createCustomer } from '@/lib/customers';
import { isValidEmail, isValidPhone } from '@/lib/validation';

const EXISTING_CUSTOMERS: Record<string, { id: number; name: string; lastSeen: string; vehicles: number; lifetimeValue: number; purchases: number }> = {
  '198506122384': { id: 1, name: 'Anna Svensson', lastSeen: '8 februari 2026', vehicles: 3, lifetimeValue: 445000, purchases: 5 },
};

type FlowStep = 'chooser' | 'scanning' | 'manual' | 'new' | 'returning' | 'protected';

const EMPTY_MANUAL = {
  firstName: '', lastName: '', personnummer: '',
  email: '', phone: '', address: '', postalCode: '',
  city: '', birthDate: '', gender: '', notes: '',
};

export default function NewCustomerPage() {
  const router = useRouter();
  const t = useTranslations('customers');
  const [ready, setReady] = useState(false);
  const [showBankID, setShowBankID] = useState(false);
  const [step, setStep] = useState<FlowStep>('chooser');
  const [bankIDResult, setBankIDResult] = useState<BankIDResult | null>(null);
  const [existingCustomer, setExistingCustomer] = useState<typeof EXISTING_CUSTOMERS[string] | null>(null);
  const [bankIDEmail, setBankIDEmail] = useState('');
  const [bankIDPhone, setBankIDPhone] = useState('');
  const [protectedPhone, setProtectedPhone] = useState('');
  const [protectedEmail, setProtectedEmail] = useState('');
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.push('/auth/login'); return; }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBankIDComplete = (result: BankIDResult) => {
    setShowBankID(false);
    setBankIDResult(result);
    const pnr = result.user.personalNumber.replace(/-/g, '');
    const existing = EXISTING_CUSTOMERS[pnr];
    if (result.roaring?.protectedIdentity) {
      setStep('protected');
    } else if (existing) {
      setExistingCustomer(existing);
      setStep('returning');
    } else {
      setStep('new');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (step === 'manual') {
      if (manual.email && !isValidEmail(manual.email)) errs.email = 'Enter a valid email address (e.g. name@domain.com)';
      if (manual.phone && !isValidPhone(manual.phone)) errs.phone = 'Enter a valid phone number (at least 7 digits)';
    } else if (step === 'new') {
      if (bankIDEmail && !isValidEmail(bankIDEmail)) errs.bankIDEmail = 'Enter a valid email address (e.g. name@domain.com)';
      if (bankIDPhone && !isValidPhone(bankIDPhone)) errs.bankIDPhone = 'Enter a valid phone number (at least 7 digits)';
    } else if (step === 'protected') {
      if (protectedEmail && !isValidEmail(protectedEmail)) errs.protectedEmail = 'Enter a valid email address (e.g. name@domain.com)';
      if (protectedPhone && !isValidPhone(protectedPhone)) errs.protectedPhone = 'Enter a valid phone number (at least 7 digits)';
    }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    try {
      if (step === 'manual') {
        await createCustomer({
          firstName: manual.firstName,
          lastName: manual.lastName,
          personnummer: manual.personnummer || '',
          email: manual.email,
          phone: manual.phone,
          address: manual.address || '',
          postalCode: manual.postalCode || '',
          city: manual.city || '',
          birthDate: manual.birthDate || '',
          gender: manual.gender === 'Kvinna' ? 'Kvinna' : 'Man',
          source: 'Manual',
          tag: 'New',
          bankidVerified: false,
          protectedIdentity: false,
          lifetimeValue: 0,
          lastActivity: new Date().toISOString(),
          customerSince: '',
          riskLevel: 'low',
          citizenship: '',
          deceased: false,
          vehicles: 0,
          notes: manual.notes || undefined,
        });
      } else if (step === 'new' && bankIDResult) {
        const r = bankIDResult.roaring;
        await createCustomer({
          firstName: bankIDResult.user.givenName || bankIDResult.user.name.split(' ')[0],
          lastName: bankIDResult.user.surname || bankIDResult.user.name.split(' ').slice(1).join(' '),
          personnummer: bankIDResult.user.personalNumber.replace(/-/g, ''),
          email: bankIDEmail,
          phone: bankIDPhone,
          address: r?.address?.street || '',
          postalCode: r?.address?.postalCode || '',
          city: r?.address?.city || '',
          birthDate: bankIDResult.user.dateOfBirth || '',
          gender: r?.gender === 'F' ? 'Kvinna' : 'Man',
          source: 'BankID',
          tag: 'New',
          bankidVerified: true,
          protectedIdentity: false,
          lifetimeValue: 0,
          lastActivity: new Date().toISOString(),
          customerSince: '',
          riskLevel: 'low',
          citizenship: '',
          deceased: false,
          vehicles: 0,
        });
      } else if (step === 'protected' && bankIDResult) {
        const pnr = bankIDResult.user.personalNumber.replace(/-/g, '');
        await createCustomer({
          firstName: bankIDResult.user.givenName || '',
          lastName: bankIDResult.user.surname || '',
          personnummer: pnr,
          email: protectedEmail,
          phone: protectedPhone,
          address: '',
          postalCode: '',
          city: '',
          birthDate: bankIDResult.user.dateOfBirth || '',
          gender: 'Man',
          source: 'BankID',
          tag: 'New',
          bankidVerified: true,
          protectedIdentity: true,
          lifetimeValue: 0,
          lastActivity: new Date().toISOString(),
          customerSince: '',
          riskLevel: 'low',
          citizenship: '',
          deceased: false,
          vehicles: 0,
        });
      }
      toast.success(t('new.savedToast'), { description: t('new.savedToastDesc') });
      router.push('/customers');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('DUPLICATE_CUSTOMER:')) {
        const parts    = msg.split(':');
        const existId  = parts[1];
        const existName = parts.slice(2).join(':').trim();
        toast.error(
          existName ? `${existName} finns redan i systemet` : 'Kunden finns redan i systemet',
          {
            description: 'En kund med detta personnummer är redan registrerad.',
            duration:    8000,
            action: existId && existId !== 'unknown'
              ? { label: 'Visa kund →', onClick: () => router.push(`/customers/${existId}`) }
              : undefined,
          },
        );
      } else {
        toast.error('Kunde inte spara kunden', { description: msg });
      }
    }
  };

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pnrFormatted = bankIDResult
    ? bankIDResult.user.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')
    : '';
  const roaring = bankIDResult?.roaring;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Breadcrumb */}
        <div className="px-8 pt-5 pb-0">
          <div className="text-xs text-slate-400">
            <button onClick={() => router.push('/customers')} className="hover:text-[#FF6B2C] transition-colors">Customers</button>
            <span className="mx-1.5">→</span>
            <span className="text-slate-700">{t('new.breadcrumb')}</span>
          </div>
        </div>

        {/* ── CHOOSER ── */}
        {step === 'chooser' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-up">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('new.title')}</h1>
            <p className="text-sm text-slate-500 mb-8">{t('new.subtitle')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-xl">
              {/* BankID option */}
              <button
                onClick={() => { setStep('scanning'); setShowBankID(true); }}
                className="group bg-white rounded-2xl border-2 border-slate-200 hover:border-[#235971] p-7 text-left transition-all hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-[#235971] flex items-center justify-center mb-4">
                  <span className="text-white font-extrabold text-xs leading-tight text-center">Bank<br/>ID</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-1">{t('new.bankIDOption.title')}</h2>
                <p className="text-sm text-slate-500">{t('new.bankIDOption.desc')}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="text-[10px] bg-[#235971]/10 text-[#235971] font-semibold px-2 py-0.5 rounded-full">{t('new.bankIDOption.verifiedTag')}</span>
                  <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">{t('new.bankIDOption.autoFillTag')}</span>
                </div>
              </button>

              {/* Manual option */}
              <button
                onClick={() => setStep('manual')}
                className="group bg-white rounded-2xl border-2 border-slate-200 hover:border-[#FF6B2C] p-7 text-left transition-all hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center mb-4">
                  <span className="text-2xl">✏️</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-1">{t('new.manualOption.title')}</h2>
                <p className="text-sm text-slate-500">{t('new.manualOption.desc')}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">{t('new.manualOption.unverifiedTag')}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{t('new.manualOption.allManualTag')}</span>
                </div>
              </button>
            </div>

            <button onClick={() => router.push('/customers')} className="mt-8 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              {t('new.cancel')}
            </button>
          </div>
        )}

        {/* ── SCANNING (BankID QR) ── */}
        {step === 'scanning' && (
          <div className="flex-1 flex items-start justify-center gap-8 p-8 animate-fade-up">
            <div className="bg-white rounded-2xl border border-slate-100 p-8 w-full max-w-md text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#235971] mx-auto flex items-center justify-center mb-4">
                <span className="text-white font-extrabold text-sm leading-tight">Bank<br/>ID</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">{t('new.scanning.title')}</h2>
              <p className="text-sm text-slate-500 mb-6">{t('new.scanning.subtitle')}</p>
              <div className="bg-slate-100 rounded-xl h-52 flex items-center justify-center mb-4 mx-auto w-52">
                <div className="text-center text-slate-400">
                  <div className="text-4xl mb-2">📱</div>
                  <div className="text-xs whitespace-pre-line">{t('new.scanning.clickStart')}</div>
                </div>
              </div>
              <p className="text-xs text-[#235971] mb-4">{t('new.scanning.qrAutoUpdate')}</p>
              <button onClick={() => setShowBankID(true)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-3 rounded-xl mb-2 transition-colors">
                {t('new.scanning.startBankID')}
              </button>
              <button className="w-full bg-[#235971] hover:bg-[#1a4557] text-white text-sm font-medium py-3 rounded-xl mb-3 transition-colors">
                {t('new.scanning.openOnDevice')}
              </button>
              <div className="flex items-center justify-center gap-4 mt-2">
                <button onClick={() => setStep('chooser')} className="text-slate-400 text-sm hover:text-slate-600 transition-colors">
                  {t('new.scanning.back')}
                </button>
                <span className="text-slate-200">|</span>
                <button onClick={() => setStep('manual')} className="text-[#FF6B2C] text-sm hover:underline transition-colors">
                  {t('new.scanning.useManual')}
                </button>
              </div>
            </div>

            {/* Info panel */}
            <div className="w-80 space-y-4 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-4">{t('new.scanning.howItWorks')}</h3>
                {[
                  { n: 1, title: t('new.scanning.step1Title'), desc: t('new.scanning.step1Desc'), color: 'bg-[#235971]' },
                  { n: 2, title: t('new.scanning.step2Title'), desc: t('new.scanning.step2Desc'), color: 'bg-green-600' },
                  { n: 3, title: t('new.scanning.step3Title'), desc: t('new.scanning.step3Desc'), color: 'bg-[#FF6B2C]' },
                  { n: 4, title: t('new.scanning.step4Title'), desc: t('new.scanning.step4Desc'), color: 'bg-slate-400' },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3 mb-3 last:mb-0">
                    <div className={`w-6 h-6 rounded-full ${s.color} text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}>{s.n}</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                      <div className="text-xs text-slate-500">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">{t('new.scanning.dataSources')}</h3>
                {[
                  { color: 'bg-[#235971]', label: t('new.scanning.source1') },
                  { color: 'bg-green-500', label: t('new.scanning.source2') },
                  { color: 'bg-[#FF6B2C]',  label: t('new.scanning.source3') },
                ].map(d => (
                  <div key={d.label} className="flex items-start gap-2 mb-2 last:mb-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${d.color} shrink-0 mt-1`} />
                    <div className="text-xs text-slate-600">{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MANUAL ENTRY ── */}
        {step === 'manual' && (
          <div className="flex-1 p-8 animate-fade-up">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-xl">✏️</div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{t('new.manual.title')}</h1>
                  <p className="text-xs text-slate-500">{t('new.manual.subtitle')}</p>
                </div>
                <button
                  onClick={() => { setStep('scanning'); setShowBankID(true); }}
                  className="ml-auto text-xs text-[#235971] border border-[#235971] px-3 py-1.5 rounded-lg hover:bg-[#235971] hover:text-white transition-colors font-medium"
                >
                  {t('new.manual.useBankIDInstead')}
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                {/* Name row */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('new.manual.personalInfo')}</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('profile.fields.firstName')} *</label>
                      <input
                        type="text"
                        value={manual.firstName}
                        onChange={e => setManual(m => ({ ...m, firstName: e.target.value }))}
                        placeholder="Erik"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('profile.fields.lastName')} *</label>
                      <input
                        type="text"
                        value={manual.lastName}
                        onChange={e => setManual(m => ({ ...m, lastName: e.target.value }))}
                        placeholder="Lindgren"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('profile.fields.personalNumber')}</label>
                      <input
                        type="text"
                        value={manual.personnummer}
                        onChange={e => setManual(m => ({ ...m, personnummer: e.target.value }))}
                        placeholder="YYYYMMDD-XXXX"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('profile.fields.birthDate')}</label>
                      <input
                        type="date"
                        value={manual.birthDate}
                        onChange={e => setManual(m => ({ ...m, birthDate: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('profile.fields.gender')}</label>
                    <div className="flex gap-3">
                      {[t('new.manual.genderMale'), t('new.manual.genderFemale'), t('new.manual.genderOther')].map(g => (
                        <label key={g} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="gender"
                            value={g}
                            checked={manual.gender === g}
                            onChange={() => setManual(m => ({ ...m, gender: g }))}
                            className="accent-[#FF6B2C]"
                          />
                          <span className="text-sm text-slate-700">{g}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('new.manual.contact')}</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('profile.fields.email')} *</label>
                      <input
                        type="email"
                        value={manual.email}
                        onChange={e => { setManual(m => ({ ...m, email: e.target.value })); setFieldErrors(p => ({ ...p, email: '' })); }}
                        onBlur={() => { if (manual.email && !isValidEmail(manual.email)) setFieldErrors(p => ({ ...p, email: 'Enter a valid email address (e.g. name@domain.com)' })); }}
                        placeholder="kund@example.se"
                        className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-1 ${fieldErrors.email ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400' : 'border-slate-200 focus:border-[#FF6B2C] focus:ring-[#FF6B2C]'}`}
                        required
                      />
                      {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('profile.fields.phone')} *</label>
                      <PhoneInput
                        value={manual.phone}
                        onChange={v => { setManual(m => ({ ...m, phone: v })); setFieldErrors(p => ({ ...p, phone: '' })); }}
                        error={!!fieldErrors.phone}
                        required
                      />
                      {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('new.manual.addressSection')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('new.manual.streetAddress')}</label>
                      <input
                        type="text"
                        value={manual.address}
                        onChange={e => setManual(m => ({ ...m, address: e.target.value }))}
                        placeholder="Storgatan 12"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('new.manual.postalCode')}</label>
                        <input
                          type="text"
                          value={manual.postalCode}
                          onChange={e => setManual(m => ({ ...m, postalCode: e.target.value }))}
                          placeholder="115 41"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('new.manual.city')}</label>
                        <input
                          type="text"
                          value={manual.city}
                          onChange={e => setManual(m => ({ ...m, city: e.target.value }))}
                          placeholder="Stockholm"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('new.manual.notesSection')}</h2>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('new.manual.notesLabel')}</label>
                    <textarea
                      value={manual.notes}
                      onChange={e => setManual(m => ({ ...m, notes: e.target.value }))}
                      placeholder={t('new.manual.notesPlaceholder')}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Warning + submit */}
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-800">
                    {t('new.manual.warningNotVerified')}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('chooser')}
                    className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium py-3 rounded-xl transition-colors"
                  >
                    {t('new.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    {t('new.manual.saveCustomer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── NEW CUSTOMER (post-BankID auto-fill) ── */}
        {step === 'new' && bankIDResult && (
          <div className="flex-1 animate-fade-up">
            <div className="bg-green-50 border-b border-green-200 px-8 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-green-900">
                ✅ Identifierad via BankID — {bankIDResult.user.name} ({bankIDResult.user.dateOfBirth || pnrFormatted.slice(0, 10)})
              </span>
              <span className="text-xs text-green-700">{t('new.bankIDFlow.identifiedBannerSub')}</span>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 gap-0">
              <div className="flex-1 p-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">{t('new.bankIDFlow.autoFilledTitle')}</h1>
                <p className="text-sm text-slate-500 mb-6">{t('new.bankIDFlow.autoFilledSubtitle')}</p>

                <form onSubmit={handleSave} className="space-y-6">
                  {/* BankID section */}
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                    <div className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded inline-block mb-4">{t('new.bankIDFlow.verifiedSection')}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.firstName')} <span className="ml-1 text-[10px] bg-[#235971] text-white px-1.5 py-0.5 rounded">BankID</span></label>
                        <input value={bankIDResult.user.givenName || bankIDResult.user.name.split(' ')[0]} disabled className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm text-slate-700" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.lastName')} <span className="ml-1 text-[10px] bg-[#235971] text-white px-1.5 py-0.5 rounded">BankID</span></label>
                        <input value={bankIDResult.user.surname || bankIDResult.user.name.split(' ').slice(1).join(' ')} disabled className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm text-slate-700" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.personalNumber')} <span className="ml-1 text-[10px] bg-[#235971] text-white px-1.5 py-0.5 rounded">BankID</span></label>
                      <input value={pnrFormatted} disabled className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm text-slate-700" />
                    </div>
                  </div>

                  {/* Roaring section */}
                  <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                    <div className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded inline-block mb-4">{t('new.bankIDFlow.roaringSection')}</div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.address')} <span className="ml-1 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">Folkbokföring</span></label>
                        <input value={roaring?.address?.street || t('new.bankIDFlow.unavailable')} disabled className="w-full px-3 py-2 rounded-lg border border-green-200 bg-white text-sm text-slate-700" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('new.manual.postalCode')} <span className="ml-1 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">SPAR</span></label>
                          <input value={roaring?.address?.postalCode || ''} disabled className="w-full px-3 py-2 rounded-lg border border-green-200 bg-white text-sm text-slate-700" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('new.manual.city')} <span className="ml-1 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">SPAR</span></label>
                          <input value={roaring?.address?.city || ''} disabled className="w-full px-3 py-2 rounded-lg border border-green-200 bg-white text-sm text-slate-700" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.birthDate')} <span className="ml-1 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">SPAR</span></label>
                          <input value={bankIDResult.user.dateOfBirth || pnrFormatted.slice(0, 10)} disabled className="w-full px-3 py-2 rounded-lg border border-green-200 bg-white text-sm text-slate-700" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.gender')} <span className="ml-1 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">SPAR</span></label>
                          <input value={roaring?.gender === 'M' ? t('new.bankIDFlow.male') : roaring?.gender === 'F' ? t('new.bankIDFlow.female') : ''} disabled className="w-full px-3 py-2 rounded-lg border border-green-200 bg-white text-sm text-slate-700" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manual */}
                  <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
                    <div className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded inline-block mb-4">{t('new.bankIDFlow.manualSection')}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.email')} *</label>
                        <input type="email" value={bankIDEmail}
                          onChange={e => { setBankIDEmail(e.target.value); setFieldErrors(p => ({ ...p, bankIDEmail: '' })); }}
                          onBlur={() => { if (bankIDEmail && !isValidEmail(bankIDEmail)) setFieldErrors(p => ({ ...p, bankIDEmail: 'Enter a valid email address' })); }}
                          placeholder="kund@example.se"
                          className={`w-full px-3 py-2 rounded-lg border-2 bg-white text-sm outline-none ${fieldErrors.bankIDEmail ? 'border-red-400' : 'border-dashed border-orange-300 focus:border-[#FF6B2C]'}`}
                          required />
                        {fieldErrors.bankIDEmail && <p className="mt-1 text-xs text-red-500">{fieldErrors.bankIDEmail}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.phone')} *</label>
                        <PhoneInput
                          value={bankIDPhone}
                          onChange={v => { setBankIDPhone(v); setFieldErrors(p => ({ ...p, bankIDPhone: '' })); }}
                          error={!!fieldErrors.bankIDPhone}
                          className="rounded-lg border-2 border-dashed border-orange-300 focus-within:border-[#FF6B2C] transition-all"
                          inputClassName="py-2 bg-white"
                          required
                        />
                        {fieldErrors.bankIDPhone && <p className="mt-1 text-xs text-red-500">{fieldErrors.bankIDPhone}</p>}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-[#FF6B2C] hover:bg-[#e55a1f] text-white font-semibold py-3.5 rounded-xl transition-colors">
                    {t('new.bankIDFlow.saveCustomer')}
                  </button>
                </form>
              </div>

              {/* Summary panel */}
              <div className="lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">{t('new.summary.title')}</h3>
                  <div className="space-y-3">
                    {[
                      { color: 'bg-[#235971]', label: t('new.summary.bankidVerified'), sub: t('new.summary.bankidSub'), count: 3 },
                      { color: 'bg-green-500', label: t('new.summary.roaringData'), sub: t('new.summary.roaringSub'), count: roaring ? 5 : 0 },
                      { color: 'bg-[#FF6B2C]', label: t('new.summary.manualInput'), sub: t('new.summary.manualSub'), count: 2 },
                    ].map(s => (
                      <div key={s.label} className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0 mt-1`} />
                          <div>
                            <div className="text-xs font-semibold text-slate-700">{s.label}</div>
                            <div className="text-[11px] text-slate-400">{s.sub}</div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-500 shrink-0">{t('new.summary.fields', { count: s.count })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="text-xs text-slate-500 mb-1">{t('new.summary.autoFilled')}</div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '80%' }} />
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">{t('new.summary.bankidVerification')}</h3>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-400">{t('new.summary.signatureLabel')}</span><span>{t('new.summary.signatureStored')}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('new.summary.ocspLabel')}</span><span>{t('new.summary.ocspStored')}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('new.summary.riskLabel')}</span><span className="text-green-600 font-semibold">{t('new.summary.riskLow')}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">{t('new.summary.ipLabel')}</span><span>{bankIDResult.device?.ipAddress || '127.0.0.1'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── RETURNING CUSTOMER ── */}
        {step === 'returning' && bankIDResult && existingCustomer && (
          <div className="flex-1 p-8 animate-fade-up">
            <div className="max-w-3xl mx-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 mb-6">
                <div className="text-base font-bold text-blue-900">🎉 {bankIDResult.user.name}</div>
                <div className="text-xs text-blue-700 mt-0.5">{t('new.returning.identified', { date: existingCustomer.lastSeen })}</div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-[#0b1524] text-white font-bold text-lg flex items-center justify-center">
                      {bankIDResult.user.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{bankIDResult.user.name}</span>
                        <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">VIP</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{pnrFormatted}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center border-t border-slate-100 pt-4">
                    {[
                      { val: existingCustomer.vehicles, label: t('new.returning.vehicles') },
                      { val: `${Math.round(existingCustomer.lifetimeValue / 1000)}k`, label: t('new.returning.lifetimeValue') },
                      { val: existingCustomer.purchases, label: t('new.returning.purchases') },
                      { val: '0', label: t('new.returning.outstanding') },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="text-lg font-bold text-slate-900">{s.val}</div>
                        <div className="text-[11px] text-slate-400">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">{t('new.returning.quickActions')}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">{t('new.returning.newQuote')}</button>
                    <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors">{t('new.returning.createLead')}</button>
                    <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors">{t('new.returning.bookTestRide')}</button>
                    <button onClick={() => router.push(`/customers/${existingCustomer.id}`)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors">{t('new.returning.viewProfile')}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROTECTED IDENTITY ── */}
        {step === 'protected' && bankIDResult && (
          <div className="flex-1 animate-fade-up">
            <div className="bg-red-50 border-b border-red-200 px-8 py-3 flex items-center gap-3">
              <span className="text-lg">🛡️</span>
              <div>
                <div className="text-sm font-bold text-red-900">{t('new.protected.bannerTitle')}</div>
                <div className="text-xs text-red-700">{t('new.protected.bannerDesc')}</div>
              </div>
            </div>
            <div className="p-8 max-w-2xl">
              <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('new.protected.title')}</h1>
              <form onSubmit={handleSave} className="space-y-5">
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                  <div className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded inline-block mb-4">{t('new.bankIDFlow.verifiedSection')}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.firstName')}</label>
                      <input value={bankIDResult.user.givenName || ''} disabled className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.lastName')}</label>
                      <input value={bankIDResult.user.surname || ''} disabled className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm" />
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-300 p-4">
                  <div className="text-xs font-bold text-red-700">{t('new.protected.addressBlocked')}</div>
                  <p className="text-xs text-red-600 mt-1">{t('new.protected.addressBlockedDesc')}</p>
                </div>
                <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
                  <div className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded inline-block mb-4">{t('new.bankIDFlow.manualSection')}</div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.email')}</label>
                        <input type="email" value={protectedEmail}
                          onChange={e => { setProtectedEmail(e.target.value); setFieldErrors(p => ({ ...p, protectedEmail: '' })); }}
                          onBlur={() => { if (protectedEmail && !isValidEmail(protectedEmail)) setFieldErrors(p => ({ ...p, protectedEmail: 'Enter a valid email address' })); }}
                          placeholder="e-post@example.se"
                          className={`w-full px-3 py-2 rounded-lg border-2 bg-white text-sm outline-none ${fieldErrors.protectedEmail ? 'border-red-400' : 'border-dashed border-orange-300 focus:border-[#FF6B2C]'}`}
                          required />
                        {fieldErrors.protectedEmail && <p className="mt-1 text-xs text-red-500">{fieldErrors.protectedEmail}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('profile.fields.phone')}</label>
                        <PhoneInput
                          value={protectedPhone}
                          onChange={v => { setProtectedPhone(v); setFieldErrors(p => ({ ...p, protectedPhone: '' })); }}
                          error={!!fieldErrors.protectedPhone}
                          className="rounded-lg border-2 border-dashed border-orange-300 focus-within:border-[#FF6B2C] transition-all"
                          inputClassName="py-2 bg-white"
                          required
                        />
                        {fieldErrors.protectedPhone && <p className="mt-1 text-xs text-red-500">{fieldErrors.protectedPhone}</p>}
                      </div>
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" required className="w-4 h-4 accent-[#FF6B2C] rounded" />
                  <span className="text-sm text-slate-600">{t('new.protected.confirmCheckbox')}</span>
                </label>
                <button type="submit" className="w-full bg-[#FF6B2C] hover:bg-[#e55a1f] text-white font-semibold py-3.5 rounded-xl transition-colors">
                  {t('new.bankIDFlow.saveCustomer')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {showBankID && (
        <BankIDModal
          mode="auth"
          action="verify_identity"
          title={t('new.scanning.title')}
          subtitle={t('new.scanning.subtitle')}
          onComplete={handleBankIDComplete}
          onCancel={() => { setShowBankID(false); setStep('chooser'); }}
          autoStart
        />
      )}
    </div>
  );
}
