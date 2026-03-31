// ─── Customer import — universal file parser ────────────────────────────────
//
// Supports CSV, TSV, TXT and PDF files.
// Every column in the source file is preserved:
//   • Recognised columns  → mapped to a Customer field
//   • Unknown columns     → default to 'note', stored in customer.notes as JSON
//   • Explicitly skipped  → discarded

import type { Customer, Tag, Source } from './customers';

// ── Field identifiers ─────────────────────────────────────────────────────────

/** All standard Customer fields that can be mapped from an import column. */
export type StandardField =
  | 'firstName' | 'lastName' | 'fullName'
  | 'email' | 'phone' | 'personnummer'
  | 'address' | 'city'
  | 'birthDate' | 'gender'
  | 'source' | 'tag' | 'lifetimeValue' | 'lastActivity';

/** Special field values for the mapping UI. */
export type MappedField = StandardField | 'note' | 'skip';

/** Human-readable label for every MappedField (used in dropdowns + preview). */
export const FIELD_LABELS: Record<MappedField, string> = {
  firstName:     'Förnamn',
  lastName:      'Efternamn',
  fullName:      'Fullt namn',
  email:         'E-post',
  phone:         'Telefon',
  personnummer:  'Personnummer',
  address:       'Adress',
  city:          'Ort',
  birthDate:     'Födelsedag',
  gender:        'Kön',
  source:        'Källa',
  tag:           'Tag',
  lifetimeValue: 'Livstidsvärde',
  lastActivity:  'Senaste aktivitet',
  note:          'Spara som notering',
  skip:          '— Hoppa över —',
};

/** Grouped field options for the mapping dropdowns. */
export const FIELD_GROUPS: { label: string; fields: MappedField[] }[] = [
  { label: 'Kontaktinfo',    fields: ['firstName', 'lastName', 'fullName', 'email', 'phone', 'personnummer'] },
  { label: 'Adress',         fields: ['address', 'city'] },
  { label: 'Personuppgifter',fields: ['birthDate', 'gender'] },
  { label: 'CRM',            fields: ['source', 'tag', 'lifetimeValue', 'lastActivity'] },
  { label: 'Övrigt',         fields: ['note', 'skip'] },
];

// ── Parse result ──────────────────────────────────────────────────────────────

export interface ParseResult {
  /** Original column headers (lowercased for matching; shown as raw in the UI) */
  headers:  string[];
  /** Raw values: rawRows[rowIndex][colIndex] */
  rawRows:  string[][];
  /** Auto-suggested mapping for each header column */
  mapping:  MappedField[];
  fileType: 'csv' | 'txt' | 'pdf';
}

// ── MappedRow — one import row after mapping is applied ──────────────────────

export interface MappedRow {
  firstName:     string;
  lastName:      string;
  fullName:      string;
  email:         string;
  phone:         string;
  personnummer:  string;
  address:       string;
  postalCode:    string;
  city:          string;
  birthDate:     string;
  gender:        string;
  source:        string;
  tag:           string;
  lifetimeValue: string;
  lastActivity:  string;
  /** Extra columns mapped to 'note': { originalHeader → value }  */
  _extras:       Record<string, string>;
  /** All original raw values for the preview table: { originalHeader → value } */
  _raw:          Record<string, string>;
  /** True when row has at least a name, email, phone, or personnummer. */
  _hasData:      boolean;
  /** 1-based source line number for error reporting */
  _rowNum:       number;
}

// ── Delimiter detection ───────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { '\t': 0, ';': 0, ',': 0, '|': 0 };
  for (const ch of line) if (ch in counts) counts[ch]++;
  // Prefer tab/semicolon (more structured) over comma when equal
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── RFC-4180 line splitter (handles quoted fields + escaped double-quotes) ────

function splitLine(line: string, delim: string): string[] {
  const cols: string[] = [];
  let cell    = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === delim && !inQuote) {
      cols.push(cell.trim()); cell = '';
    } else {
      cell += ch;
    }
  }
  cols.push(cell.trim());
  return cols;
}

// ── Delimited text parser (CSV / TSV / TXT / PDF-extracted text) ─────────────

export function parseDelimitedText(text: string): Pick<ParseResult, 'headers' | 'rawRows'> {
  const clean = text.replace(/^\uFEFF/, '');   // strip UTF-8 BOM
  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rawRows: [] };

  const delim  = detectDelimiter(lines[0]);
  // Keep original header text for display; lowercase copy for alias matching
  const rawHdr = splitLine(lines[0], delim).map(h => h.trim());
  const headers = rawHdr.map(h => h.toLowerCase());

  const rawRows = lines
    .slice(1)
    .map(l => splitLine(l, delim))
    .filter(cols => cols.some(c => c.trim().length > 0));

  return { headers, rawRows };
}

// ── Column-header → Customer field auto-mapping ───────────────────────────────

const ALIASES: Record<string, StandardField> = {
  // firstName
  'first name': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName',
  'förnamn': 'firstName', 'fornamn': 'firstName', 'given name': 'firstName',
  'givenname': 'firstName', 'given_name': 'firstName', 'fname': 'firstName',
  // lastName
  'last name': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName',
  'efternamn': 'lastName', 'surname': 'lastName', 'family name': 'lastName',
  'familyname': 'lastName', 'family_name': 'lastName', 'lname': 'lastName',
  // fullName
  'name': 'fullName', 'full name': 'fullName', 'full_name': 'fullName',
  'customer name': 'fullName', 'namn': 'fullName', 'kundnamn': 'fullName',
  'customer': 'fullName', 'kund': 'fullName', 'kundens namn': 'fullName',
  'client': 'fullName', 'client name': 'fullName',
  // email
  'email': 'email', 'e-mail': 'email', 'e_mail': 'email',
  'email address': 'email', 'epost': 'email', 'e-post': 'email', 'mail': 'email',
  'emailaddress': 'email',
  // phone
  'phone': 'phone', 'telephone': 'phone', 'tel': 'phone', 'mobile': 'phone',
  'mobil': 'phone', 'cell': 'phone', 'telefon': 'phone', 'mobilnummer': 'phone',
  'mobiltelefon': 'phone', 'phonenumber': 'phone', 'phone number': 'phone',
  'telefonnummer': 'phone', 'cell phone': 'phone',
  // personnummer
  'personnummer': 'personnummer', 'pnr': 'personnummer', 'ssn': 'personnummer',
  'personal number': 'personnummer', 'personal_number': 'personnummer',
  'id-nummer': 'personnummer', 'id nummer': 'personnummer', 'personid': 'personnummer',
  'social security': 'personnummer', 'identity number': 'personnummer',
  // address
  'address': 'address', 'adress': 'address', 'street': 'address',
  'street address': 'address', 'gatuadress': 'address', 'gata': 'address',
  'street_address': 'address', 'addr': 'address',
  // city
  'city': 'city', 'ort': 'city', 'stad': 'city', 'town': 'city',
  'postort': 'city', 'municipality': 'city', 'postal city': 'city',
  // birthDate
  'birth date': 'birthDate', 'birthdate': 'birthDate', 'birth_date': 'birthDate',
  'date of birth': 'birthDate', 'dob': 'birthDate', 'födelsedag': 'birthDate',
  'birthday': 'birthDate', 'födelseår': 'birthDate', 'born': 'birthDate',
  // gender
  'gender': 'gender', 'sex': 'gender', 'kön': 'gender',
  // source
  'source': 'source', 'källa': 'source', 'origin': 'source', 'ursprung': 'source',
  'customer source': 'source',
  // tag
  'tag': 'tag', 'tagg': 'tag', 'category': 'tag', 'kategori': 'tag',
  'customer type': 'tag', 'kundtyp': 'tag', 'status': 'tag', 'type': 'tag',
  'segment': 'tag', 'label': 'tag',
  // lifetimeValue
  'lifetime value': 'lifetimeValue', 'lifetimevalue': 'lifetimeValue',
  'total value': 'lifetimeValue', 'total amount': 'lifetimeValue',
  'livstidsvärde': 'lifetimeValue', 'totalvärde': 'lifetimeValue',
  'value': 'lifetimeValue', 'värde': 'lifetimeValue', 'purchase amount': 'lifetimeValue',
  'total purchases': 'lifetimeValue', 'revenue': 'lifetimeValue',
  // lastActivity
  'last activity': 'lastActivity', 'lastactivity': 'lastActivity',
  'last_activity': 'lastActivity', 'senaste aktivitet': 'lastActivity',
  'last seen': 'lastActivity', 'last visit': 'lastActivity',
  'last contact': 'lastActivity', 'last purchase': 'lastActivity',
  'latest purchase': 'lastActivity',
};

/** Returns a suggested MappedField for each header. Unknown headers default to 'note'. */
export function autoSuggestMapping(headers: string[]): MappedField[] {
  return headers.map(h => ALIASES[h.toLowerCase().trim()] ?? 'note');
}

// ── Apply mapping to raw rows ─────────────────────────────────────────────────

const STANDARD_FIELDS = new Set<StandardField>([
  'firstName', 'lastName', 'fullName', 'email', 'phone', 'personnummer',
  'address', 'city', 'birthDate', 'gender', 'source', 'tag', 'lifetimeValue', 'lastActivity',
]);

export function applyMapping(
  rawRows: string[][],
  headers: string[],
  mapping: MappedField[],
): MappedRow[] {
  return rawRows
    .map((row, ri) => {
      const r: MappedRow = {
        firstName: '', lastName: '', fullName: '', email: '', phone: '',
        personnummer: '', address: '', postalCode: '', city: '', birthDate: '', gender: '',
        source: '', tag: '', lifetimeValue: '', lastActivity: '',
        _extras: {}, _raw: {}, _hasData: false, _rowNum: ri + 2,
      };

      headers.forEach((header, i) => {
        const raw  = (row[i] ?? '').trim();
        r._raw[header] = raw;          // always capture for preview

        const field = mapping[i];
        if (!raw || field === 'skip') return;

        if (field === 'note') {
          r._extras[header] = raw;
          return;
        }

        if (STANDARD_FIELDS.has(field as StandardField)) {
          const current = r[field as StandardField];
          r[field as StandardField] = current ? `${current} ${raw}` : raw;
        }
      });

      // Split fullName → firstName / lastName when no dedicated columns were mapped
      if (!r.firstName && r.fullName) {
        const parts = r.fullName.trim().split(/\s+/);
        r.firstName = parts[0] ?? '';
        r.lastName  = parts.slice(1).join(' ');
      }

      r._hasData = !!(r.firstName || r.fullName || r.email || r.phone || r.personnummer);
      return r;
    })
    .filter(r => r._hasData);
}

// ── Value normalisers ─────────────────────────────────────────────────────────

function normaliseGender(raw: string): 'Man' | 'Kvinna' {
  const s = raw.toLowerCase().trim();
  if (['f', 'female', 'kvinna', 'woman', 'w', 'k', 'woman'].includes(s)) return 'Kvinna';
  return 'Man';
}

function normaliseTag(raw: string): Tag {
  const s = raw.toLowerCase().trim();
  if (['vip', 'premium', 'gold', 'platinum'].includes(s)) return 'VIP';
  if (['active', 'aktiv', 'regular', 'returning'].includes(s)) return 'Active';
  if (['inactive', 'inaktiv', 'dormant', 'churned', 'lapsed'].includes(s)) return 'Inactive';
  return 'New';
}

function normaliseSource(raw: string): Source {
  const s = raw.toLowerCase().trim().replace(/[\s-]/g, '');
  if (['bankid', 'bank-id', 'bankid'].includes(s)) return 'BankID';
  return 'Manual';
}

function normaliseLifetimeValue(raw: string): number {
  const num = parseFloat(raw.replace(/[^0-9.,]/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function normaliseDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  // Try direct Date parse
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try Swedish format: YYYYMMDD or YYYY-MM-DD or DD/MM/YYYY
  const m = raw.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`).toISOString();
  return new Date().toISOString();
}

// ── Convert a MappedRow to a Customer (ready for createCustomer) ──────────────

export function rowToCustomer(row: MappedRow): Omit<Customer, 'id'> {
  const firstName = row.firstName || row.fullName.split(' ')[0] || '—';
  const lastName  = row.lastName  || row.fullName.split(' ').slice(1).join(' ') || '—';

  // Build notes from extra columns
  let notes: string | undefined;
  if (Object.keys(row._extras).length > 0) {
    notes = Object.entries(row._extras)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  const lastActivityISO = row.lastActivity ? normaliseDate(row.lastActivity) : new Date().toISOString();

  // Smart tag: use explicit tag column if present; otherwise infer from lastActivity date
  let resolvedTag: Tag;
  if (row.tag) {
    resolvedTag = normaliseTag(row.tag);
  } else {
    const actDate = new Date(lastActivityISO);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    resolvedTag = actDate >= twoYearsAgo ? 'Active' : 'Inactive';
  }

  return {
    firstName,
    lastName,
    personnummer:      row.personnummer  || '',
    email:             row.email         || '',
    phone:             row.phone         || '',
    address:           row.address       || '',
    postalCode:        row.postalCode    || '',
    city:              row.city          || '',
    birthDate:         row.birthDate     || '',
    gender:            row.gender ? normaliseGender(row.gender) : 'Man',
    source:            row.source ? normaliseSource(row.source) : 'Manual',
    tag:               resolvedTag,
    lifetimeValue:     row.lifetimeValue ? normaliseLifetimeValue(row.lifetimeValue) : 0,
    lastActivity:      lastActivityISO,
    customerSince:     '',
    riskLevel:         'low',
    citizenship:       '',
    deceased:          false,
    vehicles:          0,
    bankidVerified:    normaliseSource(row.source || '') === 'BankID',
    protectedIdentity: false,
    notes,
  };
}

// ── PDF text extraction (pdfjs-dist, worker served from /public) ──────────────

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf      = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group text items by Y coordinate (±3 pt tolerance) to reconstruct table rows
    const byY = new Map<number, { x: number; str: string }[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of content.items as any[]) {
      const s = (item.str as string ?? '').trim();
      if (!s) continue;
      const rawY = Math.round(item.transform[5] as number);
      const rawX = Math.round(item.transform[4] as number);
      let bucket = rawY;
      for (const key of byY.keys()) {
        if (Math.abs(key - rawY) <= 3) { bucket = key; break; }
      }
      if (!byY.has(bucket)) byY.set(bucket, []);
      byY.get(bucket)!.push({ x: rawX, str: s });
    }

    // Sort buckets top-to-bottom; items left-to-right within each line
    for (const y of Array.from(byY.keys()).sort((a, b) => b - a)) {
      const cells = byY.get(y)!.sort((a, b) => a.x - b.x);
      allLines.push(cells.map(c => c.str).join('\t'));
    }
  }

  return allLines.join('\n');
}

// ── KUNDLISTA (AVA MC AB / ERP export) specialized parser ────────────────────
//
// Format per customer (2 visual rows after Y-grouping):
//   Row 1: <kundkod>\t<LASTNAME FIRSTNAME>\t<YYYY-MM-DD>
//   Row 2: <FIRSTNAME LASTNAME>\t<phone>\t[phone duplicate]\t[email]
//
// Detection: ≥3 lines matching /^\d{3,5}\t[A-ZÅÄÖ ]+\t\d{4}-\d{2}-\d{2}/

function toTitleCase(s: string): string {
  return s.replace(/\p{L}+/gu, w =>
    w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1).toLowerCase()
  );
}

function splitKundlistaName(raw: string): { firstName: string; lastName: string } {
  const s = raw.trim();
  if (s.includes(',')) {
    const [last, ...rest] = s.split(',').map(p => p.trim());
    return { lastName: toTitleCase(last ?? ''), firstName: toTitleCase(rest.join(' ')) };
  }
  const words = s.split(/\s+/);
  // first word = lastName, rest = firstName (ALL-CAPS ERP format)
  return { lastName: toTitleCase(words[0] ?? ''), firstName: toTitleCase(words.slice(1).join(' ')) };
}

function isKundlistaText(text: string): boolean {
  const lines = text.split('\n').slice(0, 40);
  const codeLineRe = /^\d{3,5}\t[A-ZÅÄÖÜÉ ]+\t\d{4}-\d{2}-\d{2}/;
  return lines.filter(l => codeLineRe.test(l)).length >= 3;
}

function parseKundlista(text: string): Pick<ParseResult, 'headers' | 'rawRows'> {
  const headers = ['kundkod', 'förnamn', 'efternamn', 'lastactivity', 'telefon', 'email'];
  const rawRows: string[][] = [];
  const lines  = text.split('\n').filter(l => l.trim().length > 0);
  const codeRe = /^\d{3,5}\t/;

  let i = 0;
  // Skip non-data header lines (e.g. "Kundkod\tKundnamn\t...")
  while (i < lines.length && !codeRe.test(lines[i]!)) i++;

  while (i < lines.length) {
    const line1 = lines[i]!;
    if (!codeRe.test(line1)) { i++; continue; }

    const cols1   = line1.split('\t');
    const kundkod = (cols1[0] ?? '').trim();
    const nameRaw = (cols1[1] ?? '').trim();   // "LASTNAME FIRSTNAME"
    const dateRaw = (cols1[2] ?? '').trim();   // "YYYY-MM-DD"

    let phone = '';
    let email = '';

    // Contact line: next line that does NOT start with digits
    const nextIdx = i + 1;
    if (nextIdx < lines.length && !codeRe.test(lines[nextIdx]!)) {
      const cols2  = lines[nextIdx]!.split('\t');
      // cols2[0] = name (reversed) — skip it; collect phone + email from rest
      const vals   = cols2.slice(1).map(v => v.trim()).filter(Boolean);
      const phones: string[] = [];
      const emails: string[] = [];
      for (const v of vals) {
        if (v.includes('@')) emails.push(v);
        else phones.push(v);
      }
      // Deduplicate: ERP often exports the same phone twice
      const uniquePhones = [...new Set(phones)];
      phone = uniquePhones[0] ?? '';
      email = emails[0] ?? '';
      i = nextIdx + 1;
    } else {
      i++;
    }

    const { firstName, lastName } = splitKundlistaName(nameRaw);
    rawRows.push([kundkod, firstName, lastName, dateRaw, phone, email]);
  }

  return { headers, rawRows };
}

// ── Master parser — dispatches by file extension ──────────────────────────────

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const fileType: ParseResult['fileType'] =
    ext === 'pdf' ? 'pdf' : ext === 'txt' ? 'txt' : 'csv';

  const text = ext === 'pdf'
    ? await extractPdfText(await file.arrayBuffer())
    : await file.text();

  // Auto-detect KUNDLISTA (AVA MC AB ERP export) format
  if (isKundlistaText(text)) {
    const { headers, rawRows } = parseKundlista(text);
    const mapping = autoSuggestMapping(headers);
    return { headers, rawRows, mapping, fileType };
  }

  const { headers, rawRows } = parseDelimitedText(text);
  const mapping = autoSuggestMapping(headers);
  return { headers, rawRows, mapping, fileType };
}
