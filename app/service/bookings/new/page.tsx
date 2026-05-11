'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { getCustomers, type Customer } from '@/lib/customers';
import { getServiceBookings, getTechnicians, type ServiceBooking, type Technician, BOOKING_STATUS_COLORS } from '@/lib/service';

interface CustomerVehicle {
  id: string;
  name: string;
  plate: string;
  vin: string;
  source: 'purchase' | 'service';
  lastSeen: string;
}

interface VehicleLookup {
  make: string; model: string; year: number; color: string;
  vin: string; registrationNumber: string; mileage: number;
  bodyClass: string; fuelType: string; engineCC: number;
  vehicleStatus: string; lastInspection: string; nextInspection: string;
  source: string;
}

const inp = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white placeholder:text-slate-400 transition-colors';

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
        {label}{req && <span className="text-[#FF6B2C] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-50 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function NewBookingPage() {
  const router = useRouter();
  const t = useTranslations('service');

  const SERVICE_TYPES = [
    { value: 'maintenance', label: t('serviceTypes.maintenance') },
    { value: 'repair',      label: t('serviceTypes.repair') },
    { value: 'inspection',  label: t('serviceTypes.inspection') },
    { value: 'recall',      label: t('serviceTypes.recall') },
    { value: 'other',       label: t('serviceTypes.other') },
  ];

  const [customers,       setCustomers]       = useState<Customer[]>([]);
  const [technicians,     setTechnicians]     = useState<Technician[]>([]);
  const [todayBookings,   setTodayBookings]   = useState<ServiceBooking[]>([]);
  const [custSearch,      setCustSearch]      = useState('');
  const [selected,        setSelected]        = useState<Customer | null>(null);
  const [vehicles,        setVehicles]        = useState<CustomerVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclePick,     setVehiclePick]     = useState<string>('');
  const [regQuery,        setRegQuery]        = useState('');
  const [regLoading,      setRegLoading]      = useState(false);
  const [regResult,       setRegResult]       = useState<VehicleLookup | null>(null);
  const [regError,        setRegError]        = useState('');
  const [saving,          setSaving]          = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    customerName:  '',
    customerPhone: '',
    customerEmail: '',
    vehicleName:   '',
    plate:         '',
    vin:           '',
    serviceType:   'maintenance',
    description:   '',
    scheduledDate: today,
    scheduledTime: '09:00',
    durationMin:   60,
    assignedTech:  '',
    notes:         '',
  });

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    getCustomers().then(setCustomers);
    getTechnicians().then(setTechnicians);
    getServiceBookings().then(all =>
      setTodayBookings(all.filter(b => b.scheduled_at.startsWith(today) && b.status !== 'cancelled'))
    );
  }, [router, today]);

  function resetVehicle() {
    setVehiclePick('');
    setRegQuery('');
    setRegResult(null);
    setRegError('');
    setForm(f => ({ ...f, vehicleName: '', plate: '', vin: '' }));
  }

  async function selectCustomer(c: Customer) {
    setSelected(c);
    setCustSearch('');
    setVehicles([]);
    resetVehicle();
    setForm(f => ({
      ...f,
      customerName:  `${c.firstName} ${c.lastName}`,
      customerPhone: c.phone,
      customerEmail: c.email,
      vehicleName: '', plate: '', vin: '',
    }));
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setLoadingVehicles(true);
    try {
      const res = await fetch(`/api/customers/${c.id}/vehicles?dealershipId=${encodeURIComponent(dealershipId)}`);
      if (res.ok) {
        const json = await res.json() as { vehicles: CustomerVehicle[] };
        setVehicles(json.vehicles ?? []);
      }
    } finally {
      setLoadingVehicles(false);
    }
  }

  function pickVehicle(id: string) {
    setVehiclePick(id);
    setRegResult(null);
    setRegError('');
    setRegQuery('');
    if (id === 'reg-lookup') {
      setForm(f => ({ ...f, vehicleName: '', plate: '', vin: '' }));
      return;
    }
    const v = vehicles.find(v => v.id === id);
    if (v) setForm(f => ({ ...f, vehicleName: v.name, plate: v.plate || '', vin: v.vin || '' }));
  }

  async function lookupByReg() {
    const q = regQuery.trim().toUpperCase().replace(/\s/g, '');
    if (!q) return;
    setRegLoading(true);
    setRegError('');
    setRegResult(null);
    try {
      const res = await fetch(`/api/vehicle-lookup?query=${encodeURIComponent(q)}`);
      const data = await res.json() as VehicleLookup;
      if (data.source === 'not_found' || !data.make) {
        setRegError(t('newBooking.vehicle.notFound'));
      } else {
        setRegResult(data);
        const name = [data.make, data.model, data.year].filter(Boolean).join(' ');
        setForm(f => ({ ...f, vehicleName: name, plate: data.registrationNumber || q, vin: data.vin || '' }));
      }
    } catch {
      setRegError(t('newBooking.vehicle.lookupFailed'));
    } finally {
      setRegLoading(false);
    }
  }

  function clearCustomer() {
    setSelected(null);
    setVehicles([]);
    resetVehicle();
    setForm(f => ({ ...f, customerName: '', customerPhone: '', customerEmail: '', vehicleName: '', plate: '', vin: '' }));
  }

  const filteredCustomers = custSearch.trim().length > 1
    ? customers.filter(c =>
        `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase().includes(custSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dealershipId = getDealershipId();
    if (!dealershipId) { toast.error(t('newBooking.toasts.noDealership')); return; }
    if (!form.scheduledDate) { toast.error(t('newBooking.toasts.noDate')); return; }

    setSaving(true);
    const scheduledAt = `${form.scheduledDate}T${form.scheduledTime}:00`;
    const res = await fetch('/api/service/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        customerId:    selected?.id ?? null,
        customerName:  form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        vehicleName:   form.vehicleName,
        plate:         form.plate,
        vin:           form.vin,
        serviceType:   form.serviceType,
        description:   form.description,
        scheduledAt,
        durationMin:   form.durationMin,
        assignedTech:  form.assignedTech,
        notes:         form.notes,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(t('newBooking.toasts.created'));
      router.push('/service/bookings');
    } else {
      toast.error(t('newBooking.toasts.error'));
    }
  }

  // Booking preview derived from form state
  const serviceLabel = SERVICE_TYPES.find(s => s.value === form.serviceType)?.label ?? form.serviceType;
  const previewReady = !!(form.customerName && form.scheduledDate);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-5 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
            <Link href="/service" className="hover:text-[#FF6B2C] transition-colors">{t('dashboard.title')}</Link>
            <span>›</span>
            <Link href="/service/bookings" className="hover:text-[#FF6B2C] transition-colors">{t('bookings.title')}</Link>
            <span>›</span>
            <span className="text-slate-700 font-medium">{t('newBooking.title')}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900">{t('newBooking.title')}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{t('newBooking.subtitle')}</p>
            </div>
            <Link
              href="/service/bookings"
              className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors"
            >
              ← {t('newBooking.actions.cancel')}
            </Link>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex-1 px-5 md:px-8 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 max-w-7xl">

            {/* ── LEFT: Form ─────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="xl:col-span-3 space-y-4">

              {/* Customer */}
              <SectionCard icon="👤" title={t('newBooking.sections.customer')}>
                {/* Search */}
                <div className="relative">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                      value={custSearch}
                      onChange={e => setCustSearch(e.target.value)}
                      placeholder={t('newBooking.fields.searchPlaceholder')}
                      className={inp + ' pl-8'}
                    />
                  </div>
                  {filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 mt-1 divide-y divide-slate-50 overflow-hidden">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCustomer(c)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                            {c.firstName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{c.firstName} {c.lastName}</p>
                            <p className="text-xs text-slate-400">{c.phone} · {c.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selected && (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
                      {selected.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-800">{selected.firstName} {selected.lastName}</p>
                      <p className="text-xs text-emerald-600">{selected.phone} · {selected.email}</p>
                    </div>
                    <button type="button" onClick={clearCustomer} className="text-slate-400 hover:text-red-400 text-sm transition-colors">✕</button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('newBooking.fields.name')} req>
                    <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                      placeholder={t('newBooking.fields.namePlaceholder')} className={inp} />
                  </Field>
                  <Field label={t('newBooking.fields.phone')}>
                    <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                      placeholder="+46…" className={inp} />
                  </Field>
                </div>
                <Field label={t('newBooking.fields.email')}>
                  <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                    placeholder="kund@example.com" className={inp} />
                </Field>
              </SectionCard>

              {/* Vehicle */}
              <SectionCard icon="🏍️" title={t('newBooking.sections.vehicle')}>
                {selected ? (
                  loadingVehicles ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-300 border-t-[#FF6B2C] rounded-full" />
                      {t('common.loading')}
                    </div>
                  ) : vehicles.length > 0 ? (
                    <>
                      <Field label={t('newBooking.vehicle.select')}>
                        <select value={vehiclePick} onChange={e => pickVehicle(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30">
                          <option value="">{t('newBooking.vehicle.selectPlaceholder')}</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name}{v.plate ? ` · ${v.plate}` : ''}{v.source === 'purchase' ? ` ${t('newBooking.vehicle.purchasedHere')}` : ` ${t('newBooking.vehicle.serviced')}`}
                            </option>
                          ))}
                          <option value="reg-lookup">{t('newBooking.vehicle.regLookup')}</option>
                        </select>
                      </Field>

                      {vehiclePick && vehiclePick !== 'reg-lookup' && (
                        <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-600">
                          <div><span className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">{t('newBooking.vehicle.model')}</span>{form.vehicleName || '–'}</div>
                          <div><span className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">{t('newBooking.vehicle.regNr')}</span>{form.plate || '–'}</div>
                          <div><span className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">{t('newBooking.vehicle.vin')}</span><span className="font-mono">{form.vin || '–'}</span></div>
                        </div>
                      )}

                      {vehiclePick === 'reg-lookup' && (
                        <RegLookupBlock regQuery={regQuery} setRegQuery={setRegQuery} regLoading={regLoading}
                          regError={regError} regResult={regResult} onLookup={lookupByReg} t={t} />
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400">{t('newBooking.vehicle.noHistory')}</p>
                      <RegLookupBlock regQuery={regQuery} setRegQuery={setRegQuery} regLoading={regLoading}
                        regError={regError} regResult={regResult} onLookup={lookupByReg} t={t} />
                    </>
                  )
                ) : (
                  <>
                    <p className="text-xs text-slate-400">{t('newBooking.vehicle.walkIn')}</p>
                    <RegLookupBlock regQuery={regQuery} setRegQuery={setRegQuery} regLoading={regLoading}
                      regError={regError} regResult={regResult} onLookup={lookupByReg} t={t} />
                  </>
                )}
              </SectionCard>

              {/* Service details + scheduling */}
              <SectionCard icon="🔧" title={t('newBooking.sections.serviceInfo')}>
                <Field label={t('newBooking.fields.serviceType')} req>
                  <select value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30">
                    {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>

                <Field label={t('newBooking.fields.description')}>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder={t('newBooking.fields.descriptionPlaceholder')}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 resize-none placeholder:text-slate-400" />
                </Field>

                <div className="grid grid-cols-3 gap-3">
                  <Field label={t('newBooking.fields.date')} req>
                    <input type="date" value={form.scheduledDate} min={today}
                      onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30" />
                  </Field>
                  <Field label={t('newBooking.fields.time')}>
                    <input type="time" value={form.scheduledTime}
                      onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30" />
                  </Field>
                  <Field label={t('newBooking.fields.duration')}>
                    <input type="number" value={form.durationMin}
                      onChange={e => setForm(f => ({ ...f, durationMin: Number(e.target.value) }))}
                      className={inp} />
                  </Field>
                </div>

                <Field label={t('newBooking.fields.technician')}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">👷</span>
                    <select
                      value={form.assignedTech}
                      onChange={e => setForm(f => ({ ...f, assignedTech: e.target.value }))}
                      className={inp + ' pl-9 appearance-none'}
                    >
                      <option value="">{t('newBooking.fields.technicianPlaceholder')}</option>
                      {technicians.map(tech => (
                        <option key={tech.id} value={tech.name}>{tech.name}</option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
                  </div>
                </Field>

                <Field label={t('newBooking.fields.notes')}>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder={t('newBooking.fields.notesPlaceholder')}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 resize-none placeholder:text-slate-400" />
                </Field>
              </SectionCard>

              {/* Actions */}
              <div className="flex gap-3 pb-8">
                <Link href="/service/bookings"
                  className="flex-1 text-center px-4 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                  {t('newBooking.actions.cancel')}
                </Link>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-50"
                  style={{ background: '#FF6B2C' }}>
                  {saving ? t('newBooking.actions.submitting') : t('newBooking.actions.submit')}
                </button>
              </div>
            </form>

            {/* ── RIGHT: Live preview + schedule ─────────────────── */}
            <div className="xl:col-span-2 space-y-4">

              {/* Booking preview card */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50"
                  style={{ background: 'linear-gradient(135deg, #0b1524 0%, #1a2a40 100%)' }}>
                  <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-0.5">{t('newBooking.preview.heading')}</p>
                  <p className="text-sm font-bold text-white">{t('newBooking.preview.subtitle')}</p>
                </div>
                <div className="p-5 space-y-3">
                  {previewReady ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-base font-black text-slate-500 shrink-0">
                          {form.customerName[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{form.customerName || '—'}</p>
                          <p className="text-xs text-slate-400">{form.customerPhone || form.customerEmail || '—'}</p>
                        </div>
                      </div>
                      <div className="h-px bg-slate-50" />
                      <div className="space-y-2 text-xs">
                        <PreviewRow icon="🏍️" label={t('newBooking.preview.vehicle')} value={form.vehicleName || (form.plate ? `Reg: ${form.plate}` : '—')} />
                        <PreviewRow icon="🔧" label={t('newBooking.preview.service')} value={serviceLabel} />
                        <PreviewRow icon="📅" label={t('newBooking.preview.date')}
                          value={form.scheduledDate
                            ? new Date(`${form.scheduledDate}T${form.scheduledTime}`).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
                            : '—'} />
                        <PreviewRow icon="🕐" label={t('newBooking.preview.time')} value={`${form.scheduledTime} · ${form.durationMin} min`} />
                        {form.assignedTech && <PreviewRow icon="👷" label={t('newBooking.preview.technician')} value={form.assignedTech} />}
                        {form.description && (
                          <div className="bg-slate-50 rounded-xl p-3 mt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{t('newBooking.preview.matter')}</p>
                            <p className="text-xs text-slate-600 leading-relaxed">{form.description}</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-3xl mb-2">📋</p>
                      <p className="text-xs text-slate-400 font-medium">{t('newBooking.preview.empty')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Today's live schedule */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t('newBooking.schedule.title')}</p>
                    <p className="text-xs text-slate-400">
                      {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    {t('newBooking.schedule.count', { n: todayBookings.length })}
                  </span>
                </div>

                {todayBookings.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-2xl mb-1">📅</p>
                    <p className="text-xs text-slate-400">{t('newBooking.schedule.empty')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                    {todayBookings.map(b => (
                      <Link key={b.id} href={`/service/bookings/${b.id}`} target="_blank"
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                        <div className="shrink-0 w-12 text-center">
                          <p className="text-xs font-black text-slate-700">{fmt(b.scheduled_at)}</p>
                          <p className="text-[9px] text-slate-400">{b.duration_min}m</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#FF6B2C] transition-colors">
                            {b.customer_name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{b.vehicle_name || b.plate || '—'}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BOOKING_STATUS_COLORS[b.status]}`}>
                          {t(`bookingStatus.${b.status}` as Parameters<typeof t>[0])}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="px-5 py-3 border-t border-slate-50">
                  <Link href="/service/bookings" className="text-xs font-semibold text-[#FF6B2C] hover:underline">
                    {t('newBooking.schedule.viewAll')} →
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm shrink-0 mt-px">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
        <p className="text-slate-700 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function RegLookupBlock({ regQuery, setRegQuery, regLoading, regError, regResult, onLookup, t }: {
  regQuery: string; setRegQuery: (v: string) => void; regLoading: boolean;
  regError: string; regResult: VehicleLookup | null; onLookup: () => void;
  t: ReturnType<typeof useTranslations<'service'>>;
}) {
  const inp2 = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white placeholder:text-slate-400';
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={regQuery} onChange={e => setRegQuery(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onLookup(); } }}
          placeholder={t('newBooking.vehicle.regPlaceholder')}
          className={inp2 + ' flex-1 tracking-widest font-mono'} maxLength={17} />
        <button type="button" onClick={() => onLookup()} disabled={regLoading || !regQuery.trim()}
          className="px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors whitespace-nowrap"
          style={{ background: '#FF6B2C' }}>
          {regLoading ? '...' : t('newBooking.vehicle.searchBtn')}
        </button>
      </div>

      {regError && <p className="text-xs text-red-500">{regError}</p>}

      {regResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-700 font-bold text-xs">✓ {t('newBooking.vehicle.found')}</span>
            <span className="ml-auto text-[10px] text-slate-400 bg-white rounded px-1.5 py-px">{regResult.source}</span>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {[regResult.make, regResult.model, regResult.year].filter(Boolean).join(' ')}
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
            <div><span className="text-slate-400">{t('newBooking.vehicle.regNr')}</span> <span className="font-mono font-semibold">{regResult.registrationNumber || regQuery}</span></div>
            {regResult.vin        && <div><span className="text-slate-400">{t('newBooking.vehicle.vin')}</span> <span className="font-mono text-[10px]">{regResult.vin}</span></div>}
            {regResult.color      && <div><span className="text-slate-400">{t('newBooking.vehicle.color')}</span> {regResult.color}</div>}
            {regResult.fuelType   && <div><span className="text-slate-400">{t('newBooking.vehicle.fuel')}</span> {regResult.fuelType}</div>}
            {regResult.engineCC > 0 && <div><span className="text-slate-400">{t('newBooking.vehicle.engine')}</span> {regResult.engineCC} cc</div>}
            {regResult.mileage > 0  && <div><span className="text-slate-400">{t('newBooking.vehicle.odometer')}</span> {regResult.mileage.toLocaleString('sv-SE')} km</div>}
            {regResult.nextInspection && <div><span className="text-slate-400">{t('newBooking.vehicle.nextInspection')}</span> {regResult.nextInspection.slice(0, 10)}</div>}
            <div>
              <span className="text-slate-400">{t('newBooking.vehicle.status')}</span>{' '}
              <span className={regResult.vehicleStatus === 'REGISTERED' ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                {regResult.vehicleStatus === 'REGISTERED' ? t('newBooking.vehicle.registered') : regResult.vehicleStatus}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
