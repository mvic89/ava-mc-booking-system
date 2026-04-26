'use client';

import { useState, useEffect, useRef } from 'react';
import { PurchaseInvoice, PurchaseInvoiceStatus, CreditNote, CreditNoteStatus } from '@/utils/types';
import { supabase } from '@/lib/supabase';
import { getDealershipId, getDealershipProfile, tagFromName } from '@/lib/tenant';
import { ImportInvoiceModal } from '@/components/ImportInvoiceModal';
import Sidebar from '@/components/Sidebar';

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
    Pending:             [180, 120, 0],
    'Awaiting Approval': [37, 99, 235],
    Paid:                [21, 128, 61],
    Overdue:             [185, 28, 28],
    Disputed:            [109, 40, 217],
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


const STATUS_STYLES: Record<PurchaseInvoiceStatus, { badge: string; row: string }> = {
  Pending:            { badge: 'bg-amber-100 text-amber-700 border border-amber-200',       row: '' },
  'Awaiting Approval':{ badge: 'bg-blue-100 text-blue-700 border border-blue-200',          row: 'bg-blue-50/20' },
  Paid:               { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', row: 'bg-emerald-50/30' },
  Overdue:            { badge: 'bg-red-100 text-red-700 border border-red-200',             row: 'bg-red-50/30' },
  Disputed:           { badge: 'bg-purple-100 text-purple-700 border border-purple-200',    row: 'bg-purple-50/20' },
};

function generateInvoiceId(existing: PurchaseInvoice[], tag: string): string {
  const year = new Date().getFullYear();
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

interface InvoiceItem {
  id:               number
  article_number:   string | null
  description:      string
  qty:              number
  gross_unit_price: number | null
  discount_pct:     number | null
  discount_amount:  number | null
  unit_price:       number
  line_total:       number
  vin:              string | null
}

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
  const [invoiceItems,    setInvoiceItems]    = useState<InvoiceItem[]>([]);
  const [itemsLoading,    setItemsLoading]    = useState(false);
  const [dealerPOs,  setDealerPOs]  = useState<SupabasePO[]>([]);
  const [vendors,    setVendors]    = useState<SupabaseVendor[]>([]);
  const [dealerTag,  setDealerTag]  = useState<string>('');

  // bulk selection
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  // dispute reason capture
  const [disputeInvoice, setDisputeInvoice] = useState<PurchaseInvoice | null>(null);
  const [disputeReason,  setDisputeReason]  = useState('');
  // vendor spend panel
  const [showSpend, setShowSpend] = useState(false);
  // filters
  const [filterVendor,   setFilterVendor]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  // credit notes
  const [creditNotes,    setCreditNotes]    = useState<CreditNote[]>([]);
  const [viewMode,       setViewMode]       = useState<'invoices' | 'creditnotes'>('invoices');
  const [applyCredit,    setApplyCredit]    = useState<{ invoice: PurchaseInvoice; credits: CreditNote[] } | null>(null);
  const [applyCreditId,  setApplyCreditId]  = useState('');
  const [applyAmount,    setApplyAmount]    = useState('');
  // manual credit note
  const [showCNForm,  setShowCNForm]  = useState(false);
  const [cnForm,      setCnForm]      = useState({ vendor: '', supplierCreditNumber: '', originalInvoiceId: '', creditDate: new Date().toISOString().split('T')[0], amount: '', reason: '' });

  // ── Load from Supabase; scoped to this dealership ────────────────────────────
  useEffect(() => {
    async function load() {
      const dealershipId = getDealershipId();
      if (!dealershipId) return;

      const [invRes, poRes, vendorRes, cnRes, dealerRes] = await Promise.all([
        supabase.from('purchase_invoices').select('*').eq('dealership_id', dealershipId).order('id', { ascending: false }),
        supabase.from('purchase_orders').select('id, vendor, total_cost').eq('dealership_id', dealershipId).order('id', { ascending: false }),
        supabase.from('vendors').select('id, name').eq('dealership_id', dealershipId).order('name'),
        supabase.from('purchase_credit_notes').select('*').eq('dealership_id', dealershipId).order('created_at', { ascending: false }),
        supabase.from('dealerships').select('name').eq('id', dealershipId).single(),
      ]);

      if (invRes.error) { console.error('Failed to load invoices:', invRes.error); }
      if (invRes.data && invRes.data.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0]
        setInvoices(invRes.data.map(r => {
          let status = r.status as PurchaseInvoiceStatus
          // Recalculate overdue status unless already Paid or Disputed
          if (status !== 'Paid' && status !== 'Disputed' && r.due_date && r.due_date < todayStr) {
            status = 'Overdue'
          }
          return {
            id:                     r.id,
            supplierInvoiceNumber:  r.supplier_invoice_number,
            poId:                   r.po_id ?? undefined,
            vendor:                 r.vendor,
            invoiceDate:            r.invoice_date,
            dueDate:                r.due_date,
            amount:                 Number(r.amount),
            creditedAmount:         Number(r.credited_amount ?? 0),
            status,
            notes:                  r.notes ?? undefined,
            pdfUrl:                 r.pdf_url ?? undefined,
            poFullyReceived:        r.po_fully_received ?? false,
          }
        }));
      }

      if (poRes.data) setDealerPOs(poRes.data as SupabasePO[]);
      if (vendorRes.data) setVendors(vendorRes.data as SupabaseVendor[]);
      if (dealerRes.data?.name) setDealerTag(tagFromName(dealerRes.data.name));
      if (cnRes.data) {
        setCreditNotes(cnRes.data.map(r => ({
          id:                    r.id,
          supplierCreditNumber:  r.supplier_credit_number,
          originalInvoiceId:     r.original_invoice_id,
          vendor:                r.vendor,
          creditDate:            r.credit_date,
          amount:                Number(r.amount),
          remainingAmount:       Number(r.remaining_amount),
          status:                r.status as CreditNoteStatus,
          reason:                r.reason,
          pdfUrl:                r.pdf_url,
          notes:                 r.notes,
        })));
      }
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

  const openDetail = async (inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    setInvoiceItems([]);
    setItemsLoading(true);
    const { data, error } = await supabase
      .from('purchase_invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)
      .order('id');
    console.log('[purchaseinvoice] loading items for', inv.id, '→ count:', data?.length, 'error:', error?.message)
    setInvoiceItems((data as InvoiceItem[]) ?? []);
    setItemsLoading(false);
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
      // Recalculate status when due date changes — don't override Paid or Disputed manually set
      const todayStr = new Date().toISOString().split('T')[0]
      let resolvedStatus = form.status as PurchaseInvoiceStatus
      if (resolvedStatus !== 'Paid' && resolvedStatus !== 'Disputed') {
        resolvedStatus = form.dueDate < todayStr ? 'Overdue' : 'Pending'
      }
      const updated = { ...form, amount: parseFloat(form.amount), status: resolvedStatus };
      setInvoices(prev => prev.map(i => i.id === editId ? { ...i, ...updated } : i));
      await supabase.from('purchase_invoices').update({
        supplier_invoice_number: form.supplierInvoiceNumber,
        po_id:        form.poId || null,
        vendor:       form.vendor,
        invoice_date: form.invoiceDate,
        due_date:     form.dueDate,
        amount:       parseFloat(form.amount),
        status:       resolvedStatus,
        notes:        form.notes || null,
      }).eq('id', editId);
    } else {
      const newInvoice: PurchaseInvoice = {
        id:                    generateInvoiceId(invoices, dealerTag),
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

  // ── Quick status actions ──────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: PurchaseInvoiceStatus, notes?: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status, notes: notes ?? i.notes } : i));
    setSelectedInvoice(prev => prev?.id === id ? { ...prev, status, notes: notes ?? prev.notes } : prev);
    await supabase.from('purchase_invoices').update({
      status,
      ...(notes !== undefined ? { notes } : {}),
    }).eq('id', id);
  };

  const handleApprove = (inv: PurchaseInvoice) => updateStatus(inv.id, 'Pending');

  const handleSendForApproval = async (inv: PurchaseInvoice) => {
    await updateStatus(inv.id, 'Awaiting Approval');
    // fire-and-forget email — don't block the UI
    fetch('/api/purchase-invoice/notify-approval', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        dealership_id:           getDealershipId(),
        invoice_id:              inv.id,
        vendor:                  inv.vendor,
        amount:                  inv.amount,
        due_date:                inv.dueDate,
        supplier_invoice_number: inv.supplierInvoiceNumber,
      }),
    }).catch(e => console.warn('[approval] notify failed:', e));
  };

  const handleMarkPaid = (inv: PurchaseInvoice) => updateStatus(inv.id, 'Paid');

  const handleSubmitDispute = async () => {
    if (!disputeInvoice || !disputeReason.trim()) return;
    const newNotes = disputeReason.trim() + (disputeInvoice.notes ? `\n\nPrevious notes: ${disputeInvoice.notes}` : '');
    await updateStatus(disputeInvoice.id, 'Disputed', newNotes);
    setDisputeInvoice(null);
    setDisputeReason('');
  };

  // ── Apply credit note ─────────────────────────────────────────────────────────
  const openApplyCredit = (inv: PurchaseInvoice) => {
    const available = creditNotes.filter(c =>
      c.vendor === inv.vendor && c.remainingAmount > 0 && c.status !== 'Applied'
    );
    if (available.length === 0) return;
    setApplyCredit({ invoice: inv, credits: available });
    setApplyCreditId(available[0].id);
    setApplyAmount('');
  };

  const handleConfirmApplyCredit = async () => {
    if (!applyCredit || !applyCreditId) return;
    const credit  = applyCredit.credits.find(c => c.id === applyCreditId);
    const invoice = applyCredit.invoice;
    if (!credit) return;

    const netPayable   = invoice.amount - (invoice.creditedAmount ?? 0);
    const requestedAmt = parseFloat(applyAmount) || credit.remainingAmount;
    const toApply      = Math.min(requestedAmt, credit.remainingAmount, netPayable);
    if (toApply <= 0) return;

    const newRemaining    = credit.remainingAmount - toApply;
    const newCredited     = (invoice.creditedAmount ?? 0) + toApply;
    const newNetPayable   = invoice.amount - newCredited;
    const newCreditStatus: CreditNoteStatus = newRemaining <= 0 ? 'Applied' : 'Partially Applied';
    const newInvoiceStatus: PurchaseInvoiceStatus = newNetPayable <= 0 ? 'Paid' : invoice.status;

    // Update credit note
    await supabase.from('purchase_credit_notes').update({
      remaining_amount: newRemaining,
      status:           newCreditStatus,
    }).eq('id', credit.id);

    // Update invoice
    await supabase.from('purchase_invoices').update({
      credited_amount: newCredited,
      status:          newInvoiceStatus,
    }).eq('id', invoice.id);

    // Update local state
    setCreditNotes(prev => prev.map(c =>
      c.id === credit.id ? { ...c, remainingAmount: newRemaining, status: newCreditStatus } : c
    ));
    setInvoices(prev => prev.map(i =>
      i.id === invoice.id ? { ...i, creditedAmount: newCredited, status: newInvoiceStatus } : i
    ));
    setSelectedInvoice(prev =>
      prev?.id === invoice.id ? { ...prev, creditedAmount: newCredited, status: newInvoiceStatus } : prev
    );
    setApplyCredit(null);
  };

  // ── Manual credit note save ───────────────────────────────────────────────────
  const handleSaveCreditNote = async () => {
    if (!cnForm.vendor || !cnForm.creditDate || !cnForm.amount) return;
    const year = new Date().getFullYear();
    const newId = `CN-${dealerTag}-${year}-${String(creditNotes.length + 1).padStart(3, '0')}`;
    const amt   = parseFloat(cnForm.amount);
    const matchedInvoice = cnForm.originalInvoiceId
      ? invoices.find(i => i.id === cnForm.originalInvoiceId) ?? null
      : null;
    const status: CreditNoteStatus = matchedInvoice ? 'Pending' : 'Unmatched';

    await supabase.from('purchase_credit_notes').insert({
      id:                     newId,
      dealership_id:          getDealershipId(),
      supplier_credit_number: cnForm.supplierCreditNumber || null,
      original_invoice_id:    cnForm.originalInvoiceId || null,
      vendor:                 cnForm.vendor,
      credit_date:            cnForm.creditDate,
      amount:                 amt,
      remaining_amount:       amt,
      status,
      reason:                 cnForm.reason || null,
      notes:                  'Manually entered.',
    });

    setCreditNotes(prev => [{
      id:                   newId,
      supplierCreditNumber: cnForm.supplierCreditNumber || null,
      originalInvoiceId:    cnForm.originalInvoiceId || null,
      vendor:               cnForm.vendor,
      creditDate:           cnForm.creditDate,
      amount:               amt,
      remainingAmount:      amt,
      status,
      reason:               cnForm.reason || null,
      pdfUrl:               null,
      notes:                'Manually entered.',
    }, ...prev]);

    setShowCNForm(false);
    setCnForm({ vendor: '', supplierCreditNumber: '', originalInvoiceId: '', creditDate: new Date().toISOString().split('T')[0], amount: '', reason: '' });
  };

  // ── Link unmatched credit note to an invoice ──────────────────────────────────
  const handleMatchCreditNote = async (creditId: string, invoiceId: string) => {
    await supabase.from('purchase_credit_notes').update({
      original_invoice_id: invoiceId,
      status:              'Pending',
    }).eq('id', creditId);
    setCreditNotes(prev => prev.map(c =>
      c.id === creditId ? { ...c, originalInvoiceId: invoiceId, status: 'Pending' } : c
    ));
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };
  const handleBulkMarkPaid = async () => {
    if (!confirm(`Mark ${selectedIds.size} invoice(s) as Paid?`)) return;
    for (const id of selectedIds) await updateStatus(id, 'Paid');
    setSelectedIds(new Set());
  };
  const handleBulkExport = () => {
    const selected = invoices.filter(i => selectedIds.has(i.id));
    downloadInvoiceExcel(selected);
  };

  const statuses: PurchaseInvoiceStatus[] = ['Pending', 'Awaiting Approval', 'Paid', 'Overdue', 'Disputed'];
  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    if (!(inv.id.toLowerCase().includes(q) || inv.vendor.toLowerCase().includes(q) ||
      inv.supplierInvoiceNumber.toLowerCase().includes(q) || (inv.poId ?? '').toLowerCase().includes(q))) return false;
    if (filterStatus !== 'All' && inv.status !== filterStatus) return false;
    if (filterVendor && inv.vendor !== filterVendor) return false;
    if (filterDateFrom && inv.invoiceDate < filterDateFrom) return false;
    if (filterDateTo   && inv.invoiceDate > filterDateTo)   return false;
    return true;
  });
  const hasActiveFilters = filterVendor || filterDateFrom || filterDateTo;
  const totalAmount = filtered.reduce((s, i) => s + i.amount, 0);

  // ── Aging buckets (overdue only) ──────────────────────────────────────────────
  const today = new Date();
  const agingBuckets = {
    '1–30 days':  invoices.filter(i => { if (i.status !== 'Overdue') return false; const d = (today.getTime() - new Date(i.dueDate).getTime()) / 86400000; return d >= 1  && d <= 30 }),
    '31–60 days': invoices.filter(i => { if (i.status !== 'Overdue') return false; const d = (today.getTime() - new Date(i.dueDate).getTime()) / 86400000; return d >= 31 && d <= 60 }),
    '61+ days':   invoices.filter(i => { if (i.status !== 'Overdue') return false; const d = (today.getTime() - new Date(i.dueDate).getTime()) / 86400000; return d > 60 }),
  };

  // ── Vendor spend summary ──────────────────────────────────────────────────────
  const vendorSpend = Object.entries(
    invoices.reduce((acc, inv) => {
      acc[inv.vendor] = (acc[inv.vendor] ?? 0) + inv.amount;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  // ── Alert banners ─────────────────────────────────────────────────────────────
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
    <div className="flex min-h-screen bg-[#f5f7fa]">
    <Sidebar />
    <div className="lg:ml-64 min-h-screen flex flex-col bg-white w-full">

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
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
            <button
              onClick={() => setViewMode('invoices')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'invoices' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Invoices
            </button>
            <button
              onClick={() => setViewMode('creditnotes')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'creditnotes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Credit Notes
              {creditNotes.filter(c => c.status !== 'Applied').length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {creditNotes.filter(c => c.status !== 'Applied').length}
                </span>
              )}
            </button>
          </div>

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

          {viewMode === 'creditnotes' ? (
            <button
              onClick={() => setShowCNForm(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              + Add Credit Note
            </button>
          ) : (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              + Create New Invoice
            </button>
          )}
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        {([
          { label: 'Pending',            color: 'border-l-amber-400',   icon: '🕐' },
          { label: 'Awaiting Approval',  color: 'border-l-blue-400',    icon: '👁️' },
          { label: 'Paid',               color: 'border-l-emerald-400', icon: '✅' },
          { label: 'Overdue',            color: 'border-l-red-400',     icon: '🚨' },
          { label: 'Disputed',           color: 'border-l-purple-400',  icon: '⚠️' },
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

      {/* Aging report — only shown when there are overdue invoices */}
      {invoices.some(i => i.status === 'Overdue') && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-5">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Overdue Aging Report</p>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(agingBuckets) as [string, PurchaseInvoice[]][]).map(([label, items]) => (
              <div key={label} className={`rounded-xl px-4 py-3 border ${items.length > 0 ? 'bg-white border-red-200' : 'bg-white/50 border-red-100'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">{label}</p>
                <p className={`text-xl font-bold ${items.length > 0 ? 'text-red-700' : 'text-gray-300'}`}>{items.length}</p>
                {items.length > 0 && (
                  <p className="text-xs text-red-500 mt-0.5 font-semibold">
                    {items.reduce((s, i) => s + i.amount, 0).toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor spend summary (collapsible) */}
      {vendorSpend.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl mb-5 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowSpend(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
          >
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Spend by Supplier</p>
            <span className="text-gray-400 text-xs">{showSpend ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showSpend && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {vendorSpend.map(([vendor, amount]) => {
                const pct = Math.round((amount / invoices.reduce((s, i) => s + i.amount, 0)) * 100);
                return (
                  <div key={vendor} className="flex items-center gap-3 px-5 py-2.5">
                    <p className="text-xs text-gray-700 font-medium w-52 truncate shrink-0">{vendor}</p>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs font-bold text-gray-800 whitespace-nowrap w-28 text-right">
                      {amount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                    </p>
                    <p className="text-[10px] text-gray-400 w-8 text-right">{pct}%</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Credit Notes view ─────────────────────────────────────────────────── */}
      {viewMode === 'creditnotes' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {creditNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <span className="text-4xl">🧾</span>
              <p className="text-gray-500 text-sm font-medium">No credit notes received yet</p>
              <p className="text-gray-400 text-xs">Credit notes arrive automatically when suppliers send them by email</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">System Ref #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier Credit #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Linked Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Credit Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Credit Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">Remaining</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {creditNotes.map(cn => {
                    const statusStyle: Record<CreditNoteStatus, string> = {
                      'Unmatched':         'bg-red-100 text-red-700 border border-red-200',
                      'Pending':           'bg-amber-100 text-amber-700 border border-amber-200',
                      'Partially Applied': 'bg-blue-100 text-blue-700 border border-blue-200',
                      'Applied':           'bg-emerald-100 text-emerald-700 border border-emerald-200',
                    };
                    return (
                      <tr key={cn.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-600 whitespace-nowrap">{cn.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{cn.supplierCreditNumber || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-800 font-medium max-w-40 truncate">{cn.vendor}</td>
                        <td className="px-4 py-3">
                          {cn.originalInvoiceId ? (
                            <span className="font-mono text-xs text-[#FF6B2C] font-bold">{cn.originalInvoiceId}</span>
                          ) : (
                            <select
                              defaultValue=""
                              onChange={e => e.target.value && handleMatchCreditNote(cn.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              className="text-xs border border-red-200 rounded-lg px-2 py-1 bg-red-50 text-red-700 focus:outline-none focus:border-red-400"
                            >
                              <option value="">— Match to invoice —</option>
                              {invoices.filter(i => i.vendor === cn.vendor).map(i => (
                                <option key={i.id} value={i.id}>{i.id}</option>
                              ))}
                              {invoices.filter(i => i.vendor !== cn.vendor).length > 0 && (
                                <>
                                  <option disabled>── Other vendors ──</option>
                                  {invoices.filter(i => i.vendor !== cn.vendor).map(i => (
                                    <option key={i.id} value={i.id}>{i.id} — {i.vendor}</option>
                                  ))}
                                </>
                              )}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{cn.creditDate}</td>
                        <td className="px-4 py-3 text-xs text-right font-semibold text-gray-700">
                          − {cn.amount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                        </td>
                        <td className="px-4 py-3 text-xs text-right font-bold text-emerald-700">
                          {cn.remainingAmount > 0
                            ? `− ${cn.remainingAmount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${statusStyle[cn.status]}`}>
                            {cn.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-48 truncate">{cn.reason || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={6} className="px-4 py-3 text-xs text-gray-500 font-semibold">
                      Total credit available
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 text-sm">
                      − {creditNotes.filter(c => c.status !== 'Applied').reduce((s, c) => s + c.remainingAmount, 0).toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {viewMode === 'invoices' && <>

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

      {/* Filter bar */}
      <div className={`flex flex-wrap items-center gap-2 mb-4 px-4 py-3 rounded-2xl border transition-colors ${hasActiveFilters ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
        {/* Filter icon label */}
        <div className="flex items-center gap-1.5 mr-1">
          <svg className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-orange-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h18M6 8h12M10 12h4" />
          </svg>
          <span className={`text-xs font-bold uppercase tracking-wider ${hasActiveFilters ? 'text-orange-600' : 'text-gray-400'}`}>Filter</span>
        </div>

        <div className="w-px h-5 bg-gray-300" />

        {/* Vendor filter combobox */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">Vendor</span>
          <FilterVendorComboBox
            value={filterVendor}
            vendorNames={Array.from(new Set(invoices.map(i => i.vendor))).sort()}
            onChange={setFilterVendor}
          />
        </div>

        <div className="w-px h-5 bg-gray-300" />

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">Invoice Date</span>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="text-xs text-gray-700 bg-transparent focus:outline-none w-28"
            />
            <span className="text-gray-300 text-xs font-bold">→</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="text-xs text-gray-700 bg-transparent focus:outline-none w-28"
            />
          </div>
        </div>

        {/* Active filter badges + clear */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-5 bg-orange-200 ml-1" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterVendor && (
                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {filterVendor.split(' ')[0]}
                  <button onClick={() => setFilterVendor('')} className="hover:text-orange-900 font-bold leading-none">✕</button>
                </span>
              )}
              {(filterDateFrom || filterDateTo) && (
                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {filterDateFrom || '…'} → {filterDateTo || '…'}
                  <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }} className="hover:text-orange-900 font-bold leading-none">✕</button>
                </span>
              )}
              <span className="text-xs text-orange-600 font-semibold">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => { setFilterVendor(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                className="text-xs text-gray-400 hover:text-red-500 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors ml-1"
              >
                Clear all
              </button>
            </div>
          </>
        )}
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
                  <th className="px-3 py-3 w-8" onClick={e => { e.stopPropagation(); toggleSelectAll(); }}>
                    <input type="checkbox" readOnly
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      className="rounded border-gray-300 text-orange-500 cursor-pointer"
                    />
                  </th>
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
                    onClick={() => openDetail(inv)}
                    className={`hover:bg-orange-50/40 transition-colors cursor-pointer ${STATUS_STYLES[inv.status].row} ${selectedIds.has(inv.id) ? 'bg-orange-50/60' : ''}`}
                  >
                    <td className="px-3 py-3 w-8" onClick={e => { e.stopPropagation(); toggleSelect(inv.id); }}>
                      <input type="checkbox" readOnly checked={selectedIds.has(inv.id)}
                        className="rounded border-gray-300 text-orange-500 cursor-pointer" />
                    </td>
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
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {(inv.creditedAmount ?? 0) > 0 ? (
                        <div>
                          <p className="text-gray-400 line-through text-[10px]">
                            {inv.amount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                          </p>
                          <p className="text-emerald-700 font-bold">
                            {(inv.amount - (inv.creditedAmount ?? 0)).toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-900 font-semibold">
                          {inv.amount.toLocaleString('sv-SE', { style: 'currency', currency: 'SEK' })}
                        </p>
                      )}
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
                    System Ref # will be: <span className="text-[#FF6B2C] font-mono font-semibold">{generateInvoiceId(invoices, dealerTag)}</span>
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
                <VendorComboBox
                  value={form.vendor}
                  vendors={vendors}
                  onChange={v => setForm(f => ({ ...f, vendor: v }))}
                  focusColor="focus:border-[#FF6B2C]"
                />
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

      </>} {/* end viewMode === 'invoices' */}
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-gray-700">
          <span className="text-sm font-semibold">{selectedIds.size} selected</span>
          <div className="w-px h-4 bg-gray-600" />
          <button onClick={handleBulkMarkPaid}
            className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
            ✅ Mark as Paid
          </button>
          <button onClick={handleBulkExport}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            ⬇ Export
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-400 hover:text-white transition-colors ml-1">
            ✕
          </button>
        </div>
      )}

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

      {/* Invoice detail side panel */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-2xl bg-white shadow-2xl flex flex-col rounded-2xl max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                  Purchase Invoice · <span className="font-mono">{selectedInvoice.id}</span>
                </p>
                <h2 className="text-lg font-bold text-gray-900">{selectedInvoice.vendor}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLES[selectedInvoice.status].badge}`}>
                    {selectedInvoice.status}
                  </span>
                  {selectedInvoice.poFullyReceived && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                      PO Fully Received
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 text-sm font-bold shrink-0"
              >✕</button>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
              {[
                { label: 'Invoice Date', value: selectedInvoice.invoiceDate },
                { label: 'Due Date',     value: selectedInvoice.dueDate },
                { label: 'Linked PO',   value: selectedInvoice.poId || '—' },
                { label: 'Supplier Inv #', value: selectedInvoice.supplierInvoiceNumber || '—' },
              ].map(c => (
                <div key={c.label} className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{c.label}</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 font-mono">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Vendor credit note notification banner */}
            {(() => {
              const vendorCredits = creditNotes.filter(c =>
                c.vendor === selectedInvoice.vendor && c.remainingAmount > 0 && c.status !== 'Applied'
              );
              if (vendorCredits.length === 0) return null;
              const totalCredit = vendorCredits.reduce((s, c) => s + c.remainingAmount, 0);
              return (
                <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-emerald-800">
                      Credit available from {selectedInvoice.vendor.split(' ')[0]}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {vendorCredits.length} credit note{vendorCredits.length > 1 ? 's' : ''} · SEK {totalCredit.toLocaleString('sv-SE')} available. Apply to reduce what you owe on this invoice.
                    </p>
                  </div>
                  {selectedInvoice.status !== 'Paid' && (
                    <button
                      onClick={() => openApplyCredit(selectedInvoice)}
                      className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      Apply Credit
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Credit applied summary */}
            {(selectedInvoice.creditedAmount ?? 0) > 0 && (
              <div className="mx-6 mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs text-blue-700">
                  <span className="font-bold">Credit applied:</span> − SEK {(selectedInvoice.creditedAmount ?? 0).toLocaleString('sv-SE')}
                </p>
                <p className="text-xs font-bold text-blue-900">
                  Net payable: SEK {(selectedInvoice.amount - (selectedInvoice.creditedAmount ?? 0)).toLocaleString('sv-SE')}
                </p>
              </div>
            )}

            {/* Line items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Line Items</p>

              {itemsLoading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading items…</p>
              ) : invoiceItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-sm">No line items extracted from this invoice PDF.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 rounded-lg">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Art #</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">Gross Price</th>
                      <th className="px-3 py-2 text-right font-semibold text-red-400 uppercase tracking-wider">Disc %</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">Net Price</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">VAT 25%</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-900 uppercase tracking-wider">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoiceItems.map(item => {
                      const vat = item.line_total * 0.25
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <p className="text-gray-800 font-medium">{item.description}</p>
                            {item.vin && (
                              <p className="text-[10px] font-mono text-blue-600 mt-0.5">VIN: {item.vin}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-400">{item.article_number || '—'}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 font-bold">{item.qty}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400 line-through">
                            {item.gross_unit_price ? item.gross_unit_price.toLocaleString('sv-SE') : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-red-500">
                            {item.discount_pct ? `${item.discount_pct}%` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-500">
                            {item.unit_price > 0 ? item.unit_price.toLocaleString('sv-SE') : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-400">
                            {vat.toLocaleString('sv-SE')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                            {item.line_total.toLocaleString('sv-SE')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-orange-50 border-t-2 border-orange-200">
                      <td colSpan={7} className="px-3 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide text-right">Total (incl. VAT)</td>
                      <td className="px-3 py-2.5 text-right text-base font-bold text-gray-900">
                        {selectedInvoice.amount.toLocaleString('sv-SE')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {selectedInvoice.notes && (
                <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Quick comment */}
              <QuickComment
                invoiceId={selectedInvoice.id}
                onSaved={(newNote) => {
                  const appended = selectedInvoice.notes
                    ? `${selectedInvoice.notes}\n\n${new Date().toLocaleDateString('sv-SE')} — ${newNote}`
                    : `${new Date().toLocaleDateString('sv-SE')} — ${newNote}`;
                  setInvoices(prev => prev.map(i => i.id === selectedInvoice.id ? { ...i, notes: appended } : i));
                  setSelectedInvoice(prev => prev ? { ...prev, notes: appended } : prev);
                }}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
              <div>
                {selectedInvoice.pdfUrl && (
                  <a
                    href={selectedInvoice.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg transition-colors"
                  >
                    📄 View PDF
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Send for Approval — Pending only */}
                {selectedInvoice.status === 'Pending' && (
                  <button onClick={() => handleSendForApproval(selectedInvoice)}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    Send for Approval
                  </button>
                )}
                {/* Approve — Awaiting Approval only */}
                {selectedInvoice.status === 'Awaiting Approval' && (
                  <button onClick={() => handleApprove(selectedInvoice)}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    Approve
                  </button>
                )}
                {(['Pending', 'Awaiting Approval', 'Overdue'] as PurchaseInvoiceStatus[]).includes(selectedInvoice.status) && (
                  <button onClick={() => handleMarkPaid(selectedInvoice)}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
                    Mark as Paid
                  </button>
                )}
                {(['Pending', 'Awaiting Approval'] as PurchaseInvoiceStatus[]).includes(selectedInvoice.status) && (
                  <button onClick={() => { setDisputeInvoice(selectedInvoice); setDisputeReason(''); }}
                    className="px-4 py-2 text-sm font-semibold text-purple-700 border border-purple-300 hover:bg-purple-50 rounded-lg transition-colors">
                    Dispute
                  </button>
                )}
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
        </div>
      )}

      {/* Manual credit note entry modal */}
      {showCNForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCNForm(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-bold text-gray-900">Add Credit Note</h3>
              <button onClick={() => setShowCNForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor <span className="text-red-500">*</span></label>
                <VendorComboBox
                  value={cnForm.vendor}
                  vendors={vendors}
                  onChange={v => setCnForm(f => ({ ...f, vendor: v }))}
                  focusColor="focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Supplier Credit # <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="text" placeholder="e.g. KR-2026-0042" value={cnForm.supplierCreditNumber}
                    onChange={e => setCnForm(f => ({ ...f, supplierCreditNumber: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Credit Date <span className="text-red-500">*</span></label>
                  <input type="date" value={cnForm.creditDate}
                    onChange={e => setCnForm(f => ({ ...f, creditDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Link to Invoice <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={cnForm.originalInvoiceId} onChange={e => setCnForm(f => ({ ...f, originalInvoiceId: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-emerald-500">
                  <option value="">— No invoice linked —</option>
                  {invoices.filter(i => !cnForm.vendor || i.vendor === cnForm.vendor).map(i => (
                    <option key={i.id} value={i.id}>{i.id} — {i.vendor}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Credit Amount (SEK) <span className="text-red-500">*</span></label>
                <input type="number" min="0.01" step="0.01" placeholder="0.00" value={cnForm.amount}
                  onChange={e => setCnForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason</label>
                <textarea rows={2} placeholder="e.g. Wrong quantity billed, returned goods, pricing error…" value={cnForm.reason}
                  onChange={e => setCnForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowCNForm(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveCreditNote}
                disabled={!cnForm.vendor || !cnForm.creditDate || !cnForm.amount}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                Save Credit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Credit modal */}
      {applyCredit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setApplyCredit(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Apply Credit Note</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {applyCredit.invoice.vendor} · {applyCredit.invoice.id}
                </p>
              </div>
              <button onClick={() => setApplyCredit(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            {/* Invoice summary */}
            <div className="mx-6 mt-4 bg-gray-50 rounded-xl px-4 py-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Invoice Amount</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  SEK {applyCredit.invoice.amount.toLocaleString('sv-SE')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Already Credited</p>
                <p className="text-sm font-bold text-emerald-700 mt-0.5">
                  − SEK {(applyCredit.invoice.creditedAmount ?? 0).toLocaleString('sv-SE')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Net Payable</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  SEK {(applyCredit.invoice.amount - (applyCredit.invoice.creditedAmount ?? 0)).toLocaleString('sv-SE')}
                </p>
              </div>
            </div>

            {/* Credit note selector */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Select credit note to apply <span className="text-red-500">*</span>
                </label>
                <select
                  value={applyCreditId}
                  onChange={e => { setApplyCreditId(e.target.value); setApplyAmount(''); }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-emerald-500"
                >
                  {applyCredit.credits.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.supplierCreditNumber ?? 'No supplier ref'} · SEK {c.remainingAmount.toLocaleString('sv-SE')} available
                      {c.reason ? ` — ${c.reason.slice(0, 40)}` : ''}
                    </option>
                  ))}
                </select>
                {/* Selected credit note detail */}
                {(() => {
                  const selected = applyCredit.credits.find(c => c.id === applyCreditId);
                  if (!selected) return null;
                  return (
                    <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
                      <span className="font-semibold">Available:</span> SEK {selected.remainingAmount.toLocaleString('sv-SE')}
                      {selected.reason && <> · <span className="italic">{selected.reason}</span></>}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Amount to apply
                  <span className="text-gray-400 font-normal ml-1">(leave blank to apply full available credit)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">SEK</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={(() => {
                      const sel = applyCredit.credits.find(c => c.id === applyCreditId);
                      const netPayable = applyCredit.invoice.amount - (applyCredit.invoice.creditedAmount ?? 0);
                      const max = sel ? Math.min(sel.remainingAmount, netPayable) : 0;
                      return `Max: ${max.toLocaleString('sv-SE')}`;
                    })()}
                    value={applyAmount}
                    onChange={e => setApplyAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Preview result */}
              {(() => {
                const sel         = applyCredit.credits.find(c => c.id === applyCreditId);
                const netPayable  = applyCredit.invoice.amount - (applyCredit.invoice.creditedAmount ?? 0);
                const toApply     = Math.min(parseFloat(applyAmount) || (sel?.remainingAmount ?? 0), sel?.remainingAmount ?? 0, netPayable);
                const newPayable  = netPayable - toApply;
                if (!sel || toApply <= 0) return null;
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-blue-800 mb-2">After applying this credit:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-blue-600">Credit applied</p>
                        <p className="font-bold text-blue-900">− SEK {toApply.toLocaleString('sv-SE')}</p>
                      </div>
                      <div>
                        <p className="text-blue-600">New net payable</p>
                        <p className={`font-bold ${newPayable <= 0 ? 'text-emerald-700' : 'text-blue-900'}`}>
                          {newPayable <= 0 ? '✓ Fully settled' : `SEK ${newPayable.toLocaleString('sv-SE')}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setApplyCredit(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConfirmApplyCredit}
                disabled={!applyCreditId}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                Apply Credit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute reason modal */}
      {disputeInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDisputeInvoice(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Raise Dispute</h3>
                <p className="text-xs text-gray-400 mt-0.5">{disputeInvoice.vendor} · {disputeInvoice.id}</p>
              </div>
              <button onClick={() => setDisputeInvoice(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Reason for dispute <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Wrong quantity billed — ordered 10, invoiced 12. Waiting for credit note."
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 resize-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setDisputeInvoice(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitDispute}
                disabled={!disputeReason.trim()}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                Mark as Disputed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ── Filter vendor combobox (for the filter bar — picks from existing invoices) ─
function FilterVendorComboBox({
  value,
  vendorNames,
  onChange,
}: {
  value: string
  vendorNames: string[]
  onChange: (v: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [open,  setOpen]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Keep query in sync when external value is cleared
  useEffect(() => { if (!value) setQuery('') }, [value])

  const filtered = query.trim()
    ? vendorNames.filter(n => n.toLowerCase().includes(query.toLowerCase()))
    : vendorNames

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (name: string) => {
    setQuery(name)
    onChange(name)
    setOpen(false)
  }

  const clear = () => {
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-orange-400">
        <input
          type="text"
          value={query}
          placeholder="All Vendors"
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="text-sm px-3 py-1.5 bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none w-44"
        />
        {query && (
          <button onMouseDown={clear} className="pr-2 text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto min-w-[200px]">
          {filtered.map(name => (
            <button
              key={name}
              onMouseDown={() => select(name)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-orange-50 transition-colors ${value === name ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-700'}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vendor combobox ───────────────────────────────────────────────────────────
function VendorComboBox({
  value,
  vendors,
  onChange,
  focusColor = 'focus:border-[#FF6B2C]',
}: {
  value: string
  vendors: SupabaseVendor[]
  onChange: (v: string) => void
  focusColor?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // All vendor names from DB + from invoices (deduped)
  const allNames = Array.from(new Set(vendors.map(v => v.name))).sort()

  const filtered = value.trim()
    ? allNames.filter(n => n.toLowerCase().includes(value.toLowerCase()))
    : allNames

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (name: string) => { onChange(name); setOpen(false) }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        placeholder="Type to search or enter new vendor…"
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none ${focusColor}`}
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 && value.trim() ? (
            <button
              onMouseDown={() => select(value.trim())}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 text-orange-600 font-semibold"
            >
              + Use &quot;{value.trim()}&quot; as new vendor
            </button>
          ) : (
            <>
              {value.trim() && !allNames.includes(value.trim()) && (
                <button
                  onMouseDown={() => select(value.trim())}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 text-orange-600 font-semibold border-b border-gray-100"
                >
                  + Use &quot;{value.trim()}&quot; as new vendor
                </button>
              )}
              {filtered.map(name => (
                <button
                  key={name}
                  onMouseDown={() => select(name)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 transition-colors ${value === name ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-700'}`}
                >
                  {name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}


function QuickComment({ invoiceId, onSaved }: { invoiceId: string; onSaved: (note: string) => void }) {
  const [text,   setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const appended = `${new Date().toLocaleDateString('sv-SE')} — ${text.trim()}`;
    // Fetch current notes then append
    const { data } = await supabase
      .from('purchase_invoices')
      .select('notes')
      .eq('id', invoiceId)
      .single();
    const newNotes = data?.notes ? `${data.notes}\n\n${appended}` : appended;
    await supabase.from('purchase_invoices').update({ notes: newNotes }).eq('id', invoiceId);
    onSaved(text.trim());
    setText('');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Add Note</p>
      </div>
      <div className="p-3 flex gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. Chased supplier today, awaiting credit note…"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 resize-none"
        />
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="self-end px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shrink-0"
        >
          {saved ? '✓ Saved' : saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}