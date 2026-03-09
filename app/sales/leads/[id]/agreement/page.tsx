'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';

interface AgreementData {
  agreementNumber: string;
  customerName: string;
  personnummer: string;
  vehicle: string;
  vin: string;
  accessories: string;
  tradeIn: string;
  tradeInCredit: number;
  totalPrice: number;
  vatAmount: number;
  financingMonths: number;
  financingMonthly: number;
  financingApr: number;
}

const MOCK_AGREEMENTS: Record<string, AgreementData> = {
  default: {
    agreementNumber: 'AGR-2024-0089',
    customerName: 'Lars Bergman',
    personnummer: '197506123456',
    vehicle: 'Kawasaki Ninja ZX-6R 2024',
    vin: 'JKBZXR636PA012345',
    accessories: 'Akrapovic + Tank Pad + Crash Protectors',
    tradeIn: 'Kawasaki Ninja 300 2020',
    tradeInCredit: 32000,
    totalPrice: 133280,
    vatAmount: 26656,
    financingMonths: 36,
    financingMonthly: 4092,
    financingApr: 4.9,
  },
};

// ─── Display row (read-only) ──────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  badge,
  badgeColor = 'text-slate-400',
}: {
  label: string;
  value: string;
  badge: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 min-w-[120px] shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 flex-1 mx-4">{value}</span>
      <span className={`text-xs font-semibold shrink-0 ${badgeColor}`}>{badge}</span>
    </div>
  );
}

// ─── Edit row wrapper ─────────────────────────────────────────────────────────

function EditRow({
  label,
  badge,
  badgeColor = 'text-slate-400',
  children,
}: {
  label: string;
  badge: string;
  badgeColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-50 last:border-0 gap-3">
      <span className="text-sm text-slate-500 min-w-[120px] shrink-0 pt-2">{label}</span>
      <div className="flex-1">{children}</div>
      <span className={`text-xs font-semibold shrink-0 pt-2 ${badgeColor}`}>{badge}</span>
    </div>
  );
}

// ─── Input primitives ─────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20"
    />
  );
}

function NumberInput({
  value,
  onChange,
  step,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 pr-10 text-slate-900 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateAgreementPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('agreement');
  const id = (params?.id as string) || 'default';
  const [ready, setReady] = useState(false);

  const [agr, setAgr] = useState<AgreementData>(MOCK_AGREEMENTS.default);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<AgreementData | null>(null);

  useEffect(() => {
    const base = MOCK_AGREEMENTS[id] ?? MOCK_AGREEMENTS.default;
    setAgr(base);
    const user = localStorage.getItem('user');
    if (!user) { router.replace('/auth/login'); return; }
    setReady(true);
  }, [id, router]);

  const startEdit  = () => { setDraft({ ...agr }); setIsEditing(true); };
  const cancelEdit = () => { setDraft(null); setIsEditing(false); };
  const saveEdit   = () => { if (draft) setAgr(draft); setDraft(null); setIsEditing(false); };

  function update<K extends keyof AgreementData>(key: K, value: AgreementData[K]) {
    setDraft(d => d ? { ...d, [key]: value } : d);
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // When editing, render draft values; otherwise render saved values
  const d = isEditing && draft ? draft : agr;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">{t('breadcrumb.sales')}</Link>
            <span>→</span>
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Lead #{id === 'default' ? '42' : id}</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('breadcrumb.agreement')}</span>
          </nav>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl">📝</span>
            <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
            {isEditing && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                {t('editingBadge')}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <span className="text-[#FF6B2C] font-bold">⚡</span>
            <p className="text-sm text-green-700 font-medium">
              {t('autopopulated', { offerNumber: agr.agreementNumber.replace('AGR', 'OFF') })}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 md:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Agreement Details card */}
            <div className={`flex-1 bg-white rounded-2xl border p-6 animate-fade-up transition-colors ${
              isEditing ? 'border-[#FF6B2C]/40 shadow-sm' : 'border-slate-100'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">{t('sections.details')}</h2>
                {isEditing && (
                  <span className="text-xs text-amber-600 font-medium">✏️ {t('unsavedChanges')}</span>
                )}
              </div>

              {/* Agreement # — always read-only */}
              <FieldRow
                label={t('fields.agreementNumber')}
                value={d.agreementNumber}
                badge={t('badges.auto')}
                badgeColor="text-slate-400"
              />

              {/* Customer */}
              {isEditing ? (
                <EditRow label={t('fields.customer')} badge={t('badges.fromOffer')} badgeColor="text-[#FF6B2C]">
                  <div className="flex gap-2">
                    <TextInput
                      value={draft!.customerName}
                      onChange={v => update('customerName', v)}
                      placeholder={t('placeholders.fullName')}
                    />
                    <TextInput
                      value={draft!.personnummer}
                      onChange={v => update('personnummer', v)}
                      placeholder={t('placeholders.personnummer')}
                    />
                  </div>
                </EditRow>
              ) : (
                <FieldRow
                  label={t('fields.customer')}
                  value={`${d.customerName} (${d.personnummer})`}
                  badge={t('badges.fromOffer')}
                  badgeColor="text-[#FF6B2C]"
                />
              )}

              {/* Vehicle */}
              {isEditing ? (
                <EditRow label={t('fields.vehicle')} badge={t('badges.fromOffer')} badgeColor="text-[#FF6B2C]">
                  <TextInput
                    value={draft!.vehicle}
                    onChange={v => update('vehicle', v)}
                    placeholder={t('placeholders.vehicleModel')}
                  />
                </EditRow>
              ) : (
                <FieldRow
                  label={t('fields.vehicle')}
                  value={d.vehicle}
                  badge={t('badges.fromOffer')}
                  badgeColor="text-[#FF6B2C]"
                />
              )}

              {/* VIN */}
              {isEditing ? (
                <EditRow label={t('fields.vin')} badge={t('badges.fromOffer')} badgeColor="text-[#FF6B2C]">
                  <TextInput
                    value={draft!.vin}
                    onChange={v => update('vin', v)}
                    placeholder={t('placeholders.vin')}
                  />
                </EditRow>
              ) : (
                <FieldRow
                  label={t('fields.vin')}
                  value={d.vin}
                  badge={t('badges.fromOffer')}
                  badgeColor="text-[#FF6B2C]"
                />
              )}

              {/* Accessories */}
              {isEditing ? (
                <EditRow label={t('fields.accessories')} badge={t('badges.fromOffer')} badgeColor="text-[#FF6B2C]">
                  <TextInput
                    value={draft!.accessories}
                    onChange={v => update('accessories', v)}
                    placeholder={t('placeholders.accessories')}
                  />
                </EditRow>
              ) : (
                <FieldRow
                  label={t('fields.accessories')}
                  value={d.accessories}
                  badge={t('badges.fromOffer')}
                  badgeColor="text-[#FF6B2C]"
                />
              )}

              {/* Trade-In */}
              {isEditing ? (
                <EditRow label={t('fields.tradeIn')} badge={t('badges.fromOffer')} badgeColor="text-[#FF6B2C]">
                  <div className="flex gap-2">
                    <TextInput
                      value={draft!.tradeIn}
                      onChange={v => update('tradeIn', v)}
                      placeholder={t('placeholders.vehicleMakeModel')}
                    />
                    <div className="w-36 shrink-0">
                      <NumberInput
                        value={draft!.tradeInCredit}
                        onChange={v => update('tradeInCredit', v)}
                        suffix="kr"
                      />
                    </div>
                  </div>
                </EditRow>
              ) : (
                <FieldRow
                  label={t('fields.tradeIn')}
                  value={`${d.tradeIn} — ${d.tradeInCredit.toLocaleString('sv-SE')} kr`}
                  badge={t('badges.fromOffer')}
                  badgeColor="text-[#FF6B2C]"
                />
              )}

              {/* Total Price */}
              {isEditing ? (
                <EditRow label={t('fields.totalPrice')} badge={t('badges.calculated')} badgeColor="text-emerald-600">
                  <NumberInput
                    value={draft!.totalPrice}
                    onChange={v => update('totalPrice', v)}
                    suffix="kr"
                  />
                </EditRow>
              ) : (
                <FieldRow
                  label={t('fields.totalPrice')}
                  value={`${d.totalPrice.toLocaleString('sv-SE')} kr (${t('vatNote')})`}
                  badge={t('badges.calculated')}
                  badgeColor="text-emerald-600"
                />
              )}

              {/* Financing */}
              {isEditing ? (
                <EditRow label={t('fields.financing')} badge={t('badges.fromOffer')} badgeColor="text-[#FF6B2C]">
                  <div className="flex gap-2">
                    <NumberInput
                      value={draft!.financingMonths}
                      onChange={v => update('financingMonths', v)}
                      suffix="mo"
                    />
                    <NumberInput
                      value={draft!.financingMonthly}
                      onChange={v => update('financingMonthly', v)}
                      suffix="kr/mo"
                    />
                    <div className="w-28 shrink-0">
                      <NumberInput
                        value={draft!.financingApr}
                        onChange={v => update('financingApr', v)}
                        step={0.1}
                        suffix="% APR"
                      />
                    </div>
                  </div>
                </EditRow>
              ) : (
                <FieldRow
                  label={t('fields.financing')}
                  value={`${d.financingMonths} × ${d.financingMonthly.toLocaleString('sv-SE')} kr/mo (${d.financingApr}% APR)`}
                  badge={t('badges.fromOffer')}
                  badgeColor="text-[#FF6B2C]"
                />
              )}

              {/* Total credit cost — always read-only (Konsumentkreditlagen 2010:1846) */}
              <FieldRow
                label={t('fields.totalCreditCost')}
                value={`${(d.financingMonthly * d.financingMonths).toLocaleString('sv-SE')} kr`}
                badge={t('badges.calculated')}
                badgeColor="text-emerald-600"
              />
            </div>

            {/* Right column */}
            <div className="lg:w-80 flex flex-col gap-4">

              {/* Legal Compliance */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-fade-up">
                <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span>✅</span> {t('sections.legal')}
                </h2>
                {([
                  t('legal.consumerAct'),
                  t('legal.returnPolicy'),
                  t('legal.gdpr'),
                  t('legal.vat'),
                  t('legal.fskattebevis'),
                  t('legal.warranty'),
                ] as string[]).map(item => (
                  <div key={item} className="flex items-center gap-2 py-1.5">
                    <span className="text-green-500 text-sm">✅</span>
                    <span className="text-sm text-green-700">{item}</span>
                  </div>
                ))}
              </div>

              {/* Document Security */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-fade-up">
                <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span>🔒</span> {t('sections.security')}
                </h2>
                {[
                  { label: t('docSecurity.beforeSigning'), value: t('docSecurity.editable') },
                  { label: t('docSecurity.afterBankID'),   value: t('docSecurity.locked') },
                  { label: t('docSecurity.auditTrail'),    value: t('docSecurity.everyChange') },
                  { label: t('docSecurity.retention'),     value: t('docSecurity.encrypted') },
                ].map(row => (
                  <div key={row.label} className="py-1.5 flex items-baseline gap-2">
                    <span className="text-xs text-slate-400 shrink-0">{row.label}</span>
                    <span className="text-sm text-slate-700">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 mt-2 animate-fade-up">
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      className="w-full py-3 rounded-xl bg-[#1a7d4f] hover:bg-[#156640] text-white text-sm font-semibold transition-colors"
                    >
                      {t('actions.saveChanges')} ✓
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-500 hover:border-slate-300 transition-colors"
                    >
                      {t('actions.cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startEdit}
                      className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#FF6B2C] hover:text-[#FF6B2C] transition-colors"
                    >
                      {t('actions.editAgreement')} ✏️
                    </button>
                    <Link
                      href={`/sales/leads/${id}/agreement/preview`}
                      className="w-full py-3 rounded-xl bg-[#1a7d4f] hover:bg-[#156640] text-white text-sm font-semibold text-center transition-colors"
                    >
                      {t('actions.proceedToSigning')} →
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
