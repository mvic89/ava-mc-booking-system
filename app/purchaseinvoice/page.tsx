'use client';

import { useState, useEffect } from 'react';
import { PurchaseInvoice, PurchaseInvoiceStatus } from '@/utils/types';
import { supabase } from '@/lib/supabase';
import { getDealershipId, getDealershipTag, getDealershipProfile } from '@/lib/tenant';
import { ImportInvoiceModal } from '@/components/ImportInvoiceModal';

// ── Download helpers ────────────────────────────────────────────────────────

function downloadInvoiceExcel(invoices: PurchaseInvoice[]) {
  import('xlsx').then((XLSX) => {
    const rows = invoices.map(inv => ({
      'System Ref #':        inv.id,
      'Supplier Invoice #':  inv.supplierInvoiceNumber || '',
      'PO #':                inv.poId || '',
      Vendor:                inv.vendor,
      'Invoice Date':        inv.invoiceDate,
      'Due Date':            inv.dueDate,
      'Amount (SEK)':        inv.amount,
      Status:                inv.status,
      Notes:                 inv.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `purchase_invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
  });
}

async function downloadInvoicePDF(invoices: PurchaseInvoice[]) {
  const { default: jsPDF }     = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const dealer = getDealershipProfile();

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const navy  = [30, 58, 95] as [number, number, number];

  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE INVOICES', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(147, 197, 253);
  doc.text(
    `${dealer.name || 'Procurement'} · ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('en-GB')}`,
    pageW - 14, 14, { align: 'right' },
  );

  const STATUS_COLORS: Record<PurchaseInvoiceStatus, [number, number, number]> = {
    Pending:  [180, 120, 0],
    Paid:     [21, 128, 61],
    Overdue:  [185, 28, 28],
    Disputed: [109, 40, 217],
  };

  autoTable(doc, {
    startY: 28,
    head: [['System Ref #', 'Supplier Inv #', 'PO #', 'Vendor', 'Invoice Date', 'Due Date', 'Amount (SEK)', 'Status', 'Notes']],
    body: invoices.map(inv => [
      inv.id,
      inv.supplierInvoiceNumber || '—',
      inv.poId || '—',
      inv.vendor,
      inv.invoiceDate,
      inv.dueDate,
      inv.amount.toLocaleString('sv-SE'),
      inv.status,
      inv.notes || '',
    ]),
    foot: [[
      '', '', '', '', '', 'Total',
      invoices.reduce((s, i) => s + i.amount, 0).toLocaleString('sv-SE'),
      '', '',
    ]],
    headStyles:  { fillColor: navy, fontSize: 7, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 7 },
    footStyles:  { fillColor: [240, 244, 250], textColor: navy, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 3: { cellWidth: 40 }, 7: { cellWidth: 18 }, 8: { cellWidth: 35 } },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index === 7 && data.cell.raw) {
        const status = data.cell.raw as PurchaseInvoiceStatus;
        const color  = STATUS_COLORS[status];
        if (color) {
          data.doc.setTextColor(...color);
          data.doc.setFontSize(6.5);
          data.doc.setFont('helvetica', 'bold');
          data.doc.text(String(status), data.cell.x + 2, data.cell.y + data.cell.height / 2 + 1);
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`purchase_invoices_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── Mock seed data tied to existing POs ────────────────────────────────────────
const SEED_INVOICES: PurchaseInvoice[] = [
  {
    id: 'PINV-2026-001',
    supplierInvoiceNumber: 'INV-YAM-2026-0314',
    poId: 'PO-2024-001',
    vendor: 'Yamaha Motor Malaysia Sdn Bhd',
    invoiceDate: '2026-02-05',
    dueDate: '2026-02-20',
    amount: 18600,
    status: 'Paid',
    notes: 'MT-07 batch — paid in full. No discrepancies.',
  },
  {
    id: 'PINV-2026-002',
    supplierInvoiceNumber: 'INV-MCH-2026-0089',
    poId: 'PO-2024-002',
    vendor: 'Michelin Tyre PLC Malaysia',
    invoiceDate: '2026-01-30',
    dueDate: '2026-02-14',
    amount: 1720,
    status: 'Disputed',
    notes: '2 units damaged on arrival. Credit note requested — awaiting supplier response.',
  },
  {
    id: 'PINV-2026-003',
    supplierInvoiceNumber: 'INV-ALP-2026-0047',
    poId: 'PO-2024-003',
    vendor: 'Alpinestars S.p.A.',
    invoiceDate: '2026-01-24',
    dueDate: '2026-02-24',
    amount: 3235,
    status: 'Paid',
    notes: 'Gloves and jackets — full payment processed.',
  },
  {
    id: 'PINV-2026-004',
    supplierInvoiceNumber: 'INV-HON-2026-0502',
    poId: 'PO-2024-004',
    vendor: 'Honda Motor Distributors Sdn Bhd',
    invoiceDate: '2026-02-12',
    dueDate: '2026-02-27',
    amount: 17000,
    status: 'Overdue',
    notes: 'CBR 600RR batch — invoice received but payment not processed. Escalate.',
  },
  {
    id: 'PINV-2026-005',
    supplierInvoiceNumber: 'INV-KAW-2026-0198',
    poId: 'PO-2024-005',
    vendor: 'Kawasaki Motors (M) Sdn Bhd',
    invoiceDate: '2026-02-14',
    dueDate: '2026-03-14',
    amount: 11200,
    status: 'Pending',
    notes: 'Versys 650 — awaiting goods delivery before payment.',
  },
  {
    id: 'PINV-2026-006',
    supplierInvoiceNumber: 'INV-NGK-2026-0033',
    poId: 'PO-2024-006',
    vendor: 'NGK Spark Plugs (Malaysia) Sdn Bhd',
    invoiceDate: '2026-02-16',
    dueDate: '2026-03-03',
    amount: 240,
    status: 'Pending',
    notes: 'Iridium spark plugs — invoice received, pending approval.',
  },
  {
    id: 'PINV-2026-007',
    supplierInvoiceNumber: 'INV-EBC-2026-0021',
    poId: 'PO-2024-007',
    vendor: 'EBC Brakes Distribution Asia',
    invoiceDate: '2026-02-19',
    dueDate: '2026-03-05',
    amount: 330,
    status: 'Overdue',
    notes: 'Brake pad set — payment missed. Follow up immediately.',
  },
];

const STATUS_STYLES: Record<PurchaseInvoiceStatus, { badge: string; row: string }> = {
  Pending:  { badge: 'bg-amber-100 text-amber-700 border border-amber-200',   row: '' },
  Paid:     { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', row: 'bg-emerald-50/30' },
  Overdue:  { badge: 'bg-red-100 text-red-700 border border-red-200',         row: 'bg-red-50/30' },
  Disputed: { badge: 'bg-purple-100 text-purple-700 border border-purple-200', row: 'bg-purple-50/20' },
};

function generateInvoiceId(existing: PurchaseInvoice[]): string {
  const year = new Date().getFullYear();
  const tag  = getDealershipTag();
  const nums = existing
    .map(i => parseInt(i.id.split('-').at(-1) ?? '0'))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `PINV-${tag}-${year}-${String(next).padStart(3, '0')}`;
}

const EMPTY_FORM = {
  supplierInvoiceNumber: '',
  poId: '',
  vendor: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  amount: '',
  status: 'Pending' as PurchaseInvoiceStatus,
  notes: '',
};

interface SupabasePO { id: string; vendor: string; total_cost: number }
interface SupabaseVendor { id: string; name: string }

export default function PurchaseInvoicePage() {
  const [invoices,      setInvoices]      = useState<PurchaseInvoice[]>([]);
  const [showModal,     setShowModal]     = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [showDownload,  setShowDownload]  = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<PurchaseInvoiceStatus | 'All'>('All');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [dealerPOs,  setDealerPOs]  = useState<SupabasePO[]>([]);
  const [vendors,    setVendors]    = useState<SupabaseVendor[]>([]);

  // ── Load from Supabase; scoped to this dealership ────────────────────────────
  useEffect(() => {
    async function load() {
      const dealershipId = getDealershipId();
      if (!dealershipId) return;

      const [invRes, poRes, vendorRes] = await Promise.all([
        supabase.from('purchase_invoices').select('*').eq('dealership_id', dealershipId).order('id', { ascending: false }),
        supabase.from('purchase_orders').select('id, vendor, total_cost').eq('dealership_id', dealershipId).order('id', { ascending: false }),
        supabase.from('vendors').select('id, name').eq('dealership_id', dealershipId).order('name'),
      ]);

      if (invRes.error) { console.error('Failed to load invoices:', invRes.error); }
      if (invRes.data && invRes.data.length > 0) {
        setInvoices(invRes.data.map(r => ({
          id:                     r.id,
          supplierInvoiceNumber:  r.supplier_invoice_number,
          poId:                   r.po_id ?? undefined,
          vendor:                 r.vendor,
          invoiceDate:            r.invoice_date,
          dueDate:                r.due_date,
          amount:                 Number(r.amount),
          status:                 r.status as PurchaseInvoiceStatus,
          notes:                  r.notes ?? undefined,
        })));
      }

      if (poRes.data) setDealerPOs(poRes.data as SupabasePO[]);
      if (vendorRes.data) setVendors(vendorRes.data as SupabaseVendor[]);
    }
    load();
  }, []);

  const handlePoChange = (poId: string) => {
    const po = dealerPOs.find(p => p.id === poId);
    setForm(f => ({
      ...f,
      poId,
      vendor: po ? po.vendor : f.vendor,
      amount: po ? String(po.total_cost) : f.amount,
    }));
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (inv: PurchaseInvoice) => {
    setForm({
      supplierInvoiceNumber: inv.supplierInvoiceNumber,
      poId: inv.poId ?? '',
      vendor: inv.vendor,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      amount: String(inv.amount),
      status: inv.status,
      notes: inv.notes ?? '',
    });
    setEditId(inv.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.vendor || !form.invoiceDate || !form.dueDate || !form.amount) return;
    if (editId) {
      const updated = { ...form, amount: parseFloat(form.amount) };
      setInvoices(prev => prev.map(i => i.id === editId ? { ...i, ...updated } : i));
      await supabase.from('purchase_invoices').update({
        supplier_invoice_number: form.supplierInvoiceNumber,
        po_id:        form.poId || null,
        vendor:       form.vendor,
        invoice_date: form.invoiceDate,
        due_date:     form.dueDate,
        amount:       parseFloat(form.amount),
        status:       form.status,
        notes:        form.notes || null,
      }).eq('id', editId);
    } else {
      const newInvoice: PurchaseInvoice = {
        id:                    generateInvoiceId(invoices),
        supplierInvoiceNumber: form.supplierInvoiceNumber,
        poId:                  form.poId || undefined,
        vendor:                form.vendor,
        invoiceDate:           form.invoiceDate,
        dueDate:               form.dueDate,
        amount:                parseFloat(form.amount),
        status:                form.status,
        notes:                 form.notes || undefined,
      };
      setInvoices(prev => [newInvoice, ...prev]);
      await supabase.from('purchase_invoices').insert({
        id:                      newInvoice.id,
        dealership_id:           getDealershipId(),
        supplier_invoice_number: newInvoice.supplierInvoiceNumber,
        po_id:                   newInvoice.poId ?? null,
        vendor:                  newInvoice.vendor,
        invoice_date:            newInvoice.invoiceDate,
        due_date:                newInvoice.dueDate,
        amount:                  newInvoice.amount,
        status:                  newInvoice.status,
        notes:                   newInvoice.notes ?? null,
      });
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    setInvoices(prev => prev.filter(i => i.id !== id));
    await supabase.from('purchase_invoices').delete().eq('id', id);
  };

  const statuses: PurchaseInvoiceStatus[] = ['Pending', 'Paid', 'Overdue', 'Disputed'];
  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    return (
      (inv.id.toLowerCase().includes(q) || inv.vendor.toLowerCase().includes(q) ||
        inv.supplierInvoiceNumber.toLowerCase().includes(q) || (inv.poId ?? '').toLowerCase().includes(q)) &&
      (filterStatus === 'All' || inv.status === filterStatus)
    );
  });
  const totalAmount = filtered.reduce((s, i) => s + i.amount, 0);

  // ── Alert banners ─────────────────────────────────────────────────────────────
  const today = new Date();
  const overdue = invoices.filter(i => i.status === 'Overdue');
  const dueThisWeek = invoices.filter(i => {
    if (i.status === 'Paid' || i.status === 'Overdue') return false;
    const due = new Date(i.dueDate);
    const diff = (due.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  const disputed = invoices.filter(i => i.status === 'Disputed');

  const alerts = [
    overdue.length > 0 && {
      color: 'bg-red-50 border-red-200 text-red-700',
      icon: '🚨',
      title: `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} overdue`,
      body: `${overdue.map(i => i.vendor.split(' ')[0]).join(', ')} — total ${overdue.reduce((a, i) => a + i.amount, 0).toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}. Action required immediately.`,
    },
    dueThisWeek.length > 0 && {
      color: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: '⏰',
      title: `${dueThisWeek.length} invoice${dueThisWeek.length > 1 ? 's' : ''} due within 7 days`,
      body: `${dueThisWeek.map(i => i.vendor.split(' ')[0]).join(', ')} — total ${dueThisWeek.reduce((a, i) => a + i.amount, 0).toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}. Schedule payment soon.`,
    },
    disputed.length > 0 && {
      color: 'bg-purple-50 border-purple-200 text-purple-800',
      icon: '⚠️',
      title: `${disputed.length} invoice${disputed.length > 1 ? 's' : ''} under dispute`,
      body: `${disputed.map(i => i.vendor.split(' ')[0]).join(', ')} — awaiting supplier resolution. Do not pay until resolved.`,
    },
  ].filter(Boolean) as { color: string; icon: string; title: string; body: string }[];

  return (
    <div className="lg:ml-64 min-h-screen flex flex-col bg-white">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
        <span className="text-sm text-gray-500 font-medium">Purchase Invoices</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search PO, vendor, invoice #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 w-60"
          />
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 overflow-auto p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Invoices</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track and manage invoices received from suppliers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            ⬆ Import Excel
          </button>

          {/* Download dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDownload(v => !v)}
              className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              ⬇ Download
              <span className="text-gray-400 text-xs">▾</span>
            </button>
            {showDownload && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDownload(false)} />
                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-48 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} (current view)
                    </p>
                  </div>
                  <button
                    onClick={() => { downloadInvoiceExcel(filtered); setShowDownload(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                  >
                    <span className="text-base">📊</span>
                    <div className="text-left">
                      <div className="font-semibold text-xs">Excel (.xlsx)</div>
                      <div className="text-[10px] text-gray-400">Spreadsheet format</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { downloadInvoicePDF(filtered); setShowDownload(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                  >
                    <span className="text-base">📄</span>
                    <div className="text-left">
                      <div className="font-semibold text-xs">PDF</div>
                      <div className="text-[10px] text-gray-400">Print-ready format</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            + Create New Invoice
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${a.color}`}>
              <span className="text-lg shrink-0 mt-0.5">{a.icon}</span>
              <div>
                <p className="text-sm font-bold">{a.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {([
          { label: 'Pending',  color: 'border-l-amber-400',   icon: '🕐' },
          { label: 'Paid',     color: 'border-l-emerald-400', icon: '✅' },
          { label: 'Overdue',  color: 'border-l-red-400',     icon: '🚨' },
          { label: 'Disputed', color: 'border-l-purple-400',  icon: '⚠️' },
        ] as { label: PurchaseInvoiceStatus; color: string; icon: string }[]).map(({ label, color, icon }) => {
          const count = invoices.filter(i => i.status === label).length;
          const total = invoices.filter(i => i.status === label).reduce((a, i) => a + i.amount, 0);
          return (
            <div key={label} className={`bg-white border border-gray-200 border-l-4 ${color} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                <span>{icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {total.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
        {(['All', ...statuses] as const).map(s => {
          const count = s === 'All' ? invoices.length : invoices.filter(i => i.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === s
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                filterStatus === s ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <span className="text-5xl">🧾</span>
              <div className="text-center">
                <p className="text-gray-700 font-semibold">No purchase invoices yet</p>
                <p className="text-gray-400 text-sm mt-1">Import from Excel or create an invoice manually</p>
              </div>
              <button
                onClick={() => setShowImport(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
              >
                ⬆ Import from Excel
              </button>
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-gray-500 text-sm font-medium">No invoices match your filter</p>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">System Ref #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Supplier Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">PO #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Invoice Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className={`hover:bg-orange-50/40 transition-colors cursor-pointer ${STATUS_STYLES[inv.status].row}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#FF6B2C] whitespace-nowrap">{inv.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{inv.supplierInvoiceNumber || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{inv.poId || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-800 font-medium max-w-45 truncate">{inv.vendor}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{inv.invoiceDate}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={inv.status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                        {inv.dueDate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-900 font-semibold whitespace-nowrap">
                      {inv.amount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${STATUS_STYLES[inv.status].badge}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(inv)} title="Edit" className="text-gray-400 hover:text-[#FF6B2C] transition-colors text-xs">✏️</button>
                        <button onClick={() => handleDelete(inv.id)} title="Delete" className="text-gray-400 hover:text-red-500 transition-colors text-xs">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={6} className="px-4 py-3 text-xs text-gray-500 font-semibold">
                    Total ({filtered.length} invoice{filtered.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-bold text-sm whitespace-nowrap">
                    {totalAmount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {editId ? `Edit — ${editId}` : 'Create New Invoice'}
                </h2>
                {!editId && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    System Ref # will be: <span className="text-[#FF6B2C] font-mono font-semibold">{generateInvoiceId(invoices)}</span>
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none">✕</button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Link to Purchase Order (optional)</label>
                <select
                  value={form.poId}
                  onChange={e => handlePoChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#FF6B2C]"
                >
                  <option value="">— No PO linked —</option>
                  {dealerPOs.map(po => (
                    <option key={po.id} value={po.id}>{po.id} — {po.vendor}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Selecting a PO auto-fills vendor and amount</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Supplier Invoice # <span className="text-gray-400 font-normal">(from received invoice document)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-YAM-2026-0042"
                  value={form.supplierInvoiceNumber}
                  onChange={e => setForm(f => ({ ...f, supplierInvoiceNumber: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#FF6B2C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor <span className="text-red-500">*</span></label>
                {vendors.length > 0 ? (
                  <select
                    value={form.vendor}
                    onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#FF6B2C]"
                  >
                    <option value="">— Select vendor —</option>
                    {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Supplier / vendor name"
                    value={form.vendor}
                    onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#FF6B2C]"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#FF6B2C]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#FF6B2C]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (SEK) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#FF6B2C]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PurchaseInvoiceStatus }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#FF6B2C]">
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
                <textarea rows={2} placeholder="Optional notes…" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#FF6B2C] resize-none" />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleSave}
                disabled={!form.vendor || !form.invoiceDate || !form.dueDate || !form.amount}
                className="px-5 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm">
                {editId ? 'Save Changes' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Import Invoice modal */}
      {showImport && (
        <ImportInvoiceModal
          existingInvoices={invoices}
          onImported={(newInvoices) => {
            setInvoices((prev) => [...newInvoices, ...prev])
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Invoice detail modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                  Purchase Invoice · <span className="font-mono">{selectedInvoice.id}</span>
                </p>
                <h2 className="text-lg font-bold text-gray-900">{selectedInvoice.vendor}</h2>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLES[selectedInvoice.status].badge}`}>
                  {selectedInvoice.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 text-sm font-bold shrink-0"
              >✕</button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="System Ref #" value={selectedInvoice.id} mono />
                <DetailField label="Supplier Invoice #" value={selectedInvoice.supplierInvoiceNumber || '—'} mono />
                <DetailField label="Linked PO #" value={selectedInvoice.poId || '—'} />
                <DetailField label="Vendor" value={selectedInvoice.vendor} />
                <DetailField label="Invoice Date" value={selectedInvoice.invoiceDate} />
                <DetailField label="Due Date" value={selectedInvoice.dueDate} />
              </div>
              <div className="bg-orange-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</p>
                <p className="text-xl font-bold text-gray-900">
                  {selectedInvoice.amount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                </p>
              </div>
              {selectedInvoice.notes && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setSelectedInvoice(null); openEdit(selectedInvoice); }}
                className="px-4 py-2 text-sm font-semibold text-[#FF6B2C] border border-[#FF6B2C]/30 hover:bg-orange-50 rounded-lg transition-colors"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}