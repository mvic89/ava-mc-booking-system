// ─── Invoice store ────────────────────────────────────────────────────────────
// Pure localStorage backing store — no server required.

export interface Invoice {
  id:            string;   // INV-YYYY-NNN
  leadId:        string;   // URL param id of the originating lead
  customerName:  string;
  vehicle:       string;
  agreementRef:  string;   // AGR-YYYY-NNNN
  totalAmount:   number;   // kr incl. 25% VAT
  vatAmount:     number;   // kr
  netAmount:     number;   // kr excl. VAT
  paymentMethod: string;
  status:        'paid' | 'pending';
  issueDate:     string;   // ISO
  paidDate?:     string;   // ISO
}

const INVOICES_KEY = 'app_invoices';

// ── Seed data (shown on first load so the page is never empty) ─────────────────

export const INITIAL_INVOICES: Invoice[] = [
  {
    id:            'INV-2026-005',
    leadId:        'seed-5',
    customerName:  'Erik Holm',
    vehicle:       'Honda CB750 Hornet 2024',
    agreementRef:  'AGR-2024-0094',
    totalAmount:   89900,
    vatAmount:     17980,
    netAmount:     71920,
    paymentMethod: 'Klarna Finansiering',
    status:        'paid',
    issueDate:     '2026-03-05T14:22:00.000Z',
    paidDate:      '2026-03-05T14:22:00.000Z',
  },
  {
    id:            'INV-2026-004',
    leadId:        'seed-4',
    customerName:  'Sofia Lindqvist',
    vehicle:       'Yamaha MT-07 2024',
    agreementRef:  'AGR-2024-0093',
    totalAmount:   79900,
    vatAmount:     15980,
    netAmount:     63920,
    paymentMethod: 'Swish',
    status:        'paid',
    issueDate:     '2026-02-28T10:15:00.000Z',
    paidDate:      '2026-02-28T10:15:00.000Z',
  },
  {
    id:            'INV-2026-003',
    leadId:        'seed-3',
    customerName:  'Marcus Pettersson',
    vehicle:       'Kawasaki Ninja ZX-6R 2024',
    agreementRef:  'AGR-2024-0092',
    totalAmount:   133280,
    vatAmount:     26656,
    netAmount:     106624,
    paymentMethod: 'Svea Finansiering',
    status:        'paid',
    issueDate:     '2026-02-20T09:40:00.000Z',
    paidDate:      '2026-02-20T09:40:00.000Z',
  },
  {
    id:            'INV-2026-002',
    leadId:        'seed-2',
    customerName:  'Anna Bergström',
    vehicle:       'BMW R1250 GS Adventure 2024',
    agreementRef:  'AGR-2024-0091',
    totalAmount:   215000,
    vatAmount:     43000,
    netAmount:     172000,
    paymentMethod: 'Banköverföring',
    status:        'paid',
    issueDate:     '2026-02-10T13:55:00.000Z',
    paidDate:      '2026-02-12T08:00:00.000Z',
  },
  {
    id:            'INV-2026-001',
    leadId:        'seed-1',
    customerName:  'Johan Andersson',
    vehicle:       'Ducati Panigale V4 2024',
    agreementRef:  'AGR-2024-0090',
    totalAmount:   189000,
    vatAmount:     37800,
    netAmount:     151200,
    paymentMethod: '—',
    status:        'pending',
    issueDate:     '2026-03-06T11:30:00.000Z',
  },
];

// ── Read ───────────────────────────────────────────────────────────────────────

export function getInvoices(): Invoice[] {
  if (typeof window === 'undefined') return INITIAL_INVOICES;
  try {
    const stored = localStorage.getItem(INVOICES_KEY);
    if (stored) return JSON.parse(stored);
    // First run — seed initial data
    localStorage.setItem(INVOICES_KEY, JSON.stringify(INITIAL_INVOICES));
    return INITIAL_INVOICES;
  } catch {
    return INITIAL_INVOICES;
  }
}

// ── Invoice number generator ───────────────────────────────────────────────────

function nextId(list: Invoice[]): string {
  const year = new Date().getFullYear();
  const max  = list.reduce((m, inv) => {
    const parts = inv.id.split('-');
    const n     = parseInt(parts[parts.length - 1] || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `INV-${year}-${String(max + 1).padStart(3, '0')}`;
}

// ── Write ──────────────────────────────────────────────────────────────────────

export function createInvoice(
  data: Omit<Invoice, 'id' | 'issueDate'>,
): Invoice {
  const list = getInvoices();

  // Deduplicate — don't generate a second paid invoice for the same lead
  if (data.status === 'paid') {
    const existing = list.find(inv => inv.leadId === data.leadId && inv.status === 'paid');
    if (existing) return existing;
  }

  const inv: Invoice = {
    ...data,
    id:        nextId(list),
    issueDate: new Date().toISOString(),
  };

  localStorage.setItem(INVOICES_KEY, JSON.stringify([inv, ...list]));
  return inv;
}

export function markInvoicePaid(leadId: string, paymentMethod: string): void {
  const list = getInvoices();
  const idx  = list.findIndex(inv => inv.leadId === leadId && inv.status === 'pending');
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    status:        'paid',
    paidDate:      new Date().toISOString(),
    paymentMethod,
  };
  localStorage.setItem(INVOICES_KEY, JSON.stringify(list));
}
