'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealerInfo } from '@/lib/dealer';
import { getCustomerById, type Customer } from '@/lib/customers';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';
import { useAutoRefresh } from '@/lib/realtime';
import { getInvoicesByCustomer } from '@/lib/invoices';
import DocumentAttachments from '@/components/DocumentAttachments';

type ProfileTab = 'overview' | 'vehicles' | 'purchases' | 'invoices' | 'documents' | 'timeline' | 'gdpr';
type SourceKey = 'BankID' | 'Folkbokföring' | 'Manuell';

interface PurchaseItem {
  invoiceId: string;
  date: string;
  amount: number;
  status: string;
  vehicle: string;
  vehicleColor: string;
  accessories: { name: string; qty: number; itemType: 'accessory' | 'spare_part' }[];
  paymentMethod: string;
}

// ── localStorage cache ─────────────────────────────────────────────────────────
interface LiveCache {
  liveInvoices:   any[];
  liveBankidLogs: any[];
  liveVehicles:   any[];
  liveTimeline:   any[];
  livePurchases:  PurchaseItem[];
  npsScore:       string | null;
  liveRisk:       string | null;
  cachedAt:       number;
}
const cacheKey = (id: string) => `biken_customer_${id}`;
function readCache(id: string): LiveCache | null {
  try { const r = localStorage.getItem(cacheKey(id)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function writeCache(id: string, data: LiveCache) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(data)); } catch {}
}

// Subtle dot-based source indicator — no loud colored badges
function SourceDot({ src }: { src: SourceKey }) {
  const styles: Record<SourceKey, string> = {
    BankID:        'bg-[#235971]',
    Folkbokföring: 'bg-emerald-500',
    Manuell:       'bg-[#FF6B2C]',
  };
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles[src]}`} />
      {src}
    </span>
  );
}

function FieldRow({ label, value, src }: { label: string; value: string; src: SourceKey }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-sm text-slate-900 truncate">{value}</span>
        <SourceDot src={src} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
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
    outstanding: 0,
    nps: '9/10',
    vehicles: [
      { name: 'Kawasaki Ninja ZX-6R', year: 2024, plate: 'ABC 123', status: 'Aktiv' },
      { name: 'Yamaha MT-07',          year: 2022, plate: 'DEF 456', status: 'Aktiv' },
      { name: 'Honda CB500F',          year: 2020, plate: 'GHI 789', status: 'Såld'  },
    ],
    invoices: [
      { id: 'INV-2026-001', desc: 'Kawasaki Ninja ZX-6R',    amount: 133280, date: '8 feb 2026',   status: 'paid' },
      { id: 'INV-2023-042', desc: 'Yamaha MT-07',             amount: 89900,  date: '15 mar 2023', status: 'paid' },
      { id: 'INV-2021-018', desc: 'Honda CB500F + tillbehör', amount: 115400, date: '2 jun 2021',  status: 'paid' },
    ],
    bankidHistory: [
      { date: '8 feb 2026, 14:32', action: 'Identifiering — Risk: Låg',       status: 'Godkänd' },
      { date: '8 feb 2026, 14:45', action: 'Signering köpeavtal — Risk: Låg', status: 'Godkänd' },
      { date: '15 mar 2023, 10:12', action: 'Identifiering — Risk: Låg',      status: 'Godkänd' },
    ],
    timeline: [
      { date: '8 feb 2026',  event: 'Köpte Kawasaki Ninja ZX-6R — 133 280 kr',   type: 'purchase' },
      { date: '8 feb 2026',  event: 'Köpeavtal signerat med BankID',              type: 'bankid'   },
      { date: '15 mar 2023', event: 'Köpte Yamaha MT-07 — 89 900 kr',            type: 'purchase' },
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
    totalSpent: 256400, outstanding: 0, nps: '8/10',
    vehicles: [
      { name: 'Kawasaki Z900', year: 2023, plate: 'JKL 012', status: 'Aktiv' },
      { name: 'Honda CB650R', year: 2021, plate: 'MNO 345', status: 'Aktiv' },
    ],
    invoices: [
      { id: 'INV-2023-055', desc: 'Kawasaki Z900', amount: 128000, date: '10 jan 2023', status: 'paid' },
      { id: 'INV-2021-031', desc: 'Honda CB650R',  amount: 105000, date: '5 apr 2021',  status: 'paid' },
    ],
    bankidHistory: [
      { date: '6 feb 2026, 09:14', action: 'Identifiering — Risk: Låg', status: 'Godkänd' },
    ],
    timeline: [
      { date: '6 feb 2026',  event: 'BankID-identifiering genomförd', type: 'bankid'   },
      { date: '10 jan 2023', event: 'Köpte Kawasaki Z900 — 128 000 kr', type: 'purchase' },
    ],
  },
};

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
    totalSpent: 0, outstanding: 0, nps: '—',
    vehicles: [], invoices: [], bankidHistory: [], timeline: [],
  };
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const t = useTranslations('customers');

  const [ready, setReady] = useState(false);
  const [loadingLive, setLoadingLive] = useState(true);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [dealerEmail, setDealerEmail] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [liveInvoices,   setLiveInvoices]   = useState<any[]>([]);
  const [liveTimeline,   setLiveTimeline]   = useState<any[]>([]);
  const [liveBankidLogs, setLiveBankidLogs] = useState<any[]>([]);
  const [liveVehicles,   setLiveVehicles]   = useState<any[]>([]);
  const [livePurchases,  setLivePurchases]  = useState<PurchaseItem[]>([]);
  const [npsScore,       setNpsScore]       = useState<string | null>(null);
  const [liveRisk,       setLiveRisk]       = useState<string | null>(null);
  const [syncing,        setSyncing]        = useState(false);
  const [editMode,       setEditMode]       = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [editValues,     setEditValues]     = useState({ email: '', phone: '', tag: 'Active' as Customer['tag'], notes: '', npsScore: '' });
  const [editingNps,     setEditingNps]     = useState(false);

  const loadLiveData = useCallback(async () => {
    const dealershipId = getDealershipId();
    const custId = parseInt(id);
    if (isNaN(custId) || !dealershipId) return;

    setSyncing(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;

    // NPS score + risk level fetched directly from customers table
    const { data: custRow } = await sb
      .from('customers')
      .select('nps_score, risk_level')
      .eq('id', custId)
      .maybeSingle();
    setNpsScore(custRow?.nps_score != null ? String(custRow.nps_score) : null);
    setLiveRisk(custRow?.risk_level ?? null);

    // BankID logs
    const { data: bankidRows } = await sb
      .from('customer_bankid_logs')
      .select('id, action, status, risk_level, created_at')
      .eq('customer_id', custId)
      .order('created_at', { ascending: false });
    const mappedBankidLogs = (bankidRows ?? []).map((r: any) => ({
      date:   new Date(r.created_at).toLocaleString('sv-SE'),
      action: `${r.action.replace(/_/g, ' ')}${r.risk_level ? ` — Risk: ${r.risk_level}` : ''}`,
      status: r.status === 'success' ? 'Godkänd' : r.status === 'failed' ? 'Nekad' : 'Väntande',
    }));
    setLiveBankidLogs(mappedBankidLogs);

    // Invoices
    const invoices = await getInvoicesByCustomer(custId);
    const mappedInvoices = invoices.map(inv => ({
      id:     inv.id,
      desc:   inv.vehicle ?? '—',
      amount: inv.totalAmount,
      date:   new Date(inv.issueDate).toLocaleDateString('sv-SE'),
      status: inv.status,
    }));
    setLiveInvoices(mappedInvoices);

    // Leads — used for vehicles + timeline
    const { data: leads } = await sb
      .from('leads')
      .select('id, bike, created_at, closed_at, stage')
      .eq('customer_id', custId)
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false });

    // Live vehicles derived from leads (deduplicated by bike name)
    const seenBikes = new Set<string>();
    const bikes: any[] = [];
    for (const lead of (leads ?? [])) {
      if (!lead.bike || seenBikes.has(lead.bike)) continue;
      seenBikes.add(lead.bike);
      bikes.push({
        name:   lead.bike,
        status: lead.closed_at ? 'Köpt' : 'Pågående',
        date:   new Date(lead.closed_at || lead.created_at).toLocaleDateString('sv-SE'),
      });
    }
    setLiveVehicles(bikes);

    // Timeline — leads + invoices merged and sorted
    const events: { date: string; event: string; type: string; ts: number }[] = [];
    for (const lead of (leads ?? [])) {
      events.push({ ts: new Date(lead.created_at).getTime(), date: new Date(lead.created_at).toLocaleDateString('sv-SE'), event: `Lead skapad — ${lead.bike}`, type: 'lead' });
      if (lead.closed_at) events.push({ ts: new Date(lead.closed_at).getTime(), date: new Date(lead.closed_at).toLocaleDateString('sv-SE'), event: `Köp genomfört — ${lead.bike}`, type: 'purchase' });
    }
    for (const inv of invoices) {
      events.push({ ts: new Date(inv.issueDate).getTime(), date: new Date(inv.issueDate).toLocaleDateString('sv-SE'), event: `Faktura skapad — ${inv.vehicle}: ${inv.totalAmount.toLocaleString('sv-SE')} kr`, type: 'invoice' });
      if (inv.paidDate) events.push({ ts: new Date(inv.paidDate).getTime(), date: new Date(inv.paidDate).toLocaleDateString('sv-SE'), event: `Faktura betald — ${inv.vehicle}: ${inv.totalAmount.toLocaleString('sv-SE')} kr`, type: 'payment' });
    }
    events.sort((a, b) => b.ts - a.ts);
    const mappedTimeline = events.map(e => ({ date: e.date, event: e.event, type: e.type }));
    setLiveTimeline(mappedTimeline);

    const resolvedNps  = custRow?.nps_score  != null ? String(custRow.nps_score)  : null;
    const resolvedRisk = custRow?.risk_level ?? null;

    // ── Fetch offer accessories + inventory names for Purchases tab ────────────
    const leadIds = (leads ?? []).map((l: any) => l.id as number);
    const offerMap: Record<number, { vehicle: string; vehicleColor: string; accessories: string }> = {};

    if (leadIds.length > 0) {
      const { data: offerRows } = await sb
        .from('offers')
        .select('lead_id, vehicle, vehicle_color, accessories')
        .in('lead_id', leadIds)
        .eq('dealership_id', dealershipId);
      for (const o of (offerRows ?? [])) {
        offerMap[o.lead_id as number] = {
          vehicle:     (o.vehicle        as string) ?? '',
          vehicleColor:(o.vehicle_color  as string) ?? '',
          accessories: (o.accessories    as string) ?? '',
        };
      }
    }

    // Collect accessory / spare-part IDs needing a name lookup
    const accIds: string[] = [];
    const spIds:  string[] = [];
    for (const offer of Object.values(offerMap)) {
      if (!offer.accessories) continue;
      try {
        const items = JSON.parse(offer.accessories) as { id: string; qty: number }[];
        for (const item of items) {
          if (!item.id) continue;
          if (item.id.startsWith('SP-')) spIds.push(item.id);
          else accIds.push(item.id);
        }
      } catch { /* not valid JSON – skip */ }
    }

    const accNameMap: Record<string, string> = {};
    const spNameMap:  Record<string, string> = {};
    if (accIds.length > 0) {
      const { data: accRows } = await sb.from('accessories').select('id, name').in('id', accIds).eq('dealership_id', dealershipId);
      for (const a of (accRows ?? [])) accNameMap[a.id as string] = a.name as string;
    }
    if (spIds.length > 0) {
      const { data: spRows } = await sb.from('spare_parts').select('id, name').in('id', spIds).eq('dealership_id', dealershipId);
      for (const s of (spRows ?? [])) spNameMap[s.id as string] = s.name as string;
    }

    // Build one PurchaseItem per paid invoice
    const purchases: PurchaseItem[] = [];
    for (const inv of invoices) {
      const offer = inv.leadId ? offerMap[Number(inv.leadId)] : undefined;
      const accItems: PurchaseItem['accessories'] = [];
      if (offer?.accessories) {
        try {
          const items = JSON.parse(offer.accessories) as { id: string; qty: number }[];
          for (const item of items) {
            const isSP  = item.id.startsWith('SP-');
            const name  = isSP ? (spNameMap[item.id] ?? item.id) : (accNameMap[item.id] ?? item.id);
            accItems.push({ name, qty: item.qty, itemType: isSP ? 'spare_part' : 'accessory' });
          }
        } catch { /* skip */ }
      }
      purchases.push({
        invoiceId:     inv.id,
        date:          new Date(inv.issueDate).toLocaleDateString('sv-SE'),
        amount:        inv.totalAmount,
        status:        inv.status,
        vehicle:       offer?.vehicle ?? inv.vehicle ?? '—',
        vehicleColor:  offer?.vehicleColor ?? '',
        accessories:   accItems,
        paymentMethod: inv.paymentMethod ?? '',
      });
    }
    setLivePurchases(purchases);

    // Write everything to localStorage cache for instant next load
    writeCache(id, {
      liveInvoices:   mappedInvoices,
      liveBankidLogs: mappedBankidLogs,
      liveVehicles:   bikes,
      liveTimeline:   mappedTimeline,
      livePurchases:  purchases,
      npsScore:       resolvedNps,
      liveRisk:       resolvedRisk,
      cachedAt:       Date.now(),
    });

    setSyncing(false);
    setLoadingLive(false);
  }, [id]);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.push('/auth/login'); return; }
    setDealerEmail(getDealerInfo().email);

    // Hydrate from localStorage cache instantly — Supabase fetch runs in background
    const cached = readCache(id);
    if (cached) {
      setLiveInvoices(cached.liveInvoices ?? []);
      setLiveBankidLogs(cached.liveBankidLogs ?? []);
      setLiveVehicles(cached.liveVehicles ?? []);
      setLiveTimeline(cached.liveTimeline ?? []);
      setLivePurchases(cached.livePurchases ?? []);
      setNpsScore(cached.npsScore ?? null);
      setLiveRisk(cached.liveRisk ?? null);
      setLoadingLive(false); // show cached data immediately; syncing spinner shown instead
    }

    getCustomerById(parseInt(id)).then(c => {
      if (c) {
        setCustomer(c);
        // Pre-fill edit values from customer record
        setEditValues(prev => ({
          ...prev,
          email: c.email ?? '',
          phone: c.phone ?? '',
          tag:   c.tag  ?? 'Active',
          notes: c.notes ?? '',
        }));
        // Also cache the customer in localStorage
        try { localStorage.setItem(`biken_customer_meta_${id}`, JSON.stringify(c)); } catch {}
      }
    });
    loadLiveData();
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(loadLiveData);

  function handleGdprExport() {
    if (!c) return;
    const exportData = {
      exportedAt:      new Date().toISOString(),
      exportedBy:      'BikeMeNow Dealership System',
      legalBasis:      'GDPR Art. 15 — Rätt till tillgång',
      retentionPolicy: 'Bokföringslagen 7 år (fakturor) · GDPR 3 år (övriga kunduppgifter)',
      customer: {
        id:             c.id,
        firstName:      c.firstName,
        lastName:       c.lastName,
        personnummer:   c.personnummer,
        email:          c.email,
        phone:          c.phone,
        address:        c.address,
        birthDate:      c.birthDate,
        gender:         c.gender,
        bankidVerified: c.bankidVerified,
        protectedIdentity: c.protectedIdentity,
      },
      invoices:    liveInvoices,
      bankidLogs:  liveBankidLogs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gdpr-export-${c.id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('GDPR-data exporterad (Art. 15)');
  }

  async function handleSave() {
    if (!customer) return;
    const dealershipId = getDealershipId();
    if (!dealershipId) { toast.error('Ingen dealership-kontext'); return; }
    setSaving(true);
    try {
      const custId = parseInt(id);
      const npsNum = editValues.npsScore.trim() !== ''
        ? parseFloat(editValues.npsScore)
        : null;

      // Single server-side call — uses service-role key, bypasses RLS
      const res = await fetch('/api/customers/update', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId,
          id: custId,
          fields: {
            email:     editValues.email,
            phone:     editValues.phone,
            tag:       editValues.tag,
            notes:     editValues.notes,
            nps_score: npsNum,
          },
        }),
      });

      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      // Update local Customer state
      const updated: Customer = {
        ...customer,
        email: editValues.email,
        phone: editValues.phone,
        tag:   editValues.tag,
        notes: editValues.notes,
      };
      setCustomer(updated);
      setNpsScore(npsNum != null ? String(npsNum) : null);

      // Persist to localStorage
      try {
        localStorage.setItem(`biken_customer_meta_${id}`, JSON.stringify(updated));
        const cached = readCache(id);
        writeCache(id, {
          ...(cached ?? { liveInvoices: [], liveBankidLogs: [], liveVehicles: [], liveTimeline: [], livePurchases: [], liveRisk: null, cachedAt: Date.now() }),
          npsScore: npsNum != null ? String(npsNum) : null,
        });
      } catch {}

      setEditMode(false);
      setEditingNps(false);
      toast.success('Kunduppgifter sparade');
    } catch (err) {
      console.error('[handleSave]', err);
      toast.error(`Kunde inte spara: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const mockC = MOCK_DB[id];

  // Resolve vehicles: prefer live (from leads), fall back to mock for demo IDs
  const resolvedVehicles = liveVehicles.length > 0 ? liveVehicles : (mockC?.vehicles ?? []);
  const resolvedInvoices = liveInvoices.length > 0 ? liveInvoices : (mockC?.invoices ?? []);
  const resolvedTimeline = liveTimeline.length > 0 ? liveTimeline : (mockC?.timeline ?? []);

  const c = customer
    ? {
        outstanding:   mockC?.outstanding   ?? 0,
        nps:           npsScore ?? mockC?.nps ?? '—',
        citizenship:   customer.citizenship  ?? mockC?.citizenship   ?? 'Svensk',
        customerSince: customer.customerSince || mockC?.customerSince || '—',
        lastBankID:    mockC?.lastBankID    ?? '—',
        risk:          liveRisk ?? customer.riskLevel ?? mockC?.risk ?? 'Låg',
        bankidHistory: liveBankidLogs.length > 0 ? liveBankidLogs : (mockC?.bankidHistory ?? []),
        vehicles:      resolvedVehicles,
        invoices:      resolvedInvoices,
        timeline:      resolvedTimeline,
        id:                customer.id,
        firstName:         customer.firstName,
        lastName:          customer.lastName,
        personnummer:      customer.personnummer,
        email:             customer.email,
        phone:             customer.phone,
        address:           customer.address,
        birthDate:         customer.birthDate,
        gender:            customer.gender,
        bankidVerified:    customer.bankidVerified,
        protectedIdentity: customer.protectedIdentity,
        tag:               customer.tag,
        totalSpent:        customer.lifetimeValue,
      }
    : mockC
      ? { ...mockC, vehicles: resolvedVehicles, invoices: resolvedInvoices, timeline: resolvedTimeline, bankidHistory: liveBankidLogs.length > 0 ? liveBankidLogs : (mockC.bankidHistory ?? []) }
      : null;

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
    { id: 'overview',  label: t('profile.tabs.overview') },
    { id: 'vehicles',  label: t('profile.tabs.vehicles'),  count: c.vehicles?.length ?? 0 },
    { id: 'purchases', label: 'Anskaffningar',             count: livePurchases.length },
    { id: 'invoices',  label: t('profile.tabs.invoices'),  count: c.invoices?.length  ?? 0 },
    { id: 'documents', label: t('profile.tabs.documents') },
    { id: 'timeline',  label: t('profile.tabs.timeline') },
    { id: 'gdpr',      label: t('profile.tabs.gdpr') },
  ];

  const totalSpentDisplay = (c.totalSpent ?? 0) > 0
    ? `${(c.totalSpent as number).toLocaleString('sv-SE')} kr`
    : liveInvoices.reduce((s: number, i: any) => s + (i.amount ?? 0), 0) > 0
      ? `${liveInvoices.reduce((s: number, i: any) => s + (i.amount ?? 0), 0).toLocaleString('sv-SE')} kr`
      : '0 kr';

  // Timeline event icon map
  const eventIcon: Record<string, string> = {
    lead:     '📋',
    purchase: '✅',
    invoice:  '🧾',
    payment:  '💳',
    bankid:   '🔒',
    default:  '•',
  };

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Profile header ── */}
        <div className="bg-white border-b border-slate-100 px-5 md:px-8">

          {/* Breadcrumb */}
          <div className="text-xs text-slate-400 pt-5 pb-4 flex items-center gap-1.5">
            <button onClick={() => router.push('/customers')} className="hover:text-slate-600 transition-colors">{t('title')}</button>
            <span>/</span>
            <span className="text-slate-600 font-medium">{c.firstName} {c.lastName}</span>
          </div>

          {/* Avatar + name + actions row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-[#0b1524] text-white font-bold text-lg flex items-center justify-center shrink-0">
                {c.firstName[0]}{c.lastName[0]}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h1 className="text-xl font-bold text-slate-900">{c.firstName} {c.lastName}</h1>
                  {c.bankidVerified && (
                    <span className="text-[11px] bg-[#235971]/10 text-[#235971] border border-[#235971]/20 px-2 py-0.5 rounded-full font-semibold">🔐 BankID</span>
                  )}
                  {c.tag === 'VIP' && (
                    <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">⭐ VIP</span>
                  )}
                  {c.protectedIdentity && (
                    <span className="text-[11px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-semibold">🛡 {t('profile.fields.protectedIdentity')}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  {c.personnummer && <span className="font-mono">{c.personnummer}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                  {c.risk && (
                    <span className={`font-medium px-2 py-0.5 rounded-full border ${
                      String(c.risk).toLowerCase().includes('hög') || String(c.risk).toLowerCase() === 'high'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : String(c.risk).toLowerCase().includes('medel') || String(c.risk).toLowerCase() === 'medium'
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>Risk: {c.risk}</span>
                  )}
                  {c.customerSince && c.customerSince !== '—' && (
                    <span className="text-slate-400">Kund sedan {c.customerSince}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons + syncing indicator */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {syncing && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-3 h-3 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                  Synkar…
                </span>
              )}
              <button
                onClick={() => router.push(
                  `/sales/leads/new?customerId=${c.id}&name=${encodeURIComponent(`${c.firstName} ${c.lastName}`)}&email=${encodeURIComponent(c.email ?? '')}&phone=${encodeURIComponent(c.phone ?? '')}`
                )}
                className="bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {t('profile.actions.newQuote')}
              </button>
              <button
                onClick={handleGdprExport}
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                {t('profile.actions.gdprExport')}
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-6 pb-4 border-b border-slate-100">
            <div>
              <span className="text-lg font-bold text-slate-900">{totalSpentDisplay}</span>
              <span className="text-xs text-slate-400 ml-1.5">totalt spenderat</span>
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <span className="text-lg font-bold text-slate-900">{livePurchases.length}</span>
              <span className="text-xs text-slate-400 ml-1.5">köp</span>
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <span className="text-lg font-bold text-slate-900">{c.vehicles?.length ?? 0}</span>
              <span className="text-xs text-slate-400 ml-1.5">fordon</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto -mx-0">
            {PROFILE_TABS.map(tabItem => (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === tabItem.id
                    ? 'border-[#FF6B2C] text-[#FF6B2C]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tabItem.label}
                {tabItem.count !== undefined && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === tabItem.id ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]' : 'bg-slate-100 text-slate-500'
                  }`}>{tabItem.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 px-5 md:px-8 py-6">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-6">

              {/* KPI stat row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Totalt spenderat" value={totalSpentDisplay} />
                <StatCard label="Fordon" value={String(c.vehicles?.length ?? 0)} />
                <StatCard
                  label="Utestående"
                  value={(c.outstanding ?? 0) > 0 ? `${(c.outstanding as number).toLocaleString('sv-SE')} kr` : '0 kr'}
                />
                {/* NPS — editable */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-500">NPS Score</p>
                    {!editingNps ? (
                      <button onClick={() => { setEditingNps(true); setEditValues(prev => ({ ...prev, npsScore: npsScore ?? '' })); }} className="text-[11px] text-[#FF6B2C] hover:underline">Redigera</button>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={handleSave} disabled={saving} className="text-[11px] text-emerald-600 font-semibold hover:underline disabled:opacity-50">{saving ? '…' : 'Spara'}</button>
                        <span className="text-[11px] text-slate-300">|</span>
                        <button onClick={() => setEditingNps(false)} className="text-[11px] text-slate-400 hover:underline">Avbryt</button>
                      </div>
                    )}
                  </div>
                  {editingNps ? (
                    <input
                      type="number" min="0" max="10" step="1"
                      value={editValues.npsScore}
                      onChange={e => setEditValues(prev => ({ ...prev, npsScore: e.target.value }))}
                      placeholder="0–10"
                      className="w-full text-xl font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
                    />
                  ) : (
                    <>
                      <p className="text-xl font-bold text-slate-900">{loadingLive ? '…' : (npsScore != null ? `${npsScore}/10` : '—')}</p>
                      {npsScore == null && !loadingLive && <p className="text-[11px] text-slate-400 mt-0.5">Ej insamlad</p>}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contact details — editable */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-slate-900">{t('profile.contactInfo')}</h2>
                    {!editMode ? (
                      <button
                        onClick={() => {
                          setEditValues(prev => ({ ...prev, email: c.email ?? '', phone: c.phone ?? '', tag: c.tag ?? 'Active', notes: c.notes ?? '' }));
                          setEditMode(true);
                        }}
                        className="text-xs text-[#FF6B2C] hover:underline font-medium"
                      >
                        Redigera
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={handleSave} disabled={saving} className="text-xs text-emerald-600 font-semibold hover:underline disabled:opacity-50">
                          {saving ? 'Sparar…' : 'Spara'}
                        </button>
                        <span className="text-slate-200">|</span>
                        <button onClick={() => setEditMode(false)} className="text-xs text-slate-400 hover:underline">Avbryt</button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-4">BankID/Folkbokföring-fält är skrivskyddade · Manuella fält kan redigeras</p>

                  <div>
                    {/* Read-only: BankID fields */}
                    <FieldRow label={t('profile.fields.firstName')}      value={c.firstName}              src="BankID" />
                    <FieldRow label={t('profile.fields.lastName')}       value={c.lastName}               src="BankID" />
                    <FieldRow label={t('profile.fields.personalNumber')} value={c.personnummer || '—'}    src="BankID" />
                    <FieldRow label={t('profile.fields.birthDate')}      value={c.birthDate || '—'}       src="Folkbokföring" />
                    <FieldRow label={t('profile.fields.gender')}         value={c.gender || '—'}          src="Folkbokföring" />
                    <FieldRow label={t('profile.fields.citizenship')}    value={c.citizenship ?? '—'}     src="Folkbokföring" />
                    <FieldRow label={t('profile.fields.address')}        value={c.protectedIdentity ? t('profile.fields.protectedAddressNote') : (c.address || '—')} src="Folkbokföring" />

                    {/* Editable: Manuell fields */}
                    <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <span className="text-sm text-slate-500 w-36 shrink-0">{t('profile.fields.email')}</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        {editMode ? (
                          <input
                            type="email"
                            value={editValues.email}
                            onChange={e => setEditValues(prev => ({ ...prev, email: e.target.value }))}
                            className="text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full max-w-55 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
                          />
                        ) : (
                          <span className="text-sm text-slate-900 truncate">{c.email || '—'}</span>
                        )}
                        <SourceDot src="Manuell" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <span className="text-sm text-slate-500 w-36 shrink-0">{t('profile.fields.phone')}</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        {editMode ? (
                          <input
                            type="tel"
                            value={editValues.phone}
                            onChange={e => setEditValues(prev => ({ ...prev, phone: e.target.value }))}
                            className="text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full max-w-55 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
                          />
                        ) : (
                          <span className="text-sm text-slate-900 truncate">{c.phone || '—'}</span>
                        )}
                        <SourceDot src="Manuell" />
                      </div>
                    </div>

                    {/* Tag */}
                    <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <span className="text-sm text-slate-500 w-36 shrink-0">Tagg</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        {editMode ? (
                          <select
                            value={editValues.tag}
                            onChange={e => setEditValues(prev => ({ ...prev, tag: e.target.value as Customer['tag'] }))}
                            className="text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
                          >
                            {(['VIP', 'Active', 'New', 'Inactive'] as const).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-slate-900">{c.tag ?? '—'}</span>
                        )}
                        <SourceDot src="Manuell" />
                      </div>
                    </div>

                    {/* Protected identity (read-only) */}
                    <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                      <span className="text-sm text-slate-500 w-36">{t('profile.fields.protectedIdentity')}</span>
                      <span className={`text-sm font-semibold ${c.protectedIdentity ? 'text-red-600' : 'text-emerald-600'}`}>
                        {c.protectedIdentity ? t('profile.fields.yes') : t('profile.fields.no')}
                      </span>
                    </div>

                    {/* Notes */}
                    <div className="pt-2.5">
                      <span className="text-sm text-slate-500 block mb-1.5">Anteckningar</span>
                      {editMode ? (
                        <textarea
                          rows={3}
                          value={editValues.notes}
                          onChange={e => setEditValues(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Lägg till en anteckning…"
                          className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 resize-none"
                        />
                      ) : (
                        <p className="text-sm text-slate-600 italic">{c.notes || <span className="text-slate-300">Inga anteckningar</span>}</p>
                      )}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-slate-400">{t('profile.dataSources')}</span>
                    {([
                      { label: t('profile.dataSourceLabels.bankid'),  color: 'bg-[#235971]' },
                      { label: t('profile.dataSourceLabels.roaring'), color: 'bg-emerald-500' },
                      { label: t('profile.dataSourceLabels.manual'),  color: 'bg-[#FF6B2C]' },
                    ] as const).map(s => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${s.color}`} />
                        <span className="text-xs text-slate-500">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  {/* BankID verification history */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-slate-900">{t('profile.bankidHistory')}</h2>
                      {loadingLive && (
                        <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#235971] rounded-full animate-spin" />
                      )}
                    </div>
                    {loadingLive ? (
                      <div className="space-y-3">
                        {[1, 2].map(n => (
                          <div key={n} className="flex items-start justify-between gap-3 animate-pulse">
                            <div className="space-y-1.5 flex-1">
                              <div className="h-2.5 bg-slate-100 rounded w-24" />
                              <div className="h-3 bg-slate-100 rounded w-48" />
                            </div>
                            <div className="h-5 bg-slate-100 rounded-full w-16 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (c.bankidHistory ?? []).length === 0 ? (
                      <p className="text-sm text-slate-400">{t('profile.noBankIDHistory')}</p>
                    ) : (
                      <div className="space-y-3">
                        {(c.bankidHistory ?? []).map((h: any, i: number) => (
                          <div key={i} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs text-slate-400 mb-0.5">{h.date}</div>
                              <div className="text-sm text-slate-700 capitalize">{h.action}</div>
                            </div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              h.status === 'Godkänd' ? 'bg-emerald-50 text-emerald-700' :
                              h.status === 'Nekad'   ? 'bg-red-50 text-red-600' :
                                                       'bg-amber-50 text-amber-600'
                            }`}>
                              {h.status}
                            </span>
                          </div>
                        ))}
                        <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-50">Signatur + OCSP lagrad per verifiering (rättsligt bevis)</p>
                      </div>
                    )}
                  </div>

                  {/* Recent activity */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h2 className="text-sm font-semibold text-slate-900 mb-4">{t('profile.recentActivity')}</h2>
                    {(c.timeline?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-400">{t('profile.noActivity')}</p>
                    ) : (
                      <div className="space-y-3">
                        {(c.timeline ?? []).slice(0, 5).map((item: any, i: number) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="text-xs text-slate-400 w-20 shrink-0 pt-0.5">{item.date}</span>
                            <div className="flex items-start gap-1.5">
                              <span className="text-sm">{eventIcon[item.type ?? 'default'] ?? '•'}</span>
                              <span className="text-sm text-slate-700">{item.event}</span>
                            </div>
                          </div>
                        ))}
                        {(c.timeline?.length ?? 0) > 5 && (
                          <button
                            onClick={() => setTab('timeline')}
                            className="text-xs text-[#FF6B2C] hover:underline pt-1"
                          >
                            Visa alla händelser →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── VEHICLES ── */}
          {tab === 'vehicles' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Fordon</h2>
                <span className="text-xs text-slate-400">{c.vehicles?.length ?? 0} registrerade</span>
              </div>
              {(c.vehicles?.length ?? 0) === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-3xl mb-3">🏍</div>
                  <p className="text-sm text-slate-400">{t('profile.noVehicles')}</p>
                  <button
                    onClick={() => router.push(`/sales/leads/new?customerId=${c.id}&name=${encodeURIComponent(`${c.firstName} ${c.lastName}`)}`)}
                    className="mt-4 text-xs text-[#FF6B2C] hover:underline"
                  >
                    Skapa nytt lead →
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      {['Fordon', liveVehicles.length > 0 ? 'Datum' : 'År', liveVehicles.length > 0 ? '' : 'Reg.nr', 'Status'].map(col => (
                        <th key={col} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(c.vehicles ?? []).map((v: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">{v.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{v.date ?? v.year ?? '—'}</td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">{v.plate ?? ''}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            v.status === 'Aktiv' || v.status === 'Köpt'
                              ? 'bg-emerald-50 text-emerald-700'
                              : v.status === 'Pågående'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                          }`}>
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

          {/* ── PURCHASES ── */}
          {tab === 'purchases' && (
            <div className="space-y-5">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Anskaffningshistorik</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Alla köpta motorcyklar, tillbehör och reservdelar</p>
                </div>
                {syncing && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-3 h-3 border-2 border-slate-200 border-t-[#FF6B2C] rounded-full animate-spin" />
                    Uppdaterar…
                  </span>
                )}
              </div>

              {loadingLive ? (
                <div className="grid gap-4">
                  {[1,2].map(n => (
                    <div key={n} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                      <div className="h-4 bg-slate-100 rounded w-48 mb-4" />
                      <div className="h-3 bg-slate-100 rounded w-64 mb-2" />
                      <div className="h-3 bg-slate-100 rounded w-32" />
                    </div>
                  ))}
                </div>
              ) : livePurchases.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-3xl">🏍️</div>
                  <p className="text-slate-700 font-semibold">Inga anskaffningar ännu</p>
                  <p className="text-sm text-slate-400 mt-1 mb-5">Genomförda köp dyker upp här</p>
                  <button
                    onClick={() => router.push(`/sales/leads/new?customerId=${c.id}&name=${encodeURIComponent(`${c.firstName} ${c.lastName}`)}`)}
                    className="text-xs text-[#FF6B2C] border border-[#FF6B2C]/30 px-4 py-2 rounded-xl hover:bg-[#FF6B2C]/5 transition-colors font-medium"
                  >
                    Skapa nytt lead →
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-100 p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Antal köp</p>
                      <p className="text-2xl font-bold text-slate-900">{livePurchases.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Total summa</p>
                      <p className="text-2xl font-bold text-[#FF6B2C]">
                        {livePurchases.reduce((s, p) => s + p.amount, 0).toLocaleString('sv-SE')} kr
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 col-span-2 sm:col-span-1">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Tillbehör totalt</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {livePurchases.reduce((s, p) => s + p.accessories.length, 0)}
                      </p>
                    </div>
                  </div>

                  {/* Purchase cards */}
                  <div className="grid gap-4">
                    {livePurchases.map((purchase, idx) => (
                      <div key={idx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* Card header — motorcycle */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#0b1524] to-[#1a2a40]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">🏍️</div>
                            <div>
                              <p className="text-white font-bold text-base leading-tight">{purchase.vehicle || '—'}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {purchase.vehicleColor && (
                                  <span className="text-[11px] bg-white/15 text-white/80 px-2 py-0.5 rounded-full">{purchase.vehicleColor}</span>
                                )}
                                <span className="text-[11px] text-white/60">{purchase.date}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-white font-bold text-lg">{purchase.amount.toLocaleString('sv-SE')} kr</p>
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              purchase.status === 'paid' || purchase.status === 'Betald'
                                ? 'bg-emerald-400/20 text-emerald-300'
                                : 'bg-amber-400/20 text-amber-300'
                            }`}>
                              {purchase.status === 'paid' ? '✓ Betald' : purchase.status === 'Betald' ? '✓ Betald' : '⏳ Väntande'}
                            </span>
                          </div>
                        </div>

                        {/* Accessories / spare parts */}
                        {purchase.accessories.length > 0 ? (
                          <div className="px-6 py-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tillbehör & Reservdelar</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {purchase.accessories.map((item, i) => (
                                <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                                  <span className="text-base shrink-0">{item.itemType === 'spare_part' ? '🔧' : '🧰'}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                                    <p className="text-[11px] text-slate-400">{item.itemType === 'spare_part' ? 'Reservdel' : 'Tillbehör'}</p>
                                  </div>
                                  <span className="text-xs font-bold text-slate-500 shrink-0 bg-slate-200 px-2 py-0.5 rounded-full">×{item.qty}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="px-6 py-3 border-t border-slate-50">
                            <p className="text-xs text-slate-400">Inga tillbehör inkluderade</p>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-400">{purchase.invoiceId}</span>
                          <div className="flex items-center gap-2">
                            {purchase.paymentMethod && (
                              <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg font-medium capitalize">
                                {purchase.paymentMethod === 'cash' ? 'Kontant' : purchase.paymentMethod === 'financing' ? 'Finansiering' : purchase.paymentMethod}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── INVOICES ── */}
          {tab === 'invoices' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Fakturor</h2>
                <span className="text-xs text-slate-400">
                  {liveInvoices.length > 0 ? 'Live från systemet' : 'Visa historik'}
                </span>
              </div>
              {(c.invoices?.length ?? 0) === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-3xl mb-3">🧾</div>
                  <p className="text-sm text-slate-400">{t('profile.noInvoices')}</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      {['Faktura-nr', 'Beskrivning', 'Datum', 'Belopp', 'Status'].map(col => (
                        <th key={col} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(c.invoices ?? []).map((inv: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">{inv.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{inv.desc}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{inv.date}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{(inv.amount as number).toLocaleString('sv-SE')} kr</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            inv.status === 'paid' || inv.status === 'Betald'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {inv.status === 'paid' ? 'Betald' : inv.status === 'Betald' ? 'Betald' : 'Väntande'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {(c.invoices?.length ?? 0) > 0 && (
                <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                  <span className="text-sm text-slate-700">
                    Totalt: <span className="font-bold">
                      {(c.invoices as any[]).reduce((s: number, i: any) => s + (i.amount ?? 0), 0).toLocaleString('sv-SE')} kr
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── TIMELINE ── */}
          {tab === 'timeline' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 max-w-2xl">
              <h2 className="text-sm font-semibold text-slate-900 mb-6">{t('profile.tabs.timeline')}</h2>
              {(c.timeline?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-400">{t('profile.noActivity')}</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-100" />
                  <div className="space-y-5">
                    {(c.timeline ?? []).map((item: any, i: number) => (
                      <div key={i} className="flex gap-5 pl-10 relative">
                        <div className="absolute left-2.75 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 ring-slate-200 bg-white flex items-center justify-center">
                          <span className="text-[8px]">{eventIcon[item.type ?? 'default'] ?? '•'}</span>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">{item.date}</div>
                          <div className="text-sm text-slate-800">{item.event}</div>
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
            <DocumentAttachments customerId={c.id} />
          )}

          {/* ── GDPR ── */}
          {tab === 'gdpr' && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">{t('profile.gdprTab.title')}</h2>
              <p className="text-sm text-slate-400 mb-6">GDPR-hantering för {c.firstName} {c.lastName}</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* Registered data */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('profile.gdprTab.dataTitle')}</h3>
                    <div>
                      {[
                        { label: t('profile.gdprTab.name'),    src: t('profile.gdprTab.sourceBankID'),  ok: !!c.personnummer },
                        { label: t('profile.gdprTab.address'), src: t('profile.gdprTab.sourceSPAR'),    ok: !!c.address },
                        { label: t('profile.gdprTab.contact'), src: t('profile.gdprTab.sourceManual'),  ok: !!c.email },
                        { label: t('profile.gdprTab.purchases', { n: liveInvoices.length }),    src: 'System', ok: liveInvoices.length > 0 },
                        { label: t('profile.gdprTab.bankidLogs', { n: liveBankidLogs.length }), src: t('profile.gdprTab.sourceBankID'), ok: liveBankidLogs.length > 0 },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                          <span className="text-sm text-slate-700">{row.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{row.src}</span>
                            <span className={`text-xs font-bold ${row.ok ? 'text-emerald-600' : 'text-slate-300'}`}>
                              {row.ok ? '✓' : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legal basis */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('profile.gdprTab.legalBasisTitle')}</h3>
                    <div className="space-y-3">
                      {[
                        t('profile.gdprTab.legalBasis1'),
                        t('profile.gdprTab.legalBasis2'),
                        t('profile.gdprTab.legalBasis3'),
                      ].map(basis => (
                        <div key={basis} className="flex items-start gap-2.5">
                          <span className="text-emerald-500 text-sm shrink-0 mt-0.5">✓</span>
                          <span className="text-xs text-slate-600 leading-relaxed">{basis}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right — actions */}
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('profile.gdprTab.accessTitle')}</h3>
                    <p className="text-xs text-slate-500 mb-4">{t('profile.gdprTab.accessDesc')}</p>
                    <button
                      onClick={handleGdprExport}
                      className="px-4 py-2 rounded-xl bg-[#0f1923] hover:bg-[#1a2a3a] text-white text-xs font-semibold transition-colors"
                    >
                      {t('profile.gdprTab.exportBtn')}
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('profile.gdprTab.rectifyTitle')}</h3>
                    <p className="text-xs text-slate-500 mb-4">{t('profile.gdprTab.rectifyDesc')}</p>
                    <a
                      href={`mailto:${dealerEmail || 'privacy@avamc.se'}?subject=Rättelse — ${c.firstName} ${c.lastName}`}
                      className="inline-block px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-colors"
                    >
                      {t('profile.gdprTab.rectifyBtn')} →
                    </a>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{t('profile.gdprTab.deleteTitle')}</h3>
                    <p className="text-xs text-slate-500 mb-4">{t('profile.gdprTab.deleteDesc')}</p>
                    <button
                      onClick={() => toast.success(t('profile.gdprTab.deleteSuccess'))}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
                    >
                      {t('profile.gdprTab.deleteBtn')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-xs text-slate-400">
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
