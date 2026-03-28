'use client';

// ─── European country list ────────────────────────────────────────────────────

interface Country { code: string; name: string; dial: string; flag: string; }

export const EUROPE: Country[] = [
  { code: 'SE', name: 'Sverige',             dial: '+46',  flag: '🇸🇪' },
  { code: 'NO', name: 'Norge',               dial: '+47',  flag: '🇳🇴' },
  { code: 'DK', name: 'Danmark',             dial: '+45',  flag: '🇩🇰' },
  { code: 'FI', name: 'Finland',             dial: '+358', flag: '🇫🇮' },
  { code: 'IS', name: 'Ísland',              dial: '+354', flag: '🇮🇸' },
  { code: 'DE', name: 'Deutschland',         dial: '+49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',              dial: '+33',  flag: '🇫🇷' },
  { code: 'GB', name: 'United Kingdom',      dial: '+44',  flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland',             dial: '+353', flag: '🇮🇪' },
  { code: 'NL', name: 'Nederland',           dial: '+31',  flag: '🇳🇱' },
  { code: 'BE', name: 'België',              dial: '+32',  flag: '🇧🇪' },
  { code: 'LU', name: 'Luxembourg',          dial: '+352', flag: '🇱🇺' },
  { code: 'CH', name: 'Schweiz',             dial: '+41',  flag: '🇨🇭' },
  { code: 'AT', name: 'Österreich',          dial: '+43',  flag: '🇦🇹' },
  { code: 'ES', name: 'España',              dial: '+34',  flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal',            dial: '+351', flag: '🇵🇹' },
  { code: 'IT', name: 'Italia',              dial: '+39',  flag: '🇮🇹' },
  { code: 'GR', name: 'Ελλάδα',              dial: '+30',  flag: '🇬🇷' },
  { code: 'CY', name: 'Κύπρος',              dial: '+357', flag: '🇨🇾' },
  { code: 'MT', name: 'Malta',               dial: '+356', flag: '🇲🇹' },
  { code: 'PL', name: 'Polska',              dial: '+48',  flag: '🇵🇱' },
  { code: 'CZ', name: 'Česko',               dial: '+420', flag: '🇨🇿' },
  { code: 'SK', name: 'Slovensko',           dial: '+421', flag: '🇸🇰' },
  { code: 'HU', name: 'Magyarország',        dial: '+36',  flag: '🇭🇺' },
  { code: 'SI', name: 'Slovenija',           dial: '+386', flag: '🇸🇮' },
  { code: 'HR', name: 'Hrvatska',            dial: '+385', flag: '🇭🇷' },
  { code: 'BA', name: 'Bosna i Hercegovina', dial: '+387', flag: '🇧🇦' },
  { code: 'RS', name: 'Srbija',              dial: '+381', flag: '🇷🇸' },
  { code: 'ME', name: 'Crna Gora',           dial: '+382', flag: '🇲🇪' },
  { code: 'MK', name: 'Sjeverna Makedonija', dial: '+389', flag: '🇲🇰' },
  { code: 'AL', name: 'Shqipëria',           dial: '+355', flag: '🇦🇱' },
  { code: 'RO', name: 'România',             dial: '+40',  flag: '🇷🇴' },
  { code: 'BG', name: 'България',            dial: '+359', flag: '🇧🇬' },
  { code: 'EE', name: 'Eesti',               dial: '+372', flag: '🇪🇪' },
  { code: 'LV', name: 'Latvija',             dial: '+371', flag: '🇱🇻' },
  { code: 'LT', name: 'Lietuva',             dial: '+370', flag: '🇱🇹' },
  { code: 'BY', name: 'Беларусь',            dial: '+375', flag: '🇧🇾' },
  { code: 'UA', name: 'Україна',             dial: '+380', flag: '🇺🇦' },
  { code: 'MD', name: 'Moldova',             dial: '+373', flag: '🇲🇩' },
  { code: 'RU', name: 'Россия',              dial: '+7',   flag: '🇷🇺' },
  { code: 'TR', name: 'Türkiye',             dial: '+90',  flag: '🇹🇷' },
  { code: 'LI', name: 'Liechtenstein',       dial: '+423', flag: '🇱🇮' },
  { code: 'MC', name: 'Monaco',              dial: '+377', flag: '🇲🇨' },
  { code: 'SM', name: 'San Marino',          dial: '+378', flag: '🇸🇲' },
  { code: 'AD', name: 'Andorra',             dial: '+376', flag: '🇦🇩' },
  { code: 'XK', name: 'Kosovo',              dial: '+383', flag: '🇽🇰' },
];

// Sort longest dial first so +358 matches before +35
const SORTED = [...EUROPE].sort((a, b) => b.dial.length - a.dial.length);

function parsePhone(val: string): { code: string; local: string } {
  if (val.startsWith('+')) {
    const match = SORTED.find(c => val.startsWith(c.dial + ' ') || val === c.dial);
    if (match) return { code: match.code, local: val.slice(match.dial.length).trimStart() };
    const match2 = SORTED.find(c => val.startsWith(c.dial));
    if (match2) return { code: match2.code, local: val.slice(match2.dial.length).trimStart() };
  }
  return { code: 'SE', local: val };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /**
   * className for the wrapper div — controls border, ring, rounded, bg.
   * Defaults to the orange-accent style used throughout the app.
   */
  className?: string;
  /**
   * Extra classes appended to the <input> element (e.g. override padding/size).
   * Defaults to 'py-2.5'.
   */
  inputClassName?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** When set, overrides the wrapper className to show a red error border. */
  error?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '70 123 45 67',
  className,
  inputClassName,
  required,
  disabled,
  id,
  error,
}: PhoneInputProps) {
  const { code, local } = parsePhone(value);
  const country = EUROPE.find(c => c.code === code) ?? EUROPE[0];

  const handleCountry = (newCode: string) => {
    const c = EUROPE.find(e => e.code === newCode)!;
    onChange(local ? `${c.dial} ${local}` : '');
  };

  const handleLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const l = e.target.value;
    onChange(l ? `${country.dial} ${l}` : '');
  };

  const wrapper = error
    ? 'rounded-xl border border-red-400 focus-within:ring-2 focus-within:ring-red-400/20 focus-within:border-red-400 transition-all bg-red-50'
    : className ??
      'rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#FF6B2C]/20 focus-within:border-[#FF6B2C] transition-all';

  return (
    <div className={`flex items-stretch overflow-hidden ${wrapper}`}>
      <select
        value={code}
        onChange={e => handleCountry(e.target.value)}
        disabled={disabled}
        aria-label="Country code"
        className="shrink-0 bg-slate-50 border-r border-slate-200 pl-2 pr-1 text-sm font-medium text-slate-700 focus:outline-none cursor-pointer hover:bg-slate-100 transition-colors"
      >
        {EUROPE.map(c => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        value={local}
        onChange={handleLocal}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="tel"
        className={`flex-1 min-w-0 px-3 text-sm text-slate-900 bg-white focus:outline-none ${inputClassName ?? 'py-2.5'}`}
      />
    </div>
  );
}
