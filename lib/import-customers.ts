// ─── Customer import — file parser ────────────────────────────────────────────

export interface ImportRow {
  firstName:    string;
  lastName:     string;
  fullName:     string;   // combined name column; split to first/last before saving
  email:        string;
  phone:        string;
  personnummer: string;
  address:      string;
  city:         string;
  birthDate:    string;
  gender:       string;
}

export type MappableField = keyof ImportRow;
export type MappedField   = MappableField | 'skip';

export const FIELD_LABELS: Record<MappableField | 'skip', string> = {
  firstName:    'Förnamn',
  lastName:     'Efternamn',
  fullName:     'Fullt namn',
  email:        'E-post',
  phone:        'Telefon',
  personnummer: 'Personnummer',
  address:      'Adress',
  city:         'Ort',
  birthDate:    'Födelsedag',
  gender:       'Kön',
  skip:         '— Hoppa över —',
};

// ── Delimiter detection ────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const ch of line) if (ch in counts) counts[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── CSV line splitter (handles quoted fields + double-quote escapes) ───────────

function splitLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === delim && !inQuote) {
      result.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Parse any delimited text (CSV / TSV / TXT) ────────────────────────────────

export function parseDelimitedText(text: string): { headers: string[]; rawRows: string[][] } {
  const clean = text.replace(/^\uFEFF/, ''); // strip UTF-8 BOM
  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rawRows: [] };

  const delim    = detectDelimiter(lines[0]);
  const headers  = splitLine(lines[0], delim).map(h => h.toLowerCase().trim());
  const rawRows  = lines.slice(1).map(l => splitLine(l, delim));

  return { headers, rawRows };
}

// ── Header-name → ImportRow field auto-mapping ────────────────────────────────

const FIELD_ALIASES: Record<string, MappedField> = {
  // firstName
  'first name': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName',
  'förnamn': 'firstName', 'fornamn': 'firstName', 'given name': 'firstName',
  'given_name': 'firstName', 'givenname': 'firstName',
  // lastName
  'last name': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName',
  'efternamn': 'lastName', 'surname': 'lastName', 'family name': 'lastName',
  'family_name': 'lastName', 'familyname': 'lastName',
  // fullName
  'name': 'fullName', 'full name': 'fullName', 'full_name': 'fullName',
  'customer name': 'fullName', 'namn': 'fullName', 'kundnamn': 'fullName',
  'customer': 'fullName', 'kundens namn': 'fullName', 'kund': 'fullName',
  // email
  'email': 'email', 'e-mail': 'email', 'e_mail': 'email',
  'email address': 'email', 'epost': 'email', 'e-post': 'email',
  'emailaddress': 'email', 'mail': 'email',
  // phone
  'phone': 'phone', 'telephone': 'phone', 'tel': 'phone', 'mobile': 'phone',
  'mobil': 'phone', 'cell': 'phone', 'phone number': 'phone', 'telefon': 'phone',
  'mobilnummer': 'phone', 'phonenumber': 'phone', 'mobiltelefon': 'phone',
  'telefonenummer': 'phone',
  // personnummer
  'personnummer': 'personnummer', 'personal_number': 'personnummer',
  'personal number': 'personnummer', 'ssn': 'personnummer',
  'id_number': 'personnummer', 'pnr': 'personnummer', 'personid': 'personnummer',
  'id-nummer': 'personnummer', 'id nummer': 'personnummer',
  // address
  'address': 'address', 'street': 'address', 'adress': 'address',
  'street address': 'address', 'gatuadress': 'address', 'addr': 'address',
  'street_address': 'address', 'gata': 'address',
  // city
  'city': 'city', 'ort': 'city', 'stad': 'city', 'town': 'city',
  'municipality': 'city', 'postort': 'city', 'postal city': 'city',
  // birthDate
  'birth date': 'birthDate', 'birthdate': 'birthDate', 'birth_date': 'birthDate',
  'date of birth': 'birthDate', 'dob': 'birthDate', 'födelsedag': 'birthDate',
  'birthday': 'birthDate', 'born': 'birthDate',
  // gender
  'gender': 'gender', 'sex': 'gender', 'kön': 'gender',
};

export function autoMapHeaders(headers: string[]): MappedField[] {
  return headers.map(h => FIELD_ALIASES[h.toLowerCase().trim()] ?? 'skip');
}

// ── Apply column mapping to raw rows ──────────────────────────────────────────

export function applyMapping(rawRows: string[][], mapping: MappedField[]): ImportRow[] {
  return rawRows
    .map(row => {
      const r: ImportRow = {
        firstName: '', lastName: '', fullName: '',
        email: '', phone: '', personnummer: '',
        address: '', city: '', birthDate: '', gender: '',
      };
      mapping.forEach((field, i) => {
        if (field !== 'skip') {
          const val = (row[i] ?? '').trim();
          if (val) r[field] = r[field] ? `${r[field]} ${val}` : val;
        }
      });
      // Split fullName → firstName / lastName if no dedicated columns mapped
      if (!r.firstName && r.fullName) {
        const parts = r.fullName.trim().split(/\s+/);
        r.firstName = parts[0] ?? '';
        r.lastName  = parts.slice(1).join(' ');
      }
      return r;
    })
    .filter(r => r.firstName || r.fullName || r.email);
}

// ── PDF text extraction via pdfjs-dist (worker served from /public) ───────────

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf      = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group text items by Y coordinate (±3 pt tolerance) to reconstruct lines
    const byY = new Map<number, { x: number; str: string }[]>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue;
      const rawY  = Math.round(item.transform[5] as number);
      const rawX  = Math.round(item.transform[4] as number);

      let bucket = rawY;
      for (const key of byY.keys()) {
        if (Math.abs(key - rawY) <= 3) { bucket = key; break; }
      }
      if (!byY.has(bucket)) byY.set(bucket, []);
      byY.get(bucket)!.push({ x: rawX, str: item.str as string });
    }

    // Sort buckets top → bottom, then items left → right within each line
    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      allLines.push(items.map(i => i.str).join('\t'));
    }
  }

  return allLines.join('\n');
}

// ── Master parser: dispatch by file extension ─────────────────────────────────

export async function parseFile(file: File): Promise<{
  headers: string[];
  rawRows: string[][];
  mapping: MappedField[];
}> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  let text: string;
  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    text = await extractPdfText(buffer);
  } else {
    text = await file.text();
  }

  const { headers, rawRows } = parseDelimitedText(text);
  return { headers, rawRows, mapping: autoMapHeaders(headers) };
}
