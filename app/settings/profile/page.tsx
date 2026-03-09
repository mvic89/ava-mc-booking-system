'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';

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
  website:           string;
  bankgiro:          string;
  swish:             string;
  logoDataUrl:       string;
  coverImageDataUrl: string;
}

const SWEDISH_COUNTIES = [
  'Blekinge', 'Dalarna', 'Gotland', 'Gävleborg', 'Halland',
  'Jämtland', 'Jönköping', 'Kalmar', 'Kronoberg', 'Norrbotten',
  'Skåne', 'Stockholm', 'Södermanland', 'Uppsala', 'Värmland',
  'Västerbotten', 'Västernorrland', 'Västmanland', 'Västra Götaland',
  'Örebro', 'Östergötland',
];

const DEFAULTS: DealershipProfile = {
  name:        'AVA MC AB',
  orgNr:       '556123-4567',
  vatNr:       'SE556123456701',
  fSkatt:      true,
  street:      'Knarrarnäsgatan 7',
  postalCode:  '164 40',
  city:        'Kista',
  county:      'Stockholm',
  phone:       '08-123 456 78',
  email:       'info@avamc.se',
  website:     'https://avamc.se',
  bankgiro:    '1234-5678',
  swish:       '1231234567',
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

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.name) setProfile({ ...DEFAULTS, ...saved });
    } catch {
      // use defaults
    }
  }, [router]);

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

  const handleSave = () => {
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

      setTimeout(() => {
        setSaving(false);
        toast.success('Profil sparad', { description: `${profile.name} · ${profile.orgNr}` });
      }, 350);
    } catch {
      setSaving(false);
      toast.error('Kunde inte spara profilen.');
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
                <Input
                  value={profile.phone}
                  onChange={set('phone')}
                  placeholder="08-123 456 78"
                  type="tel"
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
