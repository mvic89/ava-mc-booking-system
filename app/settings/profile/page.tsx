'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import PhoneInput from '@/components/PhoneInput';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';
import { useAutoRefresh } from '@/lib/realtime';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealershipProfile {
  name:              string;
  orgNr:             string;
  vatNr:             string;
  fSkatt:            boolean;
  street:            string;
  postalCode:        string;
  city:              string;
  county:            string;
  phone:             string;
  email:             string;
  emailDomain:       string;   // e.g. "avamc.se" — shared by all staff at this dealership
  website:           string;
  bankgiro:              string;
  swish:                 string;
  deliveryNoteEmail:     string;   // who receives delivery note notifications
  invoiceEmail:          string;   // who receives purchase invoice notifications
  logoDataUrl:           string;
  coverImageDataUrl:     string;
}

const SWEDISH_COUNTIES = [
  'Blekinge', 'Dalarna', 'Gotland', 'Gävleborg', 'Halland',
  'Jämtland', 'Jönköping', 'Kalmar', 'Kronoberg', 'Norrbotten',
  'Skåne', 'Stockholm', 'Södermanland', 'Uppsala', 'Värmland',
  'Västerbotten', 'Västernorrland', 'Västmanland', 'Västra Götaland',
  'Örebro', 'Östergötland',
];

const DEFAULTS: DealershipProfile = {
  name:        '',
  orgNr:       '',
  vatNr:       '',
  fSkatt:      true,
  street:      '',
  postalCode:  '',
  city:        '',
  county:      'Stockholm',
  phone:       '',
  email:       '',
  emailDomain: '',
  website:     '',
  bankgiro:          '',
  swish:             '',
  deliveryNoteEmail: '',
  invoiceEmail:      '',
  logoDataUrl:       '',
  coverImageDataUrl: '',
};

const STORAGE_KEY  = 'dealership_profile';
const MAX_LOGO_KB  = 250;
const MAX_COVER_KB = 800;

// ─── Canvas image resizer ──────────────────────────────────────────────────────
// Scales a raster image down (JPEG output) until its base64 size is < MAX_LOGO_KB.

function resizeImage(file: File, maxKb: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d')!;

      // Start at original dimensions, capped at 2400 px max
      const MAX_DIM = 2400;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        const r = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }

      // base64 ≈ 4/3 × binary bytes
      const targetBase64Chars = maxKb * 1024 * (4 / 3);

      // Phase 1: keep dimensions, reduce JPEG quality
      canvas.width  = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      while (dataUrl.length > targetBase64Chars && quality > 0.25) {
        quality = Math.round((quality - 0.1) * 10) / 10;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // Phase 2: if still too large, scale dimensions down
      let scale = 0.75;
      while (dataUrl.length > targetBase64Chars && scale > 0.1) {
        const sw = Math.max(1, Math.round(w * scale));
        const sh = Math.max(1, Math.round(h * scale));
        canvas.width  = sw;
        canvas.height = sh;
        ctx.drawImage(img, 0, 0, sw, sh);
        dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        scale   = Math.round((scale - 0.15) * 100) / 100;
      }

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Kunde inte läsa bilden'));
    };

    img.src = objectUrl;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveVat(orgNr: string): string {
  const digits = orgNr.replace(/\D/g, '');
  if (digits.length !== 10) return '';
  return `SE${digits}01`;
}

function formatOrgNr(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return digits;
}

function formatBankgiro(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchProfileFromSupabase(dealershipId: string): Promise<Partial<DealershipProfile> | null> {
  const sb = getSupabaseBrowser() as any;

  // Primary: dealership_settings — only trust if name is populated
  const { data } = await sb
    .from('dealership_settings')
    .select('*')
    .eq('dealership_id', dealershipId)
    .maybeSingle();
  if (data?.name) {
    return {
      name:              data.name                  ?? '',
      orgNr:             data.org_nr                ?? '',
      vatNr:             data.vat_nr                ?? '',
      fSkatt:            data.f_skatt               ?? true,
      street:            data.street                ?? '',
      postalCode:        data.postal_code           ?? '',
      city:              data.city                  ?? '',
      county:            data.county                ?? 'Stockholm',
      phone:             data.phone                 ?? '',
      email:             data.email                 ?? '',
      emailDomain:       data.email_domain          ?? '',
      website:           data.website               ?? '',
      bankgiro:          data.bankgiro              ?? '',
      swish:             data.swish                 ?? '',
      logoDataUrl:       data.logo_data_url         ?? '',
      coverImageDataUrl: data.cover_image_data_url  ?? '',
    };
  }

  // Fallback: dealerships table — use select('*') so missing columns don't error
  const { data: dl } = await sb
    .from('dealerships')
    .select('*')
    .eq('id', dealershipId)
    .maybeSingle();
  if (!dl?.name) return null;
  return {
    name:              data.name              ?? '',
    orgNr:             data.org_nr            ?? '',
    vatNr:             data.vat_nr            ?? '',
    fSkatt:            data.f_skatt           ?? true,
    street:            data.street            ?? '',
    postalCode:        data.postal_code       ?? '',
    city:              data.city              ?? '',
    county:            data.county            ?? 'Stockholm',
    phone:             data.phone             ?? '',
    email:             data.email             ?? '',
    emailDomain:       data.email_domain      ?? '',
    website:           data.website           ?? '',
    bankgiro:          data.bankgiro              ?? '',
    swish:             data.swish                 ?? '',
    deliveryNoteEmail: data.delivery_note_email   ?? '',
    invoiceEmail:      data.invoice_email         ?? '',
    logoDataUrl:       data.logo_data_url         ?? '',
    coverImageDataUrl: data.cover_image_data_url  ?? '',
  };
}

async function saveProfileToSupabase(dealershipId: string, profile: DealershipProfile): Promise<void> {
  const sb = getSupabaseBrowser() as any;

  // Write full profile to dealership_settings
  const payload: Record<string, unknown> = {
    dealership_id:        dealershipId,
    name:                 profile.name,
    org_nr:               profile.orgNr,
    vat_nr:               profile.vatNr,
    f_skatt:              profile.fSkatt,
    street:               profile.street,
    postal_code:          profile.postalCode,
    city:                 profile.city,
    county:               profile.county,
    phone:                profile.phone,
    email:                profile.email,
    email_domain:         profile.emailDomain,
    website:              profile.website,
    bankgiro:             profile.bankgiro,
    swish:                profile.swish,
    delivery_note_email:  profile.deliveryNoteEmail || null,
    invoice_email:        profile.invoiceEmail      || null,
    logo_data_url:        profile.logoDataUrl,
    cover_image_data_url: profile.coverImageDataUrl,
    updated_at:           new Date().toISOString(),
  };

  const { error } = await sb.from('dealership_settings').upsert(payload, { onConflict: 'dealership_id' });

  if (error) {
    // If email_domain column doesn't exist yet (migration not run), retry without it
    if (error.message?.includes('email_domain')) {
      delete payload.email_domain;
      const { error: error2 } = await sb.from('dealership_settings').upsert(payload, { onConflict: 'dealership_id' });
      if (error2) throw new Error(error2.message);
    } else {
      throw new Error(error.message);
    }
  }

  // Also keep dealerships table in sync so prefetchDealerProfile fallback works
  const { error: dlErr } = await sb
    .from('dealerships')
    .update({
      name:          profile.name,
      org_nr:        profile.orgNr         || null,
      address:       profile.street        || null,
      postal_code:   profile.postalCode    || null,
      city:          profile.city          || null,
      phone:         profile.phone         || null,
      email:         profile.email         || null,
      website:       profile.website       || null,
      logo_data_url: profile.logoDataUrl   || null,
    })
    .eq('id', dealershipId);

  if (dlErr) {
    console.warn('[profile] dealerships update:', dlErr.message);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-5">
        <span className="text-base">{icon}</span> {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', mono = false }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white
        focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C] transition-all
        ${mono ? 'font-mono tracking-wider' : ''}`}
    />
  );
}

function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#FF6B2C]' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealershipProfilePage() {
  const router     = useRouter();
  const fileRef    = useRef<HTMLInputElement>(null);
  const coverRef   = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<DealershipProfile>(DEFAULTS);
  const [saving, setSaving]         = useState(false);
  const [logoErr, setLogoErr]       = useState('');
  const [logoResizing, setLogoResizing] = useState(false);
  const [logoResized, setLogoResized]   = useState(false);
  const [coverErr, setCoverErr]         = useState('');
  const [coverResizing, setCoverResizing] = useState(false);
  const [coverResized, setCoverResized]   = useState(false);

  const loadProfile = async () => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const user = JSON.parse(raw);
    const dealershipId = getDealershipId();

    // 1. Try Supabase first (source of truth across devices)
    if (dealershipId) {
      const remote = await fetchProfileFromSupabase(dealershipId);
      if (remote) {
        const merged = { ...DEFAULTS, ...remote };
        setProfile(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        // Notify same-tab listeners (e.g. Sidebar) that profile is ready
        window.dispatchEvent(new StorageEvent('storage', { key: 'dealership_profile' }));
        return;
      }
    }

    // 2. Fall back to localStorage cache
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.name) {
        setProfile({ ...DEFAULTS, ...saved });
      } else {
        setProfile({ ...DEFAULTS, name: user.dealershipName || user.dealership || '' });
      }
    } catch { /* use defaults */ }
  };

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Re-load whenever another device saves the profile (Supabase Realtime → data:refresh)
  useAutoRefresh(loadProfile);

  // ── Field helpers ──────────────────────────────────────────────────────────

  const set = <K extends keyof DealershipProfile>(key: K) =>
    (value: DealershipProfile[K]) => setProfile(p => ({ ...p, [key]: value }));

  const handleOrgNrChange = (raw: string) => {
    const formatted = formatOrgNr(raw);
    const vat       = deriveVat(formatted);
    setProfile(p => ({ ...p, orgNr: formatted, vatNr: vat }));
  };

  // ── Logo upload ────────────────────────────────────────────────────────────

  const handleLogoFile = async (file: File) => {
    setLogoErr('');
    setLogoResized(false);

    if (!file.type.startsWith('image/')) {
      setLogoErr('Endast bildfiler tillåtna (PNG, JPG, SVG, WebP).');
      return;
    }

    const isSvg    = file.type === 'image/svg+xml';
    const tooBig   = file.size > MAX_LOGO_KB * 1024;

    if (!tooBig || isSvg) {
      // Small enough (or SVG — keep as vector) → read as-is
      if (isSvg && tooBig) {
        setLogoErr(`SVG-filen är för stor. Max ${MAX_LOGO_KB} KB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        setProfile(p => ({ ...p, logoDataUrl: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      // Raster image too large → auto-resize using canvas
      setLogoResizing(true);
      try {
        const resized = await resizeImage(file, MAX_LOGO_KB);
        setProfile(p => ({ ...p, logoDataUrl: resized }));
        setLogoResized(true);
      } catch {
        setLogoErr('Kunde inte bearbeta bilden. Försök med en annan fil.');
      } finally {
        setLogoResizing(false);
      }
    }
  };

  // ── Cover image upload ─────────────────────────────────────────────────────

  const handleCoverFile = async (file: File) => {
    setCoverErr('');
    setCoverResized(false);

    if (!file.type.startsWith('image/')) {
      setCoverErr('Endast bildfiler tillåtna (PNG, JPG, WebP).');
      return;
    }
    if (file.type === 'image/svg+xml') {
      setCoverErr('SVG stöds inte som omslagsbild. Använd PNG eller JPG.');
      return;
    }

    const tooBig = file.size > MAX_COVER_KB * 1024;
    if (!tooBig) {
      const reader = new FileReader();
      reader.onload = e => {
        setProfile(p => ({ ...p, coverImageDataUrl: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setCoverResizing(true);
      try {
        const resized = await resizeImage(file, MAX_COVER_KB);
        setProfile(p => ({ ...p, coverImageDataUrl: resized }));
        setCoverResized(true);
      } catch {
        setCoverErr('Kunde inte bearbeta bilden. Försök med en annan fil.');
      } finally {
        setCoverResizing(false);
      }
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

      // Sync dealershipName into the user object so the Sidebar reflects it
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const user = JSON.parse(rawUser);
        user.dealershipName = profile.name;
        localStorage.setItem('user', JSON.stringify(user));
      }

      // Notify same-tab listeners immediately (Sidebar, etc.)
      window.dispatchEvent(new StorageEvent('storage', { key: 'dealership_profile' }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'user' }));

      // Write to Supabase so other devices receive the update via Realtime
      const dealershipId = getDealershipId();
      if (dealershipId) {
        await saveProfileToSupabase(dealershipId, profile);
      }

      setSaving(false);
      toast.success('Profil sparad', { description: `${profile.name} · ${profile.orgNr}` });
    } catch (err) {
      setSaving(false);
      const detail = err instanceof Error ? err.message : String(err);
      toast.error('Kunde inte spara profilen.', { description: detail });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">Inställningar</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">Återförsäljarprofil</span>
          </nav>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">Återförsäljarprofil</h1>
              <p className="text-sm text-slate-500 mt-1">
                Företagets namn, adress, organisationsnummer, logotyp och kontaktuppgifter
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:opacity-60 text-white text-sm font-bold transition-colors shrink-0"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sparar…</>
              ) : (
                <>💾 Spara ändringar</>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 md:px-8 py-8 max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Company Info ── */}
            <SectionCard title="Företagsinformation" icon="🏢">
              <Field label="Företagsnamn">
                <Input
                  value={profile.name}
                  onChange={set('name')}
                  placeholder="AVA MC AB"
                />
              </Field>
              <Field
                label="Organisationsnummer"
                hint="Format: 556123-4567"
              >
                <Input
                  value={profile.orgNr}
                  onChange={handleOrgNrChange}
                  placeholder="556123-4567"
                  mono
                />
              </Field>
              <Field
                label="Momsnummer (VAT)"
                hint="Härleds automatiskt från org.nr"
              >
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={profile.vatNr}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500 font-mono tracking-wider cursor-not-allowed"
                  />
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded-lg font-semibold">AUTO</span>
                </div>
              </Field>
              <Toggle
                checked={profile.fSkatt}
                onChange={set('fSkatt')}
                label="F-skattebevis registrerat"
              />
            </SectionCard>

            {/* ── Address ── */}
            <SectionCard title="Adress" icon="📍">
              <Field label="Gatuadress">
                <Input
                  value={profile.street}
                  onChange={set('street')}
                  placeholder="Knarrarnäsgatan 7"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Postnummer">
                  <Input
                    value={profile.postalCode}
                    onChange={set('postalCode')}
                    placeholder="164 40"
                    mono
                  />
                </Field>
                <Field label="Ort">
                  <Input
                    value={profile.city}
                    onChange={set('city')}
                    placeholder="Kista"
                  />
                </Field>
              </div>
              <Field label="Län">
                <select
                  value={profile.county}
                  onChange={e => set('county')(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C] transition-all"
                >
                  {SWEDISH_COUNTIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </SectionCard>

            {/* ── Contact ── */}
            <SectionCard title="Kontaktuppgifter" icon="📞">
              <Field label="Telefon">
                <PhoneInput
                  value={profile.phone}
                  onChange={set('phone')}
                  placeholder="123 456 78"
                />
              </Field>
              <Field label="E-post">
                <Input
                  value={profile.email}
                  onChange={set('email')}
                  placeholder="info@avamc.se"
                  type="email"
                />
              </Field>
              <Field
                label="Företagets e-postdomän"
                hint="Används när ni bjuder in personal — t.ex. avamc.se ger @avamc.se"
              >
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#FF6B2C]/30 focus-within:border-[#FF6B2C] transition-all bg-white">
                  <span className="px-3 text-sm text-slate-400 select-none">@</span>
                  <input
                    type="text"
                    value={profile.emailDomain}
                    onChange={e => setProfile(p => ({ ...p, emailDomain: e.target.value.toLowerCase().replace(/^@/, '') }))}
                    placeholder="avamc.se"
                    className="flex-1 py-2.5 pr-3 text-sm text-slate-900 bg-transparent outline-none font-mono"
                  />
                </div>
              </Field>
              <Field label="Hemsida">
                <Input
                  value={profile.website}
                  onChange={set('website')}
                  placeholder="https://avamc.se"
                  type="url"
                />
              </Field>
            </SectionCard>

            {/* ── Banking ── */}
            <SectionCard title="Bankuppgifter" icon="🏦">
              <Field
                label="Bankgironummer"
                hint="Format: 1234-5678"
              >
                <Input
                  value={profile.bankgiro}
                  onChange={v => setProfile(p => ({ ...p, bankgiro: formatBankgiro(v) }))}
                  placeholder="1234-5678"
                  mono
                />
              </Field>
              <Field
                label="Swish (företagsnummer)"
                hint="10 siffror, används för betalningar"
              >
                <Input
                  value={profile.swish}
                  onChange={set('swish')}
                  placeholder="1231234567"
                  mono
                />
              </Field>
            </SectionCard>

            {/* ── Notification emails ── */}
            <SectionCard title="Notification Emails" icon="📧">
              <Field
                label="Delivery Note Email"
                hint="Who receives an email when a supplier delivery note arrives. Leave blank to use the general contact email."
              >
                <Input
                  value={profile.deliveryNoteEmail}
                  onChange={set('deliveryNoteEmail')}
                  placeholder="warehouse@yourcompany.com"
                  type="email"
                />
              </Field>
              <Field
                label="Invoice Email"
                hint="Who receives purchase invoices from suppliers. Leave blank to use the general contact email."
              >
                <Input
                  value={profile.invoiceEmail}
                  onChange={set('invoiceEmail')}
                  placeholder="accounts@yourcompany.com"
                  type="email"
                />
              </Field>
            </SectionCard>

            {/* ── Cover image ── full-width ── */}
            <div className="lg:col-span-2">
              <SectionCard title="Omslagsbild — Dashboard-bakgrund" icon="🏞️">
                <p className="text-xs text-slate-400 -mt-2 mb-2">
                  Visas som bakgrundsbild på dashboard. Välj ett foto av er showroom, lokal eller flotta. Rekommenderat: liggande format (16:9), minst 1280 × 720 px.
                </p>
                <div className="flex items-start gap-6 flex-wrap">

                  {/* Landscape preview */}
                  <div className="w-full max-w-xs rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden" style={{ aspectRatio: '16/7' }}>
                    {profile.coverImageDataUrl ? (
                      <img
                        src={profile.coverImageDataUrl}
                        alt="Omslagsbild"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center py-6">
                        <span className="text-4xl">🏢</span>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Ingen omslagsbild</p>
                        <p className="text-[10px] text-slate-300">16:9 rekommenderat</p>
                      </div>
                    )}
                  </div>

                  {/* Upload controls */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-0.5">Ladda upp omslagsbild</p>
                      <p className="text-xs text-slate-400">PNG, JPG eller WebP · Max {MAX_COVER_KB} KB (stora bilder skalas automatiskt)</p>
                    </div>

                    <input
                      ref={coverRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleCoverFile(f);
                        e.target.value = '';
                      }}
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => coverRef.current?.click()}
                        disabled={coverResizing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-[#FF6B2C]/40 hover:bg-orange-50 text-sm font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {coverResizing ? (
                          <><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Ändrar storlek…</>
                        ) : '📂 Välj bild'}
                      </button>
                      {profile.coverImageDataUrl && !coverResizing && (
                        <button
                          type="button"
                          onClick={() => { setProfile(p => ({ ...p, coverImageDataUrl: '' })); setCoverResized(false); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-600 transition-all"
                        >
                          🗑 Ta bort
                        </button>
                      )}
                    </div>

                    {coverErr && <p className="text-xs text-red-500 font-medium">{coverErr}</p>}
                    {coverResizing && <p className="text-xs text-amber-600 font-medium">⏳ Bilden är stor — ändrar storlek automatiskt…</p>}
                    {coverResized && !coverResizing && (
                      <p className="text-xs text-blue-600 font-medium">✓ Bild komprimerad och anpassad automatiskt</p>
                    )}
                    {profile.coverImageDataUrl && !coverResized && !coverResizing && (
                      <p className="text-xs text-green-600 font-medium">✓ Omslagsbild uppladdad — visas på dashboard</p>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* ── Logo ── full-width ── */}
            <div className="lg:col-span-2">
              <SectionCard title="Logotyp" icon="🖼">
                <div className="flex items-start gap-6 flex-wrap">

                  {/* Preview */}
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {profile.logoDataUrl ? (
                      <img
                        src={profile.logoDataUrl}
                        alt="Logotyp"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center">
                        <span className="text-3xl">🏍</span>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Ingen logotyp</p>
                      </div>
                    )}
                  </div>

                  {/* Upload controls */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-0.5">Ladda upp logotyp</p>
                      <p className="text-xs text-slate-400">PNG, JPG, SVG eller WebP · Max {MAX_LOGO_KB} KB</p>
                    </div>

                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoFile(f);
                        e.target.value = '';
                      }}
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={logoResizing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-[#FF6B2C]/40 hover:bg-orange-50 text-sm font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {logoResizing ? (
                          <><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Ändrar storlek…</>
                        ) : '📂 Välj fil'}
                      </button>
                      {profile.logoDataUrl && !logoResizing && (
                        <button
                          type="button"
                          onClick={() => { setProfile(p => ({ ...p, logoDataUrl: '' })); setLogoResized(false); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-600 transition-all"
                        >
                          🗑 Ta bort
                        </button>
                      )}
                    </div>

                    {logoErr && (
                      <p className="text-xs text-red-500 font-medium">{logoErr}</p>
                    )}

                    {logoResizing && (
                      <p className="text-xs text-amber-600 font-medium">
                        ⏳ Bilden är stor — ändrar storlek automatiskt…
                      </p>
                    )}

                    {logoResized && !logoResizing && (
                      <p className="text-xs text-blue-600 font-medium">
                        ✓ Bild komprimerad och anpassad automatiskt till {MAX_LOGO_KB} KB
                      </p>
                    )}

                    {profile.logoDataUrl && !logoResized && !logoResizing && (
                      <p className="text-xs text-green-600 font-medium">✓ Logotyp uppladdad och sparas lokalt</p>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>

          </div>

          {/* Live preview card */}
          <div className="mt-5 bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Förhandsvisning — visas på avtal och fakturor</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-14 h-14 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {profile.logoDataUrl
                  ? <img src={profile.logoDataUrl} alt="" className="w-full h-full object-contain p-1" />
                  : <span className="text-xl">🏍</span>
                }
              </div>
              <div>
                <p className="text-base font-black text-[#0b1524]">{profile.name || '—'}</p>
                <p className="text-xs text-slate-400 mt-0.5">Org.nr {profile.orgNr || '—'} · {profile.vatNr || '—'}</p>
                <p className="text-xs text-slate-400">{profile.street}, {profile.postalCode} {profile.city}</p>
                <p className="text-xs text-slate-400">{profile.phone} · {profile.email}</p>
              </div>
              {profile.fSkatt && (
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-auto self-start">
                  ✓ F-skatt
                </span>
              )}
            </div>
          </div>

          {/* Bottom save bar */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
            <Link
              href="/settings"
              className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
            >
              ← Tillbaka till inställningar
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:opacity-60 text-white text-sm font-bold transition-colors"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sparar…</>
              ) : '💾 Spara ändringar'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
