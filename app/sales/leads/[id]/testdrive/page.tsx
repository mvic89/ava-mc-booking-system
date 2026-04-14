'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId, getDealershipProfile } from '@/lib/tenant';
import { emit } from '@/lib/realtime';

// ─── Types ────────────────────────────────────────────────────────────────────

type TDStatus     = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
type LicenseClass = 'A' | 'A1' | 'A2' | 'AM' | 'B';

interface SigProof {
  name:           string;
  personalNumber: string;
  signedAt:       string;
  verified:       boolean;
}

interface InventoryMoto {
  id:           string;
  name:         string;
  brand:        string;
  year:         number;
  color:        string;
  vin:          string;
  stock:        number;
  sellingPrice: number;
  engineCC:     number;
}

interface TDForm {
  customerName:        string;
  personnummer:        string;
  customerAddress:     string;
  customerPhone:       string;
  customerEmail:       string;
  licenseNumber:       string;
  licenseClass:        LicenseClass;
  vehicle:             string;
  vin:                 string;
  registrationNumber:  string;
  vehicleColor:        string;
  odometerBefore:      number;
  odometerAfter:       number;
  scheduledDate:       string;
  departureTime:       string;
  returnTime:          string;
  route:               string;
  insuranceCompany:    string;
  insuranceFee:        number;
  preInspectionOk:     boolean;
  preInspectionNotes:  string;
  postInspectionNotes: string;
  staffName:           string;
  driverSignature:     string; // JSON SigProof or ''
  staffSignature:      string; // JSON SigProof or ''
  status:              TDStatus;
}

const BLANK: TDForm = {
  customerName: '', personnummer: '', customerAddress: '', customerPhone: '', customerEmail: '',
  licenseNumber: '', licenseClass: 'A',
  vehicle: '', vin: '', registrationNumber: '', vehicleColor: '', odometerBefore: 0, odometerAfter: 0,
  scheduledDate: '', departureTime: '', returnTime: '', route: '',
  insuranceCompany: '', insuranceFee: 250,
  preInspectionOk: true, preInspectionNotes: '', postInspectionNotes: '',
  staffName: '', driverSignature: '', staffSignature: '',
  status: 'scheduled',
};

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TDStatus, { label: string; dot: string; badge: string }> = {
  scheduled: { label: 'Bokad',     dot: 'bg-blue-500',                badge: 'bg-blue-50 text-blue-700 border border-blue-200'         },
  ongoing:   { label: 'Pågår',     dot: 'bg-amber-500 animate-pulse', badge: 'bg-amber-50 text-amber-700 border border-amber-200'       },
  completed: { label: 'Genomförd', dot: 'bg-emerald-500',             badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  cancelled: { label: 'Avbokad',   dot: 'bg-red-400',                 badge: 'bg-red-50 text-red-600 border border-red-200'             },
};

const LICENSE_CLASSES: LicenseClass[] = ['A', 'A1', 'A2', 'AM', 'B'];

function parseSig(s: string): SigProof | null {
  if (!s) return null;
  try { return JSON.parse(s) as SigProof; } catch { return null; }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const inputCls    = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20';
const readonlyCls = 'w-full text-sm border border-slate-100 rounded-lg px-3 py-2 text-slate-600 bg-slate-50 cursor-not-allowed';

function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function DocRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 gap-4">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide min-w-40 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-900 flex-1">{value || '—'}</span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{title}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function fmtDate(s: string) {
  if (!s) return 'Datum ej angivet';
  return new Date(s).toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── BankID Signature Block ───────────────────────────────────────────────────

function SigBlock({
  label,
  sigJson,
  signText,
  onSigned,
  party,
}: {
  label:    string;
  sigJson:  string;
  signText: string;
  onSigned: (proof: SigProof) => void;
  party:    'driver' | 'staff';
}) {
  const [showModal, setShowModal] = useState(false);
  const proof = parseSig(sigJson);

  return (
    <div className={`rounded-xl border-2 p-4 transition-colors ${proof ? 'border-emerald-200 bg-emerald-50' : 'border-dashed border-slate-200 bg-white'}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{label}</p>

      {proof ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">✓</span>
            <span className="font-semibold text-emerald-800 text-sm">{proof.name}</span>
          </div>
          <p className="text-xs text-emerald-700 ml-8">
            {proof.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')}
          </p>
          <p className="text-xs text-emerald-600 ml-8">
            Signerat {new Date(proof.signedAt).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
          <div className="ml-8 mt-1 flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[#235971] rounded-sm flex items-center justify-center">
              <span className="text-white text-[8px] font-bold leading-none">B</span>
            </div>
            <span className="text-[11px] font-semibold text-[#235971]">BankID verifierat</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {party === 'driver'
              ? 'Föraren signerar med sitt BankID'
              : 'Säljaren signerar med sitt BankID'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#235971] text-white text-sm font-semibold hover:bg-[#1a4557] transition-colors w-full justify-center"
          >
            <div className="w-5 h-5 bg-white/20 rounded-sm flex items-center justify-center">
              <span className="text-white text-[10px] font-extrabold leading-none">B</span>
            </div>
            Signera med BankID
          </button>
        </div>
      )}

      {showModal && (
        <BankIDModal
          mode="sign"
          signText={signText}
          title={party === 'driver' ? 'Föraren signerar' : 'Säljaren signerar'}
          subtitle={party === 'driver'
            ? 'Be kunden öppna BankID-appen och scanna QR-koden.'
            : 'Öppna BankID-appen och signera.'}
          onComplete={(data) => {
            setShowModal(false);
            if (data?.user) {
              onSigned({
                name:           data.user.name,
                personalNumber: data.user.personalNumber,
                signedAt:       new Date().toISOString(),
                verified:       true,
              });
            }
          }}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── Inventory Picker Modal ───────────────────────────────────────────────────

function InventoryPicker({ onSelect, onClose }: {
  onSelect: (moto: InventoryMoto) => void;
  onClose:  () => void;
}) {
  const [items,   setItems]   = useState<InventoryMoto[]>([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dealershipId = getDealershipId();
    if (!dealershipId) { setLoading(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    sb.from('motorcycles')
      .select('id, name, brand, year, color, vin, stock, selling_price, engine_cc')
      .eq('dealership_id', dealershipId)
      .gt('stock', 0)
      .order('name')
      .then(({ data }: { data: Record<string, unknown>[] | null }) => {
        setItems((data ?? []).map(r => ({
          id:           r.id           as string,
          name:         r.name         as string,
          brand:        r.brand        as string,
          year:         r.year         as number,
          color:        r.color        as string,
          vin:          r.vin          as string,
          stock:        r.stock        as number,
          sellingPrice: Number(r.selling_price),
          engineCC:     r.engine_cc    as number,
        })));
        setLoading(false);
      });
  }, []);

  const filtered = items.filter(m =>
    !search ||
    `${m.brand} ${m.name} ${m.year}`.toLowerCase().includes(search.toLowerCase()) ||
    (m.vin ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-[#0b1524] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-0.5">Välj fordon</p>
            <h3 className="text-base font-bold text-white">🏍 Lagersaldo</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-4 border-b border-slate-100">
          <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Sök märke, modell, VIN…" className={inputCls} />
        </div>
        <div className="overflow-y-auto max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {items.length === 0 ? 'Inga motorcyklar i lager' : 'Inga träffar'}
            </div>
          ) : filtered.map(m => (
            <button key={m.id} onClick={() => onSelect(m)}
              className="w-full text-left px-5 py-3 hover:bg-[#FF6B2C]/5 border-b border-slate-50 last:border-0 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{m.brand} {m.name} {m.year}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.color && <span className="mr-2">{m.color}</span>}
                    {m.engineCC > 0 && <span className="mr-2">{m.engineCC} cc</span>}
                    {m.vin && <span className="text-slate-400">VIN: {m.vin}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#FF6B2C]">{m.sellingPrice.toLocaleString('sv-SE')} kr</p>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    {m.stock} i lager
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestDrivePage() {
  const router  = useRouter();
  const params  = useParams();
  const leadId  = Number((params?.id as string) || '0');

  const [ready,         setReady]         = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [tdId,          setTdId]          = useState<number | null>(null);
  const [form,          setForm]          = useState<TDForm>(BLANK);
  const [isEditing,     setIsEditing]     = useState(false);
  const [draft,         setDraft]         = useState<TDForm | null>(null);
  const [dealer,        setDealer]        = useState({ name: '', address: '', phone: '' });
  const [loggedInUser,  setLoggedInUser]  = useState('');
  const [showInvPicker, setShowInvPicker] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    if (!leadId || Number.isNaN(leadId)) { setReady(true); return; }

    const dealershipId = getDealershipId();
    const profile      = getDealershipProfile();
    const parsed       = JSON.parse(raw);
    const userName     = parsed.name || parsed.givenName || '';

    setDealer({ name: profile.name, address: profile.address, phone: profile.phone });
    setLoggedInUser(userName);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;

    (async () => {
      const [{ data: lead }, tdRes, { data: inventory }] = await Promise.all([
        sb.from('leads')
          .select('name, personnummer, bike, phone, email, address, city, salesperson_name')
          .eq('id', leadId)
          .eq('dealership_id', dealershipId)
          .maybeSingle(),
        fetch(`/api/testdrives?leadId=${leadId}&dealershipId=${dealershipId}`),
        // Load all motorcycles to match against lead.bike interest
        sb.from('motorcycles')
          .select('id, name, brand, year, color, vin, stock, engine_cc')
          .eq('dealership_id', dealershipId),
      ]);
      const { testDrive: existing } = await tdRes.json();

      // ── Match lead.bike → inventory motorcycle (always needed) ──────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const motoList: any[] = inventory ?? [];
      const bikeLower = (lead?.bike ?? '').toLowerCase().trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matched = bikeLower ? motoList.find((m: any) => {
        const full  = `${m.brand} ${m.name}`.toLowerCase();
        const name  = (m.name  as string).toLowerCase();
        const brand = (m.brand as string).toLowerCase();
        return (
          full.includes(bikeLower) || bikeLower.includes(full) ||
          bikeLower.includes(name) || (bikeLower.includes(brand) && bikeLower.includes(name))
        );
      }) : null;

      // ── Customer fields always come from the lead (source of truth) ──────
      const addrParts = [lead?.address, lead?.city].filter(Boolean);
      const fromLead = {
        customerName:    lead?.name         ?? '',
        personnummer:    lead?.personnummer  ?? '',
        customerAddress: addrParts.join(', '),
        customerPhone:   lead?.phone        ?? '',
        customerEmail:   lead?.email        ?? '',
      };

      // ── Vehicle defaults: inventory match → existing td → lead bike text ─
      const vehicleDefault  = matched
        ? `${matched.brand} ${matched.name} ${matched.year}`
        : (lead?.bike ?? '');
      const colorDefault    = matched?.color ?? '';
      const vinDefault      = matched?.vin   ?? '';

      if (existing) {
        setTdId(existing.id);
        setForm({
          // Customer — always from lead (never stale test drive values)
          ...fromLead,
          licenseNumber:       existing.license_number        ?? '',
          licenseClass:        existing.license_class         ?? 'A',
          // Vehicle — prefer saved test drive data; fall back to inventory match
          vehicle:             existing.vehicle               || vehicleDefault,
          vin:                 existing.vin                   || vinDefault,
          registrationNumber:  existing.registration_number   ?? '',
          vehicleColor:        existing.vehicle_color         || colorDefault,
          odometerBefore:      existing.odometer_before       ?? 0,
          odometerAfter:       existing.odometer_after        ?? 0,
          scheduledDate:       existing.scheduled_date        ?? '',
          departureTime:       existing.departure_time        ?? '',
          returnTime:          existing.return_time           ?? '',
          route:               existing.route                 ?? '',
          insuranceCompany:    existing.insurance_company     ?? '',
          insuranceFee:        existing.insurance_fee         ?? 250,
          preInspectionOk:     existing.pre_inspection_ok     ?? true,
          preInspectionNotes:  existing.pre_inspection_notes  ?? '',
          postInspectionNotes: existing.post_inspection_notes ?? '',
          staffName:           userName,
          driverSignature:     existing.driver_signature      ?? '',
          staffSignature:      existing.staff_signature       ?? '',
          status:              existing.status                ?? 'scheduled',
        });
      } else {
        // Brand new test drive — pre-fill everything from lead + inventory
        setForm(prev => ({
          ...prev,
          ...fromLead,
          vehicle:       vehicleDefault,
          vehicleColor:  colorDefault,
          vin:           vinDefault,
          staffName:     userName,
          scheduledDate: new Date().toISOString().slice(0, 10),
        }));
      }
      setReady(true);
    })();
  }, [leadId, router]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const upd = useCallback(<K extends keyof TDForm>(key: K, value: TDForm[K]) => {
    setDraft(d => d ? { ...d, [key]: value } : d);
  }, []);

  function pickInventory(moto: InventoryMoto) {
    const label = `${moto.brand} ${moto.name} ${moto.year}`;
    upd('vehicle',      label);
    upd('vehicleColor', moto.color ?? '');
    upd('vin',          moto.vin   ?? '');
    setShowInvPicker(false);
    toast.success(`${label} vald`);
  }

  // Build the sign text shown inside the user's BankID app
  function buildSignText(party: 'driver' | 'staff') {
    const d = draft ?? form;
    const vehicle = d.vehicle || 'fordon';
    const date    = d.scheduledDate ? fmtDate(d.scheduledDate) : 'angivet datum';
    if (party === 'driver') {
      return btoa(unescape(encodeURIComponent(
        `Jag bekräftar provkörning av ${vehicle} den ${date}. Jag intygar att jag innehar giltigt körkort för klass ${d.licenseClass} och återlämnar fordonet i samma skick.`
      )));
    }
    return btoa(unescape(encodeURIComponent(
      `Jag godkänner provkörning av ${vehicle} för ${d.customerName || 'kund'} den ${date} på uppdrag av ${dealer.name}.`
    )));
  }

  // Called when a BankID signing completes — save proof + persist immediately
  async function handleSigned(party: 'driver' | 'staff', proof: SigProof) {
    const field = party === 'driver' ? 'driverSignature' : 'staffSignature';
    const proofJson = JSON.stringify(proof);

    // Update form state immediately so UI refreshes
    setForm(f => ({ ...f, [field]: proofJson, staffName: loggedInUser }));

    // Persist to Supabase
    const payload = { ...form, [field]: proofJson, staffName: loggedInUser };
    const dealershipId = getDealershipId();
    try {
      if (tdId) {
        const res = await fetch(`/api/testdrives/${tdId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch('/api/testdrives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, leadId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const json = await res.json();
        setTdId(json.testDrive.id);
        await fetch(`/api/leads/${leadId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, stage: 'testride', fromStages: ['new', 'contacted'] }),
        });
        emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
      }
      toast.success(`✓ ${proof.name} har signerat med BankID`);
    } catch (err) {
      toast.error(`Kunde inte spara underskrift: ${err}`);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save(overrideStatus?: TDStatus) {
    const payload = { ...(draft ?? form), staffName: loggedInUser };
    if (overrideStatus) payload.status = overrideStatus;

    // Auto-set departure + estimated return (30 min, ~25 km at urban speed) when starting
    if (overrideStatus === 'ongoing') {
      const now       = new Date();
      const hhmm      = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const ret       = new Date(now.getTime() + 30 * 60 * 1000);
      payload.departureTime  = hhmm(now);
      payload.returnTime     = hhmm(ret);
      if (!payload.scheduledDate) {
        payload.scheduledDate = now.toISOString().slice(0, 10);
      }
    }
    const dealershipId = getDealershipId();
    setSaving(true);
    try {
      if (tdId) {
        const res = await fetch(`/api/testdrives/${tdId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch('/api/testdrives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, leadId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const json = await res.json();
        setTdId(json.testDrive.id);
        await fetch(`/api/leads/${leadId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, stage: 'testride', fromStages: ['new', 'contacted'] }),
        });
        emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
      }
      setForm({ ...payload });
      setDraft(null);
      setIsEditing(false);
      toast.success(
        overrideStatus === 'ongoing'   ? '🏍 Provkörning startad!'   :
        overrideStatus === 'completed' ? '✓ Provkörning avslutad'    :
        overrideStatus === 'cancelled' ? 'Provkörning avbokad'       :
        'Provkörning sparad'
      );
    } catch (err) {
      toast.error(`Fel: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const d    = isEditing && draft ? draft : form;
  const scfg = STATUS_CFG[d.status];
  const driverProof = parseSig(form.driverSignature);
  const staffProof  = parseSig(form.staffSignature);
  const bothSigned  = !!driverProof && !!staffProof;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      {showInvPicker && (
        <InventoryPicker onSelect={pickInventory} onClose={() => setShowInvPicker(false)} />
      )}

      <div className="flex min-h-screen bg-[#f5f7fa]">
        <div className="no-print"><Sidebar /></div>

        <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
          <div className="brand-top-bar no-print" />

          {/* ── Top bar ── */}
          <div className="no-print px-6 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Link href="/sales/leads" className="text-slate-400 hover:text-slate-600">Pipeline</Link>
                <span className="text-slate-300">/</span>
                <Link href={`/sales/leads/${leadId}`} className="text-slate-400 hover:text-slate-600">Lead #{leadId}</Link>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">Provkörning</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${scfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
                {scfg.label}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {!isEditing ? (
                <>
                  <button onClick={() => { setDraft({ ...form }); setIsEditing(true); }}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                    ✏️ Redigera
                  </button>
                  <button onClick={() => window.print()}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                    🖨 Skriv ut
                  </button>
                  {d.status === 'scheduled' && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          if (!bothSigned) {
                            toast.error('Båda parter måste signera med BankID innan provkörningen startar');
                            return;
                          }
                          save('ongoing');
                        }}
                        disabled={saving || !bothSigned}
                        title={!bothSigned ? 'Kräver BankID-signering av förare och personal' : ''}
                        className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-opacity"
                      >
                        {saving ? <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : '🏍'}
                        Starta provkörning
                      </button>
                      {!bothSigned && (
                        <p className="text-[10px] text-amber-600 font-medium">
                          {!driverProof && !staffProof ? 'Väntar på förare & personal' :
                           !driverProof ? 'Väntar på förarens signatur' :
                           'Väntar på personalens signatur'}
                        </p>
                      )}
                    </div>
                  )}
                  {d.status === 'ongoing' && (
                    <button onClick={() => save('completed')} disabled={saving}
                      className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                      {saving ? <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : '✓'}
                      Avsluta provkörning
                    </button>
                  )}
                  {d.status === 'cancelled' && (
                    <button
                      onClick={() => {
                        // Clear signatures + times so the rebooking starts fresh
                        const rebookedForm: TDForm = {
                          ...form,
                          status:          'scheduled',
                          departureTime:   '',
                          returnTime:      '',
                          driverSignature: '',
                          staffSignature:  '',
                          scheduledDate:   new Date().toISOString().slice(0, 10),
                        };
                        setDraft(rebookedForm);
                        setIsEditing(true);
                        toast.success('Provkörning återbokad — uppdatera datum och spara');
                      }}
                      className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                    >
                      📅 Återboka
                    </button>
                  )}
                  {d.status !== 'cancelled' && d.status !== 'completed' && (
                    <button onClick={() => save('cancelled')} disabled={saving}
                      className="px-3 py-1.5 text-sm font-medium bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
                      Avboka
                    </button>
                  )}
                  {(d.status === 'completed' || d.status === 'ongoing') && (
                    <Link href={`/sales/leads/${leadId}/offer`}
                      className="px-3 py-1.5 text-sm font-medium bg-[#FF6B2C] text-white rounded-lg hover:bg-[#e85a1e]">
                      Skapa offert →
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => { setDraft(null); setIsEditing(false); }}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                    Avbryt
                  </button>
                  <button onClick={() => save()} disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium bg-[#FF6B2C] text-white rounded-lg hover:bg-[#e85a1e] disabled:opacity-50 flex items-center gap-1.5">
                    {saving ? <><span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />Sparar…</> : 'Spara'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 p-4 md:p-6">
            {isEditing ? (

              /* ════ EDIT FORM ════ */
              <div className="max-w-3xl mx-auto space-y-5">

                {/* Förarens uppgifter */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Förarens uppgifter</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="För- och efternamn" required>
                      <input type="text" value={draft!.customerName}
                        onChange={e => upd('customerName', e.target.value)} className={inputCls} placeholder="Anna Andersson" />
                    </F>
                    <F label="Personnummer" required>
                      <input type="text" value={draft!.personnummer}
                        onChange={e => upd('personnummer', e.target.value)} className={inputCls} placeholder="YYYYMMDD-XXXX" />
                    </F>
                    <F label="Adress">
                      <input type="text" value={draft!.customerAddress}
                        onChange={e => upd('customerAddress', e.target.value)} className={inputCls} />
                    </F>
                    <F label="Mobilnummer">
                      <input type="tel" value={draft!.customerPhone}
                        onChange={e => upd('customerPhone', e.target.value)} className={inputCls} placeholder="070-000 00 00" />
                    </F>
                    <F label="E-post">
                      <input type="email" value={draft!.customerEmail}
                        onChange={e => upd('customerEmail', e.target.value)} className={inputCls} placeholder="anna@example.se" />
                    </F>
                    <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                      <F label="Körkortsnummer" required>
                        <input type="text" value={draft!.licenseNumber}
                          onChange={e => upd('licenseNumber', e.target.value)} className={inputCls} placeholder="t.ex. 12345678" />
                      </F>
                      <F label="Körkortsklass" required>
                        <select value={draft!.licenseClass}
                          onChange={e => upd('licenseClass', e.target.value as LicenseClass)} className={inputCls}>
                          {LICENSE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </F>
                    </div>
                  </div>
                </div>

                {/* Fordon */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Fordon</p>
                    <button type="button" onClick={() => setShowInvPicker(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FF6B2C]/10 text-[#FF6B2C] hover:bg-[#FF6B2C]/20 transition-colors">
                      🏍 Välj från lager
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="Märke / modell / årsmodell" required>
                      <input type="text" value={draft!.vehicle}
                        onChange={e => upd('vehicle', e.target.value)} className={inputCls} placeholder="Kawasaki Z900 2024" />
                    </F>
                    <F label="Färg">
                      <input type="text" value={draft!.vehicleColor}
                        onChange={e => upd('vehicleColor', e.target.value)} className={inputCls} placeholder="Metallic grön" />
                    </F>
                    <F label="Registreringsnummer">
                      <input type="text" value={draft!.registrationNumber}
                        onChange={e => upd('registrationNumber', e.target.value)} className={inputCls} placeholder="ABC123" />
                    </F>
                    <F label="Chassinummer (VIN)">
                      <input type="text" value={draft!.vin}
                        onChange={e => upd('vin', e.target.value)} className={inputCls} placeholder="JKBZXJ900P…" />
                    </F>
                    <F label="Mätarställning vid avfärd (km)" required>
                      <input type="number" min="0" value={draft!.odometerBefore || ''}
                        onChange={e => upd('odometerBefore', Number(e.target.value))} className={inputCls} />
                    </F>
                    {(draft!.status === 'completed' || draft!.status === 'ongoing') && (
                      <F label="Mätarställning vid återkomst (km)">
                        <input type="number" min="0" value={draft!.odometerAfter || ''}
                          onChange={e => upd('odometerAfter', Number(e.target.value))} className={inputCls} />
                      </F>
                    )}
                  </div>
                </div>

                {/* Tidplan */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Tidplan</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="Datum" required>
                      <input type="date" value={draft!.scheduledDate}
                        onChange={e => upd('scheduledDate', e.target.value)} className={inputCls} />
                    </F>
                    <F label="Rutt / destination">
                      <input type="text" value={draft!.route}
                        onChange={e => upd('route', e.target.value)} className={inputCls} placeholder="t.ex. Runt stan, max 30 km" />
                    </F>
                    <F label="Avfärdstid">
                      <input type="time" value={draft!.departureTime}
                        onChange={e => upd('departureTime', e.target.value)} className={inputCls} />
                    </F>
                    <F label="Beräknad återkomsttid">
                      <input type="time" value={draft!.returnTime}
                        onChange={e => upd('returnTime', e.target.value)} className={inputCls} />
                    </F>
                  </div>
                </div>

                {/* Försäkring */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Försäkring &amp; besiktning</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <F label="Försäkringsbolag">
                        <input type="text" value={draft!.insuranceCompany}
                          onChange={e => upd('insuranceCompany', e.target.value)} className={inputCls}
                          placeholder="Länsförsäkringar, If, Trygg-Hansa…" />
                      </F>
                      <F label="Försäkringsdeposition (kr)">
                        <input type="number" min="0" step="50" value={draft!.insuranceFee}
                          onChange={e => upd('insuranceFee', Number(e.target.value))} className={inputCls} />
                      </F>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={draft!.preInspectionOk}
                        onChange={e => upd('preInspectionOk', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#FF6B2C] focus:ring-[#FF6B2C]" />
                      <span className="text-sm font-medium text-slate-700">Fordonet är besiktat och inga synliga skador vid avfärd</span>
                    </label>
                    <F label="Noteringar före avfärd">
                      <textarea value={draft!.preInspectionNotes} rows={2}
                        onChange={e => upd('preInspectionNotes', e.target.value)}
                        placeholder="Befintliga repor, skador osv…" className={`${inputCls} resize-none`} />
                    </F>
                    {(draft!.status === 'completed' || draft!.status === 'ongoing') && (
                      <F label="Noteringar vid återlämning">
                        <textarea value={draft!.postInspectionNotes} rows={2}
                          onChange={e => upd('postInspectionNotes', e.target.value)}
                          placeholder="Skador vid återlämning, bränslenivå…" className={`${inputCls} resize-none`} />
                      </F>
                    )}
                  </div>
                </div>

                {/* Staff — read only */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Ansvarig personal</p>
                  <F label="Säljare (inloggad användare)">
                    <input type="text" value={loggedInUser} readOnly className={readonlyCls} />
                  </F>
                </div>

              </div>

            ) : (

              /* ════ DOCUMENT VIEW ════ */
              <div className="max-w-3xl mx-auto space-y-4">

                {/* Header */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="bg-[#0b1524] text-white px-8 py-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Återförsäljare</p>
                        <h2 className="text-xl font-bold">{dealer.name || 'Återförsäljare'}</h2>
                        {dealer.address && <p className="text-sm text-white/60 mt-0.5">{dealer.address}</p>}
                        {dealer.phone   && <p className="text-sm text-white/60">{dealer.phone}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black tracking-widest text-[#FF6B2C]">PROVKÖRNING</div>
                        <div className="text-sm text-white/60 mt-1">{fmtDate(d.scheduledDate)}</div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mt-2 ${scfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
                          {scfg.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                    <div className="px-6 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Förare</p>
                      <p className="font-bold text-slate-900 text-base">{d.customerName || '—'}</p>
                      {d.customerPhone && <p className="text-sm text-slate-600 mt-0.5">Tel: {d.customerPhone}</p>}
                    </div>
                    <div className="px-6 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Ansvarig personal</p>
                      <p className="font-bold text-slate-900">{d.staffName || loggedInUser || '—'}</p>
                      <p className="text-sm text-slate-600">{dealer.name}</p>
                      {dealer.phone && <p className="text-sm text-slate-500">{dealer.phone}</p>}
                    </div>
                  </div>
                </div>

                {/* Vehicle */}
                <SectionCard title="Fordon" icon="🏍">
                  <div className="grid grid-cols-2 gap-x-6">
                    <div>
                      <DocRow label="Modell"        value={d.vehicle} />
                      <DocRow label="Regnummer"     value={d.registrationNumber} />
                      <DocRow label="Chassinummer"  value={d.vin} />
                    </div>
                    <div>
                      <DocRow label="Färg"            value={d.vehicleColor} />
                      <DocRow label="Mätarst. avfärd" value={d.odometerBefore ? `${d.odometerBefore.toLocaleString('sv-SE')} km` : '—'} />
                      {d.status === 'completed' && d.odometerAfter > 0 && (
                        <DocRow label="Mätarst. återkomst" value={`${d.odometerAfter.toLocaleString('sv-SE')} km (+${(d.odometerAfter - d.odometerBefore).toLocaleString('sv-SE')} km)`} />
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Schedule */}
                <SectionCard title="Tidplan &amp; rutt" icon="📅">
                  <div className="grid grid-cols-2 gap-x-6">
                    <div>
                      <DocRow label="Datum"              value={fmtDate(d.scheduledDate)} />
                      <DocRow label="Avfärd"             value={d.departureTime || '—'} />
                      <DocRow label="Beräknad återkomst" value={d.returnTime ? `${d.returnTime} (30 min · ~25 km)` : '—'} />
                    </div>
                    <div>
                      <DocRow label="Rutt / destination" value={d.route} />
                    </div>
                  </div>
                </SectionCard>

                {/* Insurance */}
                <SectionCard title="Försäkring &amp; besiktning" icon="🔍">
                  <DocRow label="Försäkringsbolag" value={d.insuranceCompany} />
                  {d.insuranceFee > 0 && (
                    <DocRow label="Försäkringsdeposition" value={`${d.insuranceFee.toLocaleString('sv-SE')} kr`} />
                  )}
                  <div className="flex items-center gap-2 py-2 border-b border-slate-50">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${d.preInspectionOk ? 'bg-emerald-500' : 'bg-red-400'}`}>
                      {d.preInspectionOk ? '✓' : '✗'}
                    </span>
                    <span className="text-sm text-slate-700">Inga synliga skador vid avfärd</span>
                  </div>
                  {d.preInspectionNotes  && <DocRow label="Noteringar avfärd"    value={d.preInspectionNotes} />}
                  {d.postInspectionNotes && <DocRow label="Noteringar återkomst" value={d.postInspectionNotes} />}
                </SectionCard>

                {/* Signatures */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Underskrifter</p>
                  <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                    Föraren bekräftar innehav av giltigt körkort för fordonsklass{' '}
                    <strong>{d.licenseClass}</strong> och att fordonet återlämnas i samma skick som vid avfärden.
                    Återförsäljaren ansvarar för att fordonet är försäkrat under provkörningen.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
                    <SigBlock
                      label="Förarens underskrift"
                      sigJson={form.driverSignature}
                      signText={buildSignText('driver')}
                      onSigned={proof => handleSigned('driver', proof)}
                      party="driver"
                    />
                    <SigBlock
                      label="Säljarens underskrift"
                      sigJson={form.staffSignature}
                      signText={buildSignText('staff')}
                      onSigned={proof => handleSigned('staff', proof)}
                      party="staff"
                    />
                  </div>

                  {/* Print-only signature lines */}
                  <div className="hidden print:grid grid-cols-2 gap-8 mt-4">
                    <div>
                      {driverProof ? (
                        <div className="mb-1">
                          <p className="text-sm font-semibold text-slate-900">{driverProof.name}</p>
                          <p className="text-xs text-slate-500">{driverProof.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')}</p>
                          <p className="text-xs text-slate-400">BankID • {new Date(driverProof.signedAt).toLocaleString('sv-SE')}</p>
                        </div>
                      ) : (
                        <div className="border-b-2 border-slate-400 h-12 mb-1" />
                      )}
                      <p className="text-xs font-semibold text-slate-700">Förarens underskrift</p>
                    </div>
                    <div>
                      {staffProof ? (
                        <div className="mb-1">
                          <p className="text-sm font-semibold text-slate-900">{staffProof.name}</p>
                          <p className="text-xs text-slate-500">{staffProof.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')}</p>
                          <p className="text-xs text-slate-400">BankID • {new Date(staffProof.signedAt).toLocaleString('sv-SE')}</p>
                        </div>
                      ) : (
                        <div className="border-b-2 border-slate-400 h-12 mb-1" />
                      )}
                      <p className="text-xs font-semibold text-slate-700">Säljarens underskrift — {dealer.name}</p>
                    </div>
                  </div>

                  {bothSigned && (
                    <div className="mt-4 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                      <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">✓</span>
                      <span className="text-sm font-semibold">Dokumentet är underskrivet av båda parter via BankID</span>
                    </div>
                  )}
                </div>

                {/* Post-drive CTA */}
                {d.status === 'completed' && (
                  <div className="rounded-2xl overflow-hidden shadow-sm no-print">
                    {/* Green top stripe */}
                    <div className="bg-emerald-600 px-6 py-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">✓</span>
                      <span className="text-sm font-bold text-white tracking-wide uppercase">Provkörning genomförd</span>
                    </div>
                    {/* Body */}
                    <div className="bg-white border border-emerald-100 px-6 py-5">
                      <p className="text-slate-600 text-sm leading-relaxed mb-4">
                        Nu är det dags att gå vidare. Skapa en offert för kunden — du kan lägga in pris, eventuell inbytesaffär, tillbehör och finansiering. När kunden accepterar genereras ett köpeavtal för BankID-signering.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/sales/leads/${leadId}/offer`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#FF6B2C] text-white rounded-xl hover:bg-[#e85a1e] transition-colors shadow-sm">
                          📋 Skapa offert
                          <span className="text-white/70">→</span>
                        </Link>
                        <Link href={`/sales/leads/${leadId}`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                          Tillbaka till lead
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
