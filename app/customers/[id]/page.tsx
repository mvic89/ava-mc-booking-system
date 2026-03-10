'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealerInfo } from '@/lib/dealer';

type ProfileTab = 'overview' | 'vehicles' | 'invoices' | 'documents' | 'timeline' | 'gdpr';
type SourceBadge = 'BankID' | 'Folkbokföring' | 'Manuell';

const BADGE: Record<SourceBadge, string> = {
  BankID:        'bg-[#235971] text-white',
  Folkbokföring: 'bg-green-600 text-white',
  Manuell:       'bg-[#FF6B2C] text-white',
};

function SourceTag({ src }: { src: SourceBadge }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${BADGE[src]}`}>{src}</span>
  );
}

const MOCK_DB: Record<string, any> = {
  '1': {
    id: 1,
    firstName: 'Anna', lastName: 'Svensson',
    personnummer: '19850612-XXXX',
    email: 'anna@svensson.se', phone: '070-555 1234',
    address: 'Vasagatan 8, 111 20 Stockholm',
    birthDate: '1985-06-12',
    gender: 'Kvinna',
    citizenship: 'Svensk',
    protectedIdentity: false,
    bankidVerified: true,
    tag: 'VIP',
    customerSince: 'jun 2021',
    lastBankID: '8 feb 2026 kl 14:32',
    risk: 'Låg',
    totalSpent: 445000,
    vehiclesOwned: '3 (2 aktiva, 1 såld)',
    outstanding: 0,
    nps: '9/10',
    vehicles: [
      { name: 'Kawasaki Ninja ZX-6R', year: 2024, plate: 'ABC 123', status: 'Aktiv' },
      { name: 'Yamaha MT-07',          year: 2022, plate: 'DEF 456', status: 'Aktiv' },
      { name: 'Honda CB500F',          year: 2020, plate: 'GHI 789', status: 'Såld'  },
    ],
    invoices: [
      { id: 'INV-2026-001', desc: 'Kawasaki Ninja ZX-6R',    amount: 133280, date: '8 feb 2026',   status: 'Betald' },
      { id: 'INV-2023-042', desc: 'Yamaha MT-07',             amount: 89900,  date: '15 mar 2023', status: 'Betald' },
      { id: 'INV-2021-018', desc: 'Honda CB500F + tillbehör', amount: 115400, date: '2 jun 2021',  status: 'Betald' },
      { id: 'INV-2020-009', desc: 'Service Ninja ZX-6R',      amount: 3800,   date: '5 dec 2023',  status: 'Betald' },
      { id: 'INV-2023-099', desc: 'Tillbehör & skydd',        amount: 12620,  date: '20 jan 2024', status: 'Betald' },
    ],
    bankidHistory: [
      { date: '8 feb 2026, 14:32', action: 'Identifiering — Risk: Låg',        status: 'Godkänd' },
      { date: '8 feb 2026, 14:45', action: 'Signering köpeavtal — Risk: Låg',  status: 'Godkänd' },
      { date: '15 mar 2023, 10:12', action: 'Identifiering — Risk: Låg',       status: 'Godkänd' },
    ],
    timeline: [
      { date: '8 feb', event: '🔒 BankID-identifiering genomförd (risk: låg)' },
      { date: '8 feb', event: '🏍 Köpte Kawasaki Ninja ZX-6R — 133,280 kr' },
      { date: '8 feb', event: '📄 Köpeavtal signerat med BankID' },
      { date: '8 feb', event: '🎉 Leverans genomförd' },
      { date: '15 mar 2023', event: '🔒 BankID-identifiering + Yamaha MT-07 köp' },
    ],
  },
  '2': {
    id: 2, firstName: 'Erik', lastName: 'Lindgren',
    personnummer: '19900315-XXXX',
    email: 'erik@lindgren.se', phone: '073-888 9012',
    address: 'Storgatan 12, 115 41 Stockholm',
    birthDate: '1990-03-15', gender: 'Man', citizenship: 'Svensk',
    protectedIdentity: false, bankidVerified: true, tag: 'Active',
    customerSince: 'jan 2023', lastBankID: '6 feb 2026 kl 09:14', risk: 'Låg',
    totalSpent: 256400, vehiclesOwned: '2 (2 aktiva)', outstanding: 0, nps: '8/10',
    vehicles: [
      { name: 'Kawasaki Z900', year: 2023, plate: 'JKL 012', status: 'Aktiv' },
      { name: 'Honda CB650R', year: 2021, plate: 'MNO 345', status: 'Aktiv' },
    ],
    invoices: [
      { id: 'INV-2023-055', desc: 'Kawasaki Z900', amount: 128000, date: '10 jan 2023', status: 'Betald' },
      { id: 'INV-2021-031', desc: 'Honda CB650R',  amount: 105000, date: '5 apr 2021',  status: 'Betald' },
    ],
    bankidHistory: [
      { date: '6 feb 2026, 09:14', action: 'Identifiering — Risk: Låg', status: 'Godkänd' },
    ],
    timeline: [
      { date: '6 feb 2026', event: '🔒 BankID-identifiering genomförd' },
      { date: '10 jan 2023', event: '🏍 Köpte Kawasaki Z900 — 128,000 kr' },
    ],
  },
};

// Fill in remaining mock customers
for (let i = 3; i <= 10; i++) {
  const names: Record<number, [string, string]> = {
    3: ['Lars', 'Bergman'], 4: ['Anders', 'Nilsson'], 5: ['Maria', 'Dahl'],
    6: ['Karl', 'Eriksson'], 7: ['Sofia', 'Holm'], 8: ['Jonas', 'Berg'],
    9: ['Petra', 'Johansson'], 10: ['Marcus', 'Lindqvist'],
  };
  const [fn, ln] = names[i];
  MOCK_DB[String(i)] = {
    id: i, firstName: fn, lastName: ln,
    personnummer: i % 2 === 0 ? `19${70 + i}0${i}15-XXXX` : '',
    email: `${fn.toLowerCase()}@example.se`, phone: `07${i}-000 ${1000 + i}`,
    address: 'Exempelgatan 1, 100 00 Stockholm',
    birthDate: '', gender: i % 2 === 0 ? 'Man' : 'Kvinna', citizenship: 'Svensk',
    protectedIdentity: i === 4, bankidVerified: i % 2 === 0, tag: 'Active',
    customerSince: 'jan 2024', lastBankID: '—', risk: 'Låg',
    totalSpent: 0, vehiclesOwned: '0', outstanding: 0, nps: '—',
    vehicles: [], invoices: [], bankidHistory: [], timeline: [],
  };
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const t = useTranslations('customers');

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [dealerEmail, setDealerEmail] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.push('/auth/login'); return; }
    setDealerEmail(getDealerInfo().email);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = MOCK_DB[id];

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!c) return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-xl font-bold text-slate-900">{t('profile.notFound')}</h2>
          <button onClick={() => router.push('/customers')} className="mt-4 text-[#FF6B2C] text-sm hover:underline">
            {t('profile.backToCustomers')}
          </button>
        </div>
      </div>
    </div>
  );

  const PROFILE_TABS: { id: ProfileTab; label: string; count?: number }[] = [
    { id: 'overview',   label: t('profile.tabs.overview') },
    { id: 'vehicles',   label: t('profile.tabs.vehicles'),  count: c.vehicles.length },
    { id: 'invoices',   label: t('profile.tabs.invoices'),  count: c.invoices.length },
    { id: 'documents',  label: t('profile.tabs.documents') },
    { id: 'timeline',   label: t('profile.tabs.timeline') },
    { id: 'gdpr',       label: t('profile.tabs.gdpr') },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Profile header card */}
        <div className="bg-white border-b border-slate-100 px-5 md:px-8 pt-6 pb-0 animate-fade-up">
          {/* Breadcrumb */}
          <div className="text-xs text-slate-400 mb-4">
            <button onClick={() => router.push('/customers')} className="hover:text-[#FF6B2C] transition-colors">{t('title')}</button>
            <span className="mx-1.5">→</span>
            <span className="text-slate-700">{c.firstName} {c.lastName}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-[#0b1524] text-white font-bold text-xl flex items-center justify-center shrink-0">
                {c.firstName[0]}{c.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900">{c.firstName} {c.lastName}</h1>
                  {c.bankidVerified && (
                    <span className="text-[11px] bg-[#235971] text-white px-2 py-0.5 rounded font-bold">🔒 BankID</span>
                  )}
                  {c.tag === 'VIP' && (
                    <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">VIP</span>
                  )}
                  {c.protectedIdentity && (
                    <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">🛡️ {t('profile.fields.protectedIdentity')}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                  <span>📞 {c.phone} <SourceTag src="Manuell" /></span>
                  <span>✉ {c.email} <SourceTag src="Manuell" /></span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                  {!c.protectedIdentity && c.address && (
                    <span>📍 {c.address} <SourceTag src="Folkbokföring" /></span>
                  )}
                  {c.personnummer && (
                    <span>Personnr: {c.personnummer} <SourceTag src="BankID" /></span>
                  )}
                </div>
                {c.bankidVerified && (
                  <div className="text-[11px] text-slate-400 mt-1">
                    Senaste BankID-verifiering: {c.lastBankID} • Risk: {c.risk} • Kund sedan: {c.customerSince}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                {t('profile.actions.newQuote')}
              </button>
              <button className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                {t('profile.actions.gdprExport')}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto">
            {PROFILE_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'border-[#FF6B2C] text-[#FF6B2C]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === t.id ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]' : 'bg-slate-100 text-slate-500'
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 px-5 md:px-8 py-6 animate-fade-up">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact info */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-4">{t('profile.contactInfo')}</h2>
                <div className="space-y-3">
                  {[
                    { label: t('profile.fields.firstName'),     value: c.firstName,       src: 'BankID'        as SourceBadge },
                    { label: t('profile.fields.lastName'),      value: c.lastName,        src: 'BankID'        as SourceBadge },
                    { label: t('profile.fields.personalNumber'),value: c.personnummer || '—', src: 'BankID'   as SourceBadge },
                    { label: t('profile.fields.address'),       value: c.protectedIdentity ? t('profile.fields.protectedAddressNote') : (c.address || '—'), src: 'Folkbokföring' as SourceBadge },
                    { label: t('profile.fields.birthDate'),     value: c.birthDate || '—', src: 'Folkbokföring' as SourceBadge },
                    { label: t('profile.fields.email'),         value: c.email,           src: 'Manuell'       as SourceBadge },
                    { label: t('profile.fields.phone'),         value: c.phone,           src: 'Manuell'       as SourceBadge },
                    { label: t('profile.fields.gender'),        value: c.gender || '—',   src: 'Folkbokföring' as SourceBadge },
                    { label: t('profile.fields.citizenship'),   value: c.citizenship,     src: 'Folkbokföring' as SourceBadge },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-400 w-36 shrink-0">{row.label}</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm text-slate-800 truncate">{row.value}</span>
                        <SourceTag src={row.src} />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                    <span className="text-sm text-slate-400 w-36">{t('profile.fields.protectedIdentity')}</span>
                    <span className={`text-sm font-semibold ${c.protectedIdentity ? 'text-red-600' : 'text-green-600'}`}>
                      {c.protectedIdentity ? t('profile.fields.yes') : t('profile.fields.no')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* BankID history */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h2 className="text-sm font-bold text-slate-900 mb-4">{t('profile.bankidHistory')}</h2>
                  {c.bankidHistory.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('profile.noBankIDHistory')}</p>
                  ) : (
                    <div className="space-y-3">
                      {c.bankidHistory.map((h: any, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs text-slate-400">{h.date}</div>
                            <div className="text-sm text-slate-700">{h.action}</div>
                          </div>
                          <span className="text-[11px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded shrink-0">
                            {h.status}
                          </span>
                        </div>
                      ))}
                      {c.bankidHistory.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-2">Signatur + OCSP lagrad för varje verifiering (rättsligt bevis)</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h2 className="text-sm font-bold text-slate-900 mb-4">{t('profile.stats')}</h2>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Total spent', value: c.totalSpent > 0 ? `${c.totalSpent.toLocaleString('sv-SE')} kr` : '0 kr' },
                      { label: 'Fordon ägda',  value: c.vehiclesOwned },
                      { label: 'Utestående',   value: c.outstanding > 0 ? `${c.outstanding.toLocaleString('sv-SE')} kr` : '0 kr' },
                      { label: 'NPS Score',    value: c.nps },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{s.label}:</span>
                        <span className={`text-sm font-bold ${s.label === 'NPS Score' ? 'text-[#FF6B2C]' : 'text-slate-900'}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <h2 className="text-sm font-bold text-slate-900 mb-4">{t('profile.recentActivity')}</h2>
                  {c.timeline.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('profile.noActivity')}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {c.timeline.map((t: any, i: number) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-xs text-slate-400 w-20 shrink-0 pt-0.5">{t.date}</span>
                          <span className="text-sm text-slate-700">{t.event}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data sources legend */}
              <div className="lg:col-span-2 flex items-center gap-6">
                <span className="text-xs text-slate-400">{t('profile.dataSources')}</span>
                {([t('profile.dataSourceLabels.bankid'), t('profile.dataSourceLabels.roaring'), t('profile.dataSourceLabels.manual')] as const).map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-[#235971]' : i === 1 ? 'bg-green-500' : 'bg-[#FF6B2C]'}`} />
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VEHICLES ── */}
          {tab === 'vehicles' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {c.vehicles.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">{t('profile.noVehicles')}</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {[t('profile.vehicleTable.vehicle'), t('profile.vehicleTable.year'), t('profile.vehicleTable.plate'), t('profile.vehicleTable.status')].map(col => (
                        <th key={col} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.vehicles.map((v: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">🏍 {v.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{v.year}</td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-700">{v.plate}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.status === 'Aktiv' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── INVOICES ── */}
          {tab === 'invoices' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {c.invoices.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">{t('profile.noInvoices')}</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {[t('profile.invoiceTable.invoiceNo'), t('profile.invoiceTable.description'), t('profile.invoiceTable.date'), t('profile.invoiceTable.amount'), t('profile.invoiceTable.status')].map(col => (
                        <th key={col} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.invoices.map((inv: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{inv.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{inv.desc}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{inv.date}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{inv.amount.toLocaleString('sv-SE')} kr</td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── TIMELINE ── */}
          {tab === 'timeline' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 max-w-2xl">
              {c.timeline.length === 0 ? (
                <p className="text-sm text-slate-400">{t('profile.noActivity')}</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
                  <div className="space-y-4">
                    {c.timeline.map((t: any, i: number) => (
                      <div key={i} className="flex gap-4 pl-10 relative">
                        <div className="absolute left-3 top-1.5 w-2.5 h-2.5 rounded-full bg-[#FF6B2C] border-2 border-white" />
                        <div>
                          <div className="text-xs text-slate-400">{t.date}</div>
                          <div className="text-sm text-slate-800 mt-0.5">{t.event}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {tab === 'documents' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center max-w-md mx-auto">
              <div className="text-4xl mb-3">📄</div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t('profile.tabs.documents')}</h3>
              <p className="text-sm text-slate-500">{t('profile.underDevelopment')}</p>
            </div>
          )}

          {/* ── GDPR ── */}
          {tab === 'gdpr' && (
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4">{t('profile.gdprTab.title')}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left — registered data + legal basis */}
                <div className="space-y-4">
                  {/* Registered data */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">{t('profile.gdprTab.dataTitle')}</h3>
                    <div className="space-y-1">
                      {[
                        { label: t('profile.gdprTab.name'),    src: t('profile.gdprTab.sourceBankID'),  ok: !!c.personnummer },
                        { label: t('profile.gdprTab.address'), src: t('profile.gdprTab.sourceSPAR'),    ok: !!c.address },
                        { label: t('profile.gdprTab.contact'), src: t('profile.gdprTab.sourceManual'),  ok: !!c.email },
                        { label: t('profile.gdprTab.purchases', { n: c.invoices.length }),   src: 'System',                          ok: c.invoices.length > 0 },
                        { label: t('profile.gdprTab.bankidLogs', { n: c.bankidHistory.length }), src: t('profile.gdprTab.sourceBankID'), ok: c.bankidHistory.length > 0 },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                          <span className="text-sm text-slate-700">{row.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{row.src}</span>
                            <span className={`text-xs font-bold ${row.ok ? 'text-green-600' : 'text-slate-400'}`}>
                              {row.ok ? '✓' : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legal basis */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">{t('profile.gdprTab.legalBasisTitle')}</h3>
                    <div className="space-y-2">
                      {[
                        t('profile.gdprTab.legalBasis1'),
                        t('profile.gdprTab.legalBasis2'),
                        t('profile.gdprTab.legalBasis3'),
                      ].map(basis => (
                        <div key={basis} className="flex items-start gap-2">
                          <span className="text-green-500 text-xs mt-0.5 shrink-0">✓</span>
                          <span className="text-xs text-slate-600 leading-relaxed">{basis}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right — 3 action cards */}
                <div className="space-y-4">
                  {/* Access & portability */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{t('profile.gdprTab.accessTitle')}</h3>
                    <p className="text-xs text-slate-500 mb-3">{t('profile.gdprTab.accessDesc')}</p>
                    <button
                      onClick={() => {
                        const data = {
                          name: `${c.firstName} ${c.lastName}`,
                          personnummer: c.personnummer,
                          address: c.address,
                          email: c.email,
                          phone: c.phone,
                          birthDate: c.birthDate,
                          gender: c.gender,
                          invoices: c.invoices,
                          bankidHistory: c.bankidHistory,
                          exportedAt: new Date().toISOString(),
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `gdpr-export-${c.id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0f1923] hover:bg-[#1a2a3a] text-white text-xs font-semibold transition-colors"
                    >
                      {t('profile.gdprTab.exportBtn')}
                    </button>
                  </div>

                  {/* Rectification */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{t('profile.gdprTab.rectifyTitle')}</h3>
                    <p className="text-xs text-slate-500 mb-3">{t('profile.gdprTab.rectifyDesc')}</p>
                    <a
                      href={`mailto:${dealerEmail || 'privacy@avamc.se'}?subject=Rättelse — ${c.firstName} ${c.lastName}`}
                      className="inline-block px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors"
                    >
                      {t('profile.gdprTab.rectifyBtn')} →
                    </a>
                  </div>

                  {/* Erasure */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{t('profile.gdprTab.deleteTitle')}</h3>
                    <p className="text-xs text-slate-500 mb-3">{t('profile.gdprTab.deleteDesc')}</p>
                    <button
                      onClick={() => toast.success(t('profile.gdprTab.deleteSuccess'))}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
                    >
                      {t('profile.gdprTab.deleteBtn')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 text-xs text-slate-400">
                {t('profile.gdprTab.imy')} ·{' '}
                <Link href="/privacy" className="text-[#FF6B2C] hover:underline">
                  {t('profile.gdprTab.privacyLink')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
