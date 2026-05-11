'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { getCustomers, type Customer } from '@/lib/customers';
import {
  getWorkOrders, getTechnicians, type WorkOrder, type Technician,
  WO_STATUS_COLORS, PRIORITY_COLORS,
} from '@/lib/service';

// ── Shared interfaces ──────────────────────────────────────────────────────────

interface CustomerVehicle {
  id: string; name: string; plate: string; vin: string;
  source: 'purchase' | 'service'; lastSeen: string;
}

interface VehicleLookup {
  make: string; model: string; year: number; color: string;
  vin: string; registrationNumber: string; mileage: number;
  bodyClass: string; fuelType: string; engineCC: number;
  vehicleStatus: string; lastInspection: string; nextInspection: string;
  source: string;
}

// ── Shared style constants ─────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white';

// ── Module-level sub-components ────────────────────────────────────────────────

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
        {label}{req && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function PreviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-slate-800 dark:text-slate-200 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

interface RegLookupProps {
  regQuery: string; setRegQuery: (v: string) => void;
  regLoading: boolean; regError: string; regResult: VehicleLookup | null;
  onLookup: () => void;
  t: ReturnType<typeof useTranslations<'service'>>;
}

function RegLookupBlock({ regQuery, setRegQuery, regLoading, regError, regResult, onLookup, t }: RegLookupProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={regQuery}
          onChange={e => setRegQuery(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onLookup(); } }}
          placeholder={t('newOrder.vehicle.regPlaceholder')}
          className={inp + ' flex-1 tracking-widest font-mono'}
          maxLength={17}
        />
        <button
          type="button"
          onClick={() => onLookup()}
          disabled={regLoading || !regQuery.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold disabled:opacity-40 hover:bg-[#e55a1f] transition-colors whitespace-nowrap"
        >
          {regLoading ? '...' : t('newOrder.vehicle.searchBtn')}
        </button>
      </div>
      {regError && <p className="text-xs text-red-500">{regError}</p>}
      {regResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-sm">{t('newOrder.vehicle.found')}</span>
            <span className="ml-auto text-xs text-slate-400">{regResult.source}</span>
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {[regResult.make, regResult.model, regResult.year].filter(Boolean).join(' ')}
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
            <div><span className="text-slate-400">Reg.nr</span> <span className="font-mono font-semibold">{regResult.registrationNumber || regQuery}</span></div>
            {regResult.vin && <div><span className="text-slate-400">VIN</span> <span className="font-mono">{regResult.vin}</span></div>}
            {regResult.color && <div><span className="text-slate-400">{t('newOrder.vehicle.color')}</span> {regResult.color}</div>}
            {regResult.fuelType && <div><span className="text-slate-400">{t('newOrder.vehicle.fuel')}</span> {regResult.fuelType}</div>}
            {regResult.engineCC > 0 && <div><span className="text-slate-400">{t('newOrder.vehicle.engine')}</span> {regResult.engineCC} cc</div>}
            {regResult.mileage > 0 && <div><span className="text-slate-400">{t('newOrder.vehicle.odometer')}</span> {regResult.mileage.toLocaleString('sv-SE')} km</div>}
            {regResult.nextInspection && <div><span className="text-slate-400">{t('newOrder.vehicle.nextInspection')}</span> {regResult.nextInspection.slice(0, 10)}</div>}
            <div>
              <span className="text-slate-400">{t('newOrder.vehicle.status')}</span>{' '}
              <span className={regResult.vehicleStatus === 'REGISTERED' ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                {regResult.vehicleStatus === 'REGISTERED' ? t('newOrder.vehicle.registered') : regResult.vehicleStatus}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Today's work orders mini card ──────────────────────────────────────────────

function TodayOrderCard({ order, t }: { order: WorkOrder; t: ReturnType<typeof useTranslations<'service'>> }) {
  const priorityColor = PRIORITY_COLORS[order.priority] ?? 'bg-slate-100 text-slate-500';
  const statusColor   = WO_STATUS_COLORS[order.status]  ?? 'bg-slate-100 text-slate-500';
  return (
    <Link
      href={`/service/orders/${order.id}`}
      className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-[#FF6B2C]/10 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-sm">🔧</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-[#FF6B2C]">
          AO-{order.id} · {order.customer_name || '—'}
        </p>
        <p className="text-xs text-slate-400 truncate">{order.vehicle_name || order.plate || '—'}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${statusColor}`}>
            {t(`orderStatus.${order.status}` as Parameters<typeof t>[0])}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${priorityColor}`}>
            {t(`priority.${order.priority}` as Parameters<typeof t>[0])}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Main page content ──────────────────────────────────────────────────────────

function NewOrderContent() {
  const router  = useRouter();
  const params  = useSearchParams();
  const t = useTranslations('service');

  const PRIORITY_OPTIONS = [
    { value: 'low',    label: t('priority.low') },
    { value: 'normal', label: t('priority.normal') },
    { value: 'high',   label: t('priority.high') },
    { value: 'urgent', label: t('priority.urgent') },
  ];

  // form state
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', vehicleName: '',
    plate: '', vin: '', description: '', priority: 'normal',
    assignedTech: '', mileage: '', laborRate: 850,
  });

  // technicians
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  // customer search
  const [customers,       setCustomers]       = useState<Customer[]>([]);
  const [custSearch,      setCustSearch]      = useState('');
  const [selected,        setSelected]        = useState<Customer | null>(null);
  const [showDropdown,    setShowDropdown]    = useState(false);

  // vehicle history
  const [vehicles,        setVehicles]        = useState<CustomerVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclePick,     setVehiclePick]     = useState<string>('');

  // reg lookup
  const [regQuery,   setRegQuery]   = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regResult,  setRegResult]  = useState<VehicleLookup | null>(null);
  const [regError,   setRegError]   = useState('');

  // today's orders (right panel)
  const [todaysOrders,   setTodaysOrders]   = useState<WorkOrder[]>([]);
  const [ordersLoading,  setOrdersLoading]  = useState(true);

  const [saving,     setSaving]     = useState(false);
  const [migrateSql, setMigrateSql] = useState<string | null>(null);

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  const loadTodaysOrders = useCallback(async () => {
    const orders = await getWorkOrders();
    const today  = new Date().toISOString().slice(0, 10);
    const active = orders.filter(o =>
      o.status !== 'completed' && o.status !== 'invoiced' &&
      (o.created_at?.startsWith(today) || o.status === 'in_progress' || o.status === 'waiting_parts')
    );
    setTodaysOrders(active);
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    getCustomers().then(setCustomers);
    getTechnicians().then(setTechnicians);
    loadTodaysOrders();

    const cName = params.get('customerName');
    if (cName) {
      setForm(f => ({
        ...f,
        customerName:   cName,
        customerPhone:  params.get('customerPhone')  ?? '',
        vehicleName:    params.get('vehicleName')    ?? '',
        plate:          params.get('plate')          ?? '',
      }));
    }
  }, [router, params, loadTodaysOrders]);

  // ── Customer helpers ─────────────────────────────────────────────────────────

  const filteredCustomers = custSearch.trim().length > 1
    ? customers.filter(c =>
        `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(custSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  function resetVehicle() {
    setVehiclePick(''); setRegQuery(''); setRegResult(null); setRegError('');
    setForm(f => ({ ...f, vehicleName: '', plate: '', vin: '', mileage: '' }));
  }

  async function selectCustomer(c: Customer) {
    setSelected(c); setCustSearch(''); setShowDropdown(false);
    setVehicles([]); resetVehicle();
    setForm(f => ({ ...f, customerName: `${c.firstName} ${c.lastName}`, customerPhone: c.phone, vehicleName: '', plate: '', vin: '', mileage: '' }));
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setLoadingVehicles(true);
    try {
      const res = await fetch(`/api/customers/${c.id}/vehicles?dealershipId=${encodeURIComponent(dealershipId)}`);
      if (res.ok) {
        const json = await res.json() as { vehicles: CustomerVehicle[] };
        setVehicles(json.vehicles ?? []);
      }
    } finally { setLoadingVehicles(false); }
  }

  function clearCustomer() {
    setSelected(null); setVehicles([]); resetVehicle();
    setForm(f => ({ ...f, customerName: '', customerPhone: '', vehicleName: '', plate: '', vin: '', mileage: '' }));
  }

  function pickVehicle(id: string) {
    setVehiclePick(id); setRegResult(null); setRegError(''); setRegQuery('');
    if (id === 'reg-lookup') { setForm(f => ({ ...f, vehicleName: '', plate: '', vin: '' })); return; }
    const v = vehicles.find(v => v.id === id);
    if (v) setForm(f => ({ ...f, vehicleName: v.name, plate: v.plate || '', vin: v.vin || '' }));
  }

  // ── Reg lookup ────────────────────────────────────────────────────────────────

  async function lookupByReg() {
    const q = regQuery.trim().toUpperCase().replace(/\s/g, '');
    if (!q) return;
    setRegLoading(true); setRegError(''); setRegResult(null);
    try {
      const res  = await fetch(`/api/vehicle-lookup?query=${encodeURIComponent(q)}`);
      const data = await res.json() as VehicleLookup;
      if (data.source === 'not_found' || !data.make) {
        setRegError(t('newOrder.vehicle.notFound'));
      } else {
        setRegResult(data);
        const name = [data.make, data.model, data.year].filter(Boolean).join(' ');
        setForm(f => ({
          ...f,
          vehicleName: name,
          plate:       data.registrationNumber || q,
          vin:         data.vin || '',
          mileage:     data.mileage > 0 ? String(data.mileage) : f.mileage,
        }));
      }
    } catch {
      setRegError(t('newOrder.vehicle.lookupFailed'));
    } finally { setRegLoading(false); }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dealershipId = getDealershipId();
    if (!dealershipId) { toast.error(t('newOrder.toasts.noDealership')); return; }
    setSaving(true);
    const res = await fetch('/api/service/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        customerId:    selected?.id ?? null,
        customerName:  form.customerName,
        customerPhone: form.customerPhone,
        vehicleName:   form.vehicleName,
        plate:         form.plate,
        vin:           form.vin,
        description:   form.description,
        priority:      form.priority,
        assignedTech:  form.assignedTech,
        mileage:       form.mileage ? Number(form.mileage) : null,
        laborRate:     form.laborRate,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const { order } = await res.json();
      toast.success(t('newOrder.toasts.created'));
      router.push(`/service/orders/${order.id}`);
    } else {
      const json = await res.json().catch(() => ({})) as { error?: string };
      const msg = json.error ?? '';
      if (msg.includes('does not exist') || msg.includes('relation')) {
        const mRes  = await fetch('/api/admin/migrate-service', { method: 'POST' });
        const mJson = await mRes.json() as { ok: boolean; sql?: string };
        if (mRes.ok && mJson.ok) {
          toast.success('Database tables created — retrying…');
          const retry = await fetch('/api/service/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealershipId, ...form.customerName && { customerName: form.customerName }, customerId: selected?.id ?? null, customerPhone: form.customerPhone, vehicleName: form.vehicleName, plate: form.plate, vin: form.vin, description: form.description, priority: form.priority, assignedTech: form.assignedTech, mileage: form.mileage ? Number(form.mileage) : null, laborRate: form.laborRate }),
          });
          if (retry.ok) {
            const { order } = await retry.json();
            router.push(`/service/orders/${order.id}`);
            return;
          }
        }
        setMigrateSql(mJson.sql ?? '-- Run supabase/migration_work_orders.sql in your Supabase SQL editor');
      } else {
        toast.error(msg || t('newOrder.toasts.error'));
      }
    }
  }

  // ── Derived preview values ────────────────────────────────────────────────────

  const hasAnyData = !!(form.customerName || form.vehicleName || form.description);
  const initials   = form.customerName
    ? form.customerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  const priorityBadge = PRIORITY_COLORS[form.priority as keyof typeof PRIORITY_COLORS] ?? 'bg-slate-100 text-slate-500';
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === form.priority)?.label ?? form.priority;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-[#f5f7fa] dark:bg-slate-900">
      <Sidebar />

      {migrateSql && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Database setup required</p>
                <p className="text-xs text-slate-500 mt-0.5">Copy this SQL and run it in Supabase dashboard → SQL Editor</p>
              </div>
              <button onClick={() => setMigrateSql(null)} className="text-slate-400 hover:text-red-500 text-xl font-bold">✕</button>
            </div>
            <div className="p-4">
              <textarea readOnly value={migrateSql} rows={14}
                className="w-full text-[11px] font-mono bg-slate-900 text-green-300 rounded-xl p-4 resize-none focus:outline-none" />
              <div className="flex gap-3 mt-3">
                <button onClick={() => { navigator.clipboard.writeText(migrateSql); toast.success('SQL copied!'); }}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55a1f] transition-colors">
                  📋 Copy SQL
                </button>
                <a href="https://supabase.com/dashboard/project/_/sql/new" target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold text-center hover:bg-slate-700 transition-colors">
                  🔗 Open Supabase SQL Editor
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-5 md:px-8 py-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>›</span>
            <Link href="/service/orders" className="hover:text-[#FF6B2C]">{t('orders.title')}</Link>
            <span>›</span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">{t('newOrder.title')}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524] dark:text-white">{t('newOrder.title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('newOrder.subtitle')}</p>
            </div>
            <Link
              href="/service/orders"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              ← {t('newOrder.actions.cancel')}
            </Link>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex-1 px-5 md:px-8 py-8">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

              {/* ── LEFT: form ── */}
              <div className="xl:col-span-3 space-y-5">

                {/* Customer section */}
                <SectionCard title={t('newOrder.sections.customer')} icon="👤">
                  <div className="relative">
                    <Field label={t('newOrder.fields.searchCustomer')}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                        <input
                          value={custSearch}
                          onChange={e => { setCustSearch(e.target.value); setShowDropdown(true); }}
                          onFocus={() => setShowDropdown(true)}
                          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                          placeholder={t('newOrder.fields.searchPlaceholder')}
                          className={inp + ' pl-9'}
                        />
                      </div>
                    </Field>

                    {showDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl z-20 mt-1 divide-y divide-slate-50 dark:divide-slate-700">
                        {filteredCustomers.map(c => {
                          const ini = `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase();
                          return (
                            <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                              className="w-full flex items-center gap-3 text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-[#FF6B2C] flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {ini}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.firstName} {c.lastName}</p>
                                <p className="text-xs text-slate-400">{c.phone}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selected && (
                    <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 truncate">{selected.firstName} {selected.lastName}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{selected.phone}</p>
                      </div>
                      <button type="button" onClick={clearCustomer} className="text-slate-400 hover:text-red-400 transition-colors p-1">✕</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('newOrder.fields.name')} req>
                      <input
                        value={form.customerName}
                        onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                        className={inp}
                        placeholder={t('newOrder.fields.namePlaceholder')}
                      />
                    </Field>
                    <Field label={t('newOrder.fields.phone')}>
                      <input
                        value={form.customerPhone}
                        onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                        className={inp}
                        placeholder="+46..."
                      />
                    </Field>
                  </div>
                </SectionCard>

                {/* Vehicle section */}
                <SectionCard title={t('newOrder.sections.vehicle')} icon="🏍️">
                  {selected && (loadingVehicles || vehicles.length > 0) ? (
                    <>
                      <Field label={t('newOrder.fields.vehicleSelect')} req>
                        {loadingVehicles ? (
                          <div className="text-xs text-slate-400 py-2">{t('common.loading')}</div>
                        ) : (
                          <select value={vehiclePick} onChange={e => pickVehicle(e.target.value)} className={inp}>
                            <option value="">{t('newOrder.fields.vehicleSelectPlaceholder')}</option>
                            {vehicles.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name}{v.plate ? ` · ${v.plate}` : ''}{v.source === 'purchase' ? ` ${t('newOrder.fields.purchasedHere')}` : ` ${t('newOrder.fields.serviced')}`}
                              </option>
                            ))}
                            <option value="other">{t('newOrder.fields.vehicleOther')}</option>
                          </select>
                        )}
                      </Field>

                      {vehiclePick && vehiclePick !== 'other' && (
                        <div className="grid grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                          <div><span className="font-semibold">{t('newOrder.fields.model')}:</span> {form.vehicleName || '–'}</div>
                          <div><span className="font-semibold">{t('newOrder.fields.regNr')}:</span> {form.plate || '–'}</div>
                          <div><span className="font-semibold">{t('newOrder.fields.vin')}:</span> {form.vin || '–'}</div>
                        </div>
                      )}

                      {vehiclePick === 'other' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <Field label={t('newOrder.fields.model')}>
                              <input value={form.vehicleName} onChange={e => setForm(f => ({ ...f, vehicleName: e.target.value }))} className={inp} placeholder={t('newOrder.fields.modelPlaceholder')} />
                            </Field>
                            <Field label={t('newOrder.fields.regNr')}>
                              <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} className={inp} placeholder={t('newOrder.fields.regNrPlaceholder')} />
                            </Field>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <Field label={t('newOrder.fields.vin')}>
                              <input value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} className={inp} placeholder={t('newOrder.fields.vinPlaceholder')} />
                            </Field>
                            <Field label={t('newOrder.fields.odometer')}>
                              <input type="number" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} className={inp} placeholder="0" />
                            </Field>
                          </div>
                        </div>
                      )}

                      {vehiclePick && vehiclePick !== 'other' && (
                        <Field label={t('newOrder.fields.odometer')}>
                          <input type="number" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} className={inp} placeholder="0" />
                        </Field>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label={t('newOrder.fields.model')}>
                          <input value={form.vehicleName} onChange={e => setForm(f => ({ ...f, vehicleName: e.target.value }))} className={inp} placeholder={t('newOrder.fields.modelPlaceholder')} />
                        </Field>
                        <Field label={t('newOrder.fields.regNr')}>
                          <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} className={inp} placeholder={t('newOrder.fields.regNrPlaceholder')} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label={t('newOrder.fields.vin')}>
                          <input value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} className={inp} placeholder={t('newOrder.fields.vinPlaceholder')} />
                        </Field>
                        <Field label={t('newOrder.fields.odometer')}>
                          <input type="number" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} className={inp} placeholder="0" />
                        </Field>
                      </div>
                      {selected && !loadingVehicles && (
                        <p className="text-xs text-slate-400">{t('newOrder.fields.noVehicleHistory')}</p>
                      )}
                    </>
                  )}

                  {/* Reg lookup */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                      {t('newOrder.vehicle.regPlaceholder')}
                    </p>
                    <RegLookupBlock
                      regQuery={regQuery} setRegQuery={setRegQuery}
                      regLoading={regLoading} regError={regError} regResult={regResult}
                      onLookup={lookupByReg} t={t}
                    />
                  </div>
                </SectionCard>

                {/* Job details section */}
                <SectionCard title={t('newOrder.sections.jobInfo')} icon="📋">
                  <Field label={t('newOrder.fields.description')} req>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={4}
                      placeholder={t('newOrder.fields.descriptionPlaceholder')}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 resize-none bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('newOrder.fields.priority')}>
                      <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inp}>
                        {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </Field>
                    <Field label={t('newOrder.fields.laborRate')}>
                      <div className="relative">
                        <input
                          type="number"
                          value={form.laborRate}
                          onChange={e => setForm(f => ({ ...f, laborRate: Number(e.target.value) }))}
                          className={inp + ' pr-14'}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">kr/tim</span>
                      </div>
                    </Field>
                  </div>

                  <Field label={t('newOrder.fields.technician')}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">👷</span>
                      <select
                        value={form.assignedTech}
                        onChange={e => setForm(f => ({ ...f, assignedTech: e.target.value }))}
                        className={inp + ' pl-9 appearance-none'}
                      >
                        <option value="">{t('newOrder.fields.technicianPlaceholder')}</option>
                        {technicians.map(tech => (
                          <option key={tech.id} value={tech.name}>{tech.name}</option>
                        ))}
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
                    </div>
                  </Field>
                </SectionCard>

                {/* Action buttons */}
                <div className="flex gap-3 pb-8">
                  <Link href="/service/orders"
                    className="flex-1 text-center px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    {t('newOrder.actions.cancel')}
                  </Link>
                  <button type="submit" disabled={saving || !form.customerName || !form.description}
                    className="flex-1 px-4 py-3.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-md shadow-[#FF6B2C]/30">
                    {saving
                      ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> {t('newOrder.actions.submitting')}</span>
                      : t('newOrder.actions.submit')}
                  </button>
                </div>
              </div>

              {/* ── RIGHT: preview + today's orders ── */}
              <div className="xl:col-span-2 space-y-5">

                {/* Live preview card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden sticky top-6">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('newOrder.preview.title')}</h3>
                  </div>

                  {!hasAnyData ? (
                    <div className="px-5 py-8 text-center">
                      <div className="text-3xl mb-3">📋</div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                        {t('newOrder.preview.emptyHint')}
                      </p>
                    </div>
                  ) : (
                    <div className="px-5 py-4">
                      {/* Customer avatar */}
                      {form.customerName && (
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                          <div className="w-10 h-10 rounded-full bg-[#FF6B2C] flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{form.customerName}</p>
                            {form.customerPhone && <p className="text-xs text-slate-400">{form.customerPhone}</p>}
                          </div>
                        </div>
                      )}

                      <div className="space-y-0">
                        <PreviewRow
                          label={t('newOrder.preview.orderNumber')}
                          value={t('newOrder.preview.pending')}
                        />
                        {form.vehicleName && (
                          <PreviewRow
                            label={t('newOrder.preview.vehicle')}
                            value={[form.vehicleName, form.plate].filter(Boolean).join(' · ')}
                            mono
                          />
                        )}
                        {form.vin && (
                          <PreviewRow label="VIN" value={form.vin} mono />
                        )}
                        {form.mileage && (
                          <PreviewRow
                            label={t('newOrder.fields.odometer')}
                            value={`${Number(form.mileage).toLocaleString('sv-SE')} km`}
                          />
                        )}
                        {form.description && (
                          <div className="py-2.5 border-b border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">{t('newOrder.preview.description')}</p>
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">{form.description}</p>
                          </div>
                        )}
                        <div className="pt-2.5 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{t('newOrder.preview.priorityLabel')}</span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${priorityBadge}`}>
                            {priorityLabel}
                          </span>
                        </div>
                        {form.assignedTech && (
                          <PreviewRow label={t('newOrder.preview.technicianLabel')} value={form.assignedTech} />
                        )}
                        <PreviewRow
                          label={t('newOrder.preview.laborRateLabel')}
                          value={`${form.laborRate} kr/tim`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Today's active work orders */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🔧</span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {t('newOrder.todaysOrders.title')}
                      </h3>
                    </div>
                    {todaysOrders.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FF6B2C] text-white text-xs font-bold">
                        {todaysOrders.length}
                      </span>
                    )}
                  </div>

                  <div className="px-2 py-2">
                    {ordersLoading ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-400">{t('common.loading')}</div>
                    ) : todaysOrders.length === 0 ? (
                      <div className="px-3 py-6 text-center">
                        <div className="text-2xl mb-2">✅</div>
                        <p className="text-xs text-slate-400">{t('newOrder.todaysOrders.empty')}</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {todaysOrders.slice(0, 6).map(o => (
                          <TodayOrderCard key={o.id} order={o} t={t} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700">
                    <Link href="/service/orders" className="text-xs font-semibold text-[#FF6B2C] hover:underline">
                      {t('newOrder.todaysOrders.viewAll')} →
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-[#f5f7fa] dark:bg-slate-900">
        <Sidebar />
        <div className="lg:ml-64 flex-1 flex items-center justify-center text-slate-400">Laddar...</div>
      </div>
    }>
      <NewOrderContent />
    </Suspense>
  );
}
