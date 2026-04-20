'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealerInfo } from '@/lib/dealer';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckItem {
  id:       string;
  label:    string;
  checked:  boolean;
  required: boolean;
  note?:    string;
}

interface DeliveryState {
  step:            'checklist' | 'handover' | 'signoff' | 'complete';
  inspection:      CheckItem[];
  documents:       CheckItem[];
  walkthrough:     CheckItem[];
  odometer:        string;
  fuelLevel:       string;
  damageNotes:     string;
  customerName:    string;
  salesperson:     string;
  deliveryTime:    string;
  customerSigned:  boolean;
  dealerSigned:    boolean;
}

// ─── Initial checklist items ─────────────────────────────────────────────────

const INSPECTION_ITEMS: Omit<CheckItem, 'checked'>[] = [
  { id: 'clean',   label: 'Vehicle cleaned and prepared',          required: true  },
  { id: 'fuel',    label: 'Fuel/charge level confirmed',           required: true  },
  { id: 'odo',     label: 'Odometer reading noted',                required: true  },
  { id: 'damage',  label: 'Pre-delivery inspection completed',     required: true  },
  { id: 'tires',   label: 'Tyre pressure and condition checked',   required: true  },
  { id: 'lights',  label: 'Lights and indicators tested',          required: false },
  { id: 'chain',   label: 'Chain/belt lubricated and adjusted',    required: false },
  { id: 'brakes',  label: 'Brakes tested',                         required: false },
];

const DOCUMENT_ITEMS: Omit<CheckItem, 'checked'>[] = [
  { id: 'regcert',    label: 'Registration certificate (Registreringsbevis)', required: true  },
  { id: 'keys',       label: 'All keys handed over',                           required: true  },
  { id: 'manual',     label: 'Owner\'s manual',                                required: true  },
  { id: 'service',    label: 'Service book / digital service history',         required: true  },
  { id: 'warranty',   label: 'Warranty card / documentation',                  required: true  },
  { id: 'agreement',  label: 'Signed purchase agreement copy',                 required: true  },
  { id: 'insurance',  label: 'Customer has valid insurance confirmed',         required: true  },
  { id: 'sparkeys',   label: 'Spare keys (if applicable)',                     required: false },
  { id: 'helmet',     label: 'Accessories/helmet included in deal',            required: false },
];

const WALKTHROUGH_ITEMS: Omit<CheckItem, 'checked'>[] = [
  { id: 'controls',  label: 'Controls and instruments explained',           required: true  },
  { id: 'features',  label: 'Key features demonstrated',                    required: true  },
  { id: 'safety',    label: 'Safety equipment and gear discussed',          required: true  },
  { id: 'service',   label: 'Service intervals and first service explained', required: true  },
  { id: 'warranty2', label: 'Warranty terms (3 years) explained',           required: true  },
  { id: 'contact',   label: 'Workshop contact and booking info given',      required: false },
  { id: 'app',       label: 'Manufacturer app / connectivity set up',       required: false },
];

function initItems(base: Omit<CheckItem, 'checked'>[]): CheckItem[] {
  return base.map(item => ({ ...item, checked: false }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionProgress({ items }: { items: CheckItem[] }) {
  const done     = items.filter(i => i.checked).length;
  const required = items.filter(i => i.required).length;
  const reqDone  = items.filter(i => i.required && i.checked).length;
  const pct      = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FF6B2C] to-orange-400 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 shrink-0">
        {reqDone}/{required} required
      </span>
    </div>
  );
}

function CheckRow({ item, onChange }: { item: CheckItem; onChange: (id: string) => void }) {
  return (
    <button
      onClick={() => onChange(item.id)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
        item.checked
          ? 'border-green-200 bg-green-50'
          : 'border-slate-100 bg-white hover:border-slate-200'
      }`}
    >
      <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${
        item.checked ? 'bg-green-500 border-green-500' : 'border-slate-300'
      }`}>
        {item.checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${item.checked ? 'text-green-800 line-through opacity-60' : 'text-slate-800'}`}>
          {item.label}
        </p>
      </div>
      {item.required && !item.checked && (
        <span className="text-[10px] font-bold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded shrink-0">
          Required
        </span>
      )}
      {item.checked && (
        <span className="text-green-500 shrink-0">✓</span>
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliveryPage() {
  const router  = useRouter();
  const params  = useParams();
  const leadId  = (params?.id as string) || '';
  const dealer  = getDealerInfo();

  const [state, setState] = useState<DeliveryState>({
    step:        'checklist',
    inspection:  initItems(INSPECTION_ITEMS),
    documents:   initItems(DOCUMENT_ITEMS),
    walkthrough: initItems(WALKTHROUGH_ITEMS),
    odometer:     '',
    fuelLevel:    '',
    damageNotes:  '',
    customerName: '',
    salesperson:  '',
    deliveryTime: new Date().toISOString().slice(0, 16),
    customerSigned: false,
    dealerSigned:   false,
  });

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/auth/login'); return; }
    try {
      const u = JSON.parse(stored);
      setState(s => ({
        ...s,
        salesperson: u.name ?? u.givenName ?? '',
      }));
    } catch { /* ignore */ }
  }, [router]);

  function toggle(section: 'inspection' | 'documents' | 'walkthrough', id: string) {
    setState(s => ({
      ...s,
      [section]: s[section].map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ),
    }));
  }

  function checkAllRequired(section: 'inspection' | 'documents' | 'walkthrough') {
    return state[section].filter(i => i.required).every(i => i.checked);
  }

  const canProceedToHandover =
    checkAllRequired('inspection') &&
    state.odometer.trim().length > 0;

  const canProceedToSignoff =
    checkAllRequired('documents') &&
    checkAllRequired('walkthrough');

  const canComplete =
    state.customerSigned &&
    state.dealerSigned &&
    state.customerName.trim().length > 0;

  const STEPS = [
    { id: 'checklist', label: 'Inspection',  icon: '🔍' },
    { id: 'handover',  label: 'Handover',    icon: '📋' },
    { id: 'signoff',   label: 'Walkthrough', icon: '🏍' },
    { id: 'complete',  label: 'Sign-off',    icon: '✅' },
  ];
  const stepIndex = STEPS.findIndex(s => s.id === state.step);

  function buildDeliveryCertificate(): jsPDF {
    const doc   = new jsPDF({ unit: 'mm', format: 'a4' });
    const mL    = 20;
    const mR    = 190;
    const lineH = 7;
    let y       = 20;

    // ── Header ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 107, 44);
    doc.text(dealer.name || 'AVA MC', mL, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Org.nr ${dealer.orgNr || '—'} · ${dealer.city || ''}`, mR, y, { align: 'right' });

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text('✓ Leveransintyg', mR, y, { align: 'right' });

    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(mL, y, mR, y);
    y += 10;

    // ── Title ──────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('LEVERANSINTYG', 105, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    const deliveryDate = state.deliveryTime
      ? new Date(state.deliveryTime).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
      : new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
    doc.text(`Datum: ${deliveryDate}`, 105, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.line(mL, y, mR, y);
    y += 8;

    // ── Delivery details ───────────────────────────────────────────
    const rows: Array<[string, string]> = [
      ['KUND',         state.customerName || '—'],
      ['SÄLJARE',      state.salesperson  || '—'],
      ['MÄTARSTÄLLNING', state.odometer ? `${Number(state.odometer).toLocaleString('sv-SE')} km` : '—'],
      ['BRÄNSLENIVÅ',  state.fuelLevel || '—'],
    ];
    if (state.damageNotes) rows.push(['ANMÄRKNINGAR', state.damageNotes]);

    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(label + ':', mL, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(value, 120);
      doc.text(lines, mL + 42, y);
      y += lineH * (lines.length > 1 ? lines.length : 1);
    }

    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(mL, y, mR, y);
    y += 8;

    // ── Checklist summary ──────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('BESIKTNINGSPROTOKOLL', mL, y);
    y += 6;

    const sections: Array<[string, CheckItem[]]> = [
      ['Fordonskontroll',  state.inspection],
      ['Dokument',         state.documents],
      ['Genomgång',        state.walkthrough],
    ];
    for (const [sLabel, items] of sections) {
      const done = items.filter(i => i.checked).length;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`${sLabel}: ${done}/${items.length} godkänd`, mL, y);
      y += 5;
      for (const item of items) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(item.checked ? 21 : 148, item.checked ? 128 : 163, item.checked ? 61 : 184);
        doc.text(`${item.checked ? '✓' : '○'} ${item.label}`, mL + 4, y);
        y += 5;
        if (y > 260) { doc.addPage(); y = 20; }
      }
      y += 2;
    }

    y += 4;
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setDrawColor(226, 232, 240);
    doc.line(mL, y, mR, y);
    y += 10;

    // ── Signatures ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('UNDERSKRIFTER', mL, y);
    y += 8;

    const sigW = 75;
    for (const [label, name, signed] of [
      ['Kund', state.customerName, state.customerSigned],
      ['Säljare', state.salesperson, state.dealerSigned],
    ] as Array<[string, string, boolean]>) {
      const x = label === 'Kund' ? mL : 105;
      doc.setDrawColor(200, 200, 200);
      doc.line(x, y + 12, x + sigW, y + 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`${label}: ${name || '—'}`, x, y + 16);
      doc.setFontSize(7);
      doc.text(signed ? `✓ Godkänd ${deliveryDate}` : 'Ej signerat', x, y + 20);
    }
    y += 28;

    // ── Footer ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${dealer.name} · Genererat av BikeMeNow · ${new Date().toLocaleString('sv-SE')}`, 105, 285, { align: 'center' });

    return doc;
  }

  function downloadCertificate() {
    const doc = buildDeliveryCertificate();
    const fname = `Leveransintyg-${(state.customerName || 'kund').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(fname);
  }

  function handleComplete() {
    downloadCertificate();
    toast.success('Leverans slutförd! Intyg nedladdat.');
    setTimeout(() => router.push(`/sales/leads/${leadId}`), 1500);
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Sales</Link>
            <span>→</span>
            <Link href={`/sales/leads/${leadId}`} className="hover:text-[#FF6B2C] transition-colors">Lead</Link>
            <span>→</span>
            <Link href={`/sales/leads/${leadId}/payment`} className="hover:text-[#FF6B2C] transition-colors">Payment</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">Delivery</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏍</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Vehicle Delivery</h1>
              <p className="text-sm text-slate-400 mt-0.5">{dealer.name} — Complete checklist before handing over keys</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-5 md:px-8 py-8 max-w-3xl mx-auto w-full">

          {/* Step indicator */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
            <div className="flex items-center">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${
                      i < stepIndex
                        ? 'bg-green-500 text-white'
                        : i === stepIndex
                        ? 'bg-[#0b1524] text-white shadow-lg'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {i < stepIndex ? '✓' : s.icon}
                    </div>
                    <span className={`text-[10px] font-semibold ${
                      i === stepIndex ? 'text-slate-800' : 'text-slate-400'
                    }`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all ${
                      i < stepIndex ? 'bg-green-400' : 'bg-slate-100'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── STEP 1: Pre-delivery inspection ──────────────────────────────── */}
          {state.step === 'checklist' && (
            <div className="space-y-5 animate-fade-up">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-slate-900">Pre-Delivery Inspection</h2>
                  <span className="text-xs text-slate-400">
                    {state.inspection.filter(i => i.checked).length}/{state.inspection.length}
                  </span>
                </div>
                <SectionProgress items={state.inspection} />
                <div className="mt-4 space-y-2">
                  {state.inspection.map(item => (
                    <CheckRow key={item.id} item={item} onChange={id => toggle('inspection', id)} />
                  ))}
                </div>
              </div>

              {/* Odometer & fuel */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                <h3 className="font-bold text-slate-900">Vehicle Readings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      Odometer at delivery <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={state.odometer}
                        onChange={e => setState(s => ({ ...s, odometer: e.target.value }))}
                        placeholder="e.g. 0"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF6B2C] transition-colors"
                      />
                      <span className="text-xs text-slate-400 shrink-0">km</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Fuel level</label>
                    <select
                      value={state.fuelLevel}
                      onChange={e => setState(s => ({ ...s, fuelLevel: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF6B2C] transition-colors bg-white"
                    >
                      <option value="">Select…</option>
                      <option value="Full (100%)">Full (100%)</option>
                      <option value="3/4">3/4</option>
                      <option value="1/2">1/2</option>
                      <option value="1/4">1/4</option>
                      <option value="Full charge (electric)">Full charge (electric)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Visible damage / notes (leave blank if none)
                  </label>
                  <textarea
                    value={state.damageNotes}
                    onChange={e => setState(s => ({ ...s, damageNotes: e.target.value }))}
                    placeholder="e.g. Minor scratch on left panel, noted and accepted by customer"
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF6B2C] transition-colors resize-none"
                  />
                </div>
              </div>

              <button
                onClick={() => setState(s => ({ ...s, step: 'handover' }))}
                disabled={!canProceedToHandover}
                className="w-full py-3.5 rounded-2xl bg-[#0b1524] hover:bg-[#162236] disabled:opacity-40 text-white font-bold transition-all"
              >
                Continue to Document Handover →
              </button>
              {!canProceedToHandover && (
                <p className="text-xs text-center text-slate-400">
                  Complete all required inspection items and enter odometer reading to continue
                </p>
              )}
            </div>
          )}

          {/* ── STEP 2: Document handover ────────────────────────────────────── */}
          {state.step === 'handover' && (
            <div className="space-y-5 animate-fade-up">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-slate-900">Document Handover</h2>
                  <span className="text-xs text-slate-400">
                    {state.documents.filter(i => i.checked).length}/{state.documents.length}
                  </span>
                </div>
                <SectionProgress items={state.documents} />
                <div className="mt-4 space-y-2">
                  {state.documents.map(item => (
                    <CheckRow key={item.id} item={item} onChange={id => toggle('documents', id)} />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setState(s => ({ ...s, step: 'checklist' }))}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setState(s => ({ ...s, step: 'signoff' }))}
                  disabled={!checkAllRequired('documents')}
                  className="flex-[2] py-3 rounded-2xl bg-[#0b1524] hover:bg-[#162236] disabled:opacity-40 text-white font-bold transition-all"
                >
                  Continue to Customer Walkthrough →
                </button>
              </div>
              {!checkAllRequired('documents') && (
                <p className="text-xs text-center text-slate-400">
                  All required documents must be handed over before continuing
                </p>
              )}
            </div>
          )}

          {/* ── STEP 3: Customer walkthrough ─────────────────────────────────── */}
          {state.step === 'signoff' && (
            <div className="space-y-5 animate-fade-up">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-slate-900">Customer Walkthrough</h2>
                  <span className="text-xs text-slate-400">
                    {state.walkthrough.filter(i => i.checked).length}/{state.walkthrough.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Walk the customer through the motorcycle before they leave the premises.
                </p>
                <SectionProgress items={state.walkthrough} />
                <div className="mt-4 space-y-2">
                  {state.walkthrough.map(item => (
                    <CheckRow key={item.id} item={item} onChange={id => toggle('walkthrough', id)} />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setState(s => ({ ...s, step: 'handover' }))}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setState(s => ({ ...s, step: 'complete' }))}
                  disabled={!canProceedToSignoff}
                  className="flex-[2] py-3 rounded-2xl bg-[#0b1524] hover:bg-[#162236] disabled:opacity-40 text-white font-bold transition-all"
                >
                  Continue to Final Sign-off →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Final sign-off ───────────────────────────────────────── */}
          {state.step === 'complete' && (
            <div className="space-y-5 animate-fade-up">

              {/* Delivery summary card */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                <h2 className="font-bold text-slate-900">Delivery Summary</h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { icon: '🔍', label: 'Inspection',    value: `${state.inspection.filter(i=>i.checked).length}/${state.inspection.length}` },
                    { icon: '📋', label: 'Documents',     value: `${state.documents.filter(i=>i.checked).length}/${state.documents.length}` },
                    { icon: '🏍', label: 'Walkthrough',   value: `${state.walkthrough.filter(i=>i.checked).length}/${state.walkthrough.length}` },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xl mb-1">{s.icon}</p>
                      <p className="text-xs font-semibold text-slate-700">{s.value}</p>
                      <p className="text-[10px] text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                {state.odometer && (
                  <div className="flex justify-between text-sm border-t border-slate-100 pt-3">
                    <span className="text-slate-400">Odometer at delivery</span>
                    <span className="font-bold text-slate-900">{Number(state.odometer).toLocaleString('sv-SE')} km</span>
                  </div>
                )}
                {state.fuelLevel && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Fuel/charge level</span>
                    <span className="font-bold text-slate-900">{state.fuelLevel}</span>
                  </div>
                )}
                {state.damageNotes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Noted damage/remarks</p>
                    <p className="text-xs text-amber-800">{state.damageNotes}</p>
                  </div>
                )}
              </div>

              {/* Sign-off form */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                <h3 className="font-bold text-slate-900">Final Sign-off</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      Customer name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={state.customerName}
                      onChange={e => setState(s => ({ ...s, customerName: e.target.value }))}
                      placeholder="Full name"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF6B2C] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Salesperson</label>
                    <input
                      type="text"
                      value={state.salesperson}
                      onChange={e => setState(s => ({ ...s, salesperson: e.target.value }))}
                      placeholder="Your name"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF6B2C] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Delivery date & time
                  </label>
                  <input
                    type="datetime-local"
                    value={state.deliveryTime}
                    onChange={e => setState(s => ({ ...s, deliveryTime: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF6B2C] transition-colors"
                  />
                </div>

                {/* Confirmations */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setState(s => ({ ...s, customerSigned: !s.customerSigned }))}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                      state.customerSigned
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      state.customerSigned ? 'bg-green-500 border-green-500' : 'border-slate-300'
                    }`}>
                      {state.customerSigned && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">Customer confirms receipt</p>
                      <p className="text-xs text-slate-400">Customer acknowledges all items checked and vehicle received in agreed condition</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setState(s => ({ ...s, dealerSigned: !s.dealerSigned }))}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                      state.dealerSigned
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      state.dealerSigned ? 'bg-green-500 border-green-500' : 'border-slate-300'
                    }`}>
                      {state.dealerSigned && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">Salesperson confirms handover</p>
                      <p className="text-xs text-slate-400">All documents handed over, walkthrough completed, checklist signed off</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setState(s => ({ ...s, step: 'signoff' }))}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  ← Back
                </button>
                <div className="flex-2 flex flex-col gap-2">
                  <button
                    onClick={handleComplete}
                    disabled={!canComplete}
                    className="w-full py-3 rounded-2xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold transition-all"
                  >
                    Complete Delivery ✓
                  </button>
                  <button
                    onClick={downloadCertificate}
                    className="w-full py-2 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                  >
                    📄 Ladda ner leveransintyg (PDF)
                  </button>
                </div>
              </div>
              {!canComplete && (
                <p className="text-xs text-center text-slate-400">
                  Both confirmations required and customer name must be filled
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
