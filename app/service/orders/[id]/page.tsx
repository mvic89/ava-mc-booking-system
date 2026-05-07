'use client';

import { useEffect, useState, useCallback } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import {
  getWorkOrder,
  type WorkOrder, type WorkOrderTask, type WorkOrderPart,
  type TimeEntry, type WorkOrderStatus,
  WO_STATUS_COLORS,
  PRIORITY_COLORS,
} from '@/lib/service';
import { useAutoRefresh } from '@/lib/realtime';
import { searchOperations, type ServiceOperation } from '@/lib/service-operations';

type Tab = 'items' | 'time' | 'notes' | 'details';
type LineType = 'labor' | 'part' | 'other';

const PART_STATUS_COLORS: Record<string, string> = {
  needed:   'bg-red-100 text-red-600',
  reserved: 'bg-blue-100 text-blue-600',
  ordered:  'bg-orange-100 text-orange-600',
  received: 'bg-emerald-100 text-emerald-700',
  used:     'bg-slate-100 text-slate-500',
};

const inp = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white';

interface InvSuggestion {
  id: string;
  name: string;
  article_number: string;
  stock: number;
  selling_price: number;
  cost: number;
  vendor: string;
  item_type: 'spare_part' | 'accessory';
  size?: string;
  category?: string;
}

// AddLineForm lives outside the page component to avoid focus-loss on re-render
function AddLineForm({ onAdd, laborRate, disabled, dealershipId, t }: {
  onAdd: (type: LineType, name: string, qty: number, unitPrice: number, partNumber?: string, hrs?: number) => Promise<void>;
  laborRate:    number;
  disabled:     boolean;
  dealershipId: string;
  t:            ReturnType<typeof useTranslations<'service'>>;
}) {
  const [type,        setType]        = useState<LineType>('part');
  const [name,        setName]        = useState('');
  const [partNumber,  setPartNumber]  = useState('');
  const [qty,         setQty]         = useState('1');
  const [unitPrice,   setUnitPrice]   = useState('');
  const [hrs,         setHrs]         = useState('');
  const [saving,          setSaving]          = useState(false);
  const [suggestions,     setSuggestions]     = useState<InvSuggestion[]>([]);
  const [showSug,         setShowSug]         = useState(false);
  const [stockInfo,       setStockInfo]       = useState<{ stock: number; inStock: boolean } | null>(null);
  const [showLaborPicker, setShowLaborPicker] = useState(false);
  const [laborSearch,     setLaborSearch]     = useState('');

  const laborOps = showLaborPicker ? searchOperations(laborSearch) : [];

  useEffect(() => {
    if (type !== 'part') { setSuggestions([]); return; }
    const term = (partNumber || name).trim();
    if (term.length < 2) { setSuggestions([]); setShowSug(false); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/service/spare-parts?dealershipId=${encodeURIComponent(dealershipId)}&q=${encodeURIComponent(term)}`);
        const { results } = await res.json();
        setSuggestions(results ?? []);
        setShowSug((results ?? []).length > 0);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [name, partNumber, type, dealershipId]);

  function selectSuggestion(s: InvSuggestion) {
    setName(s.name);
    setPartNumber(s.article_number);
    setUnitPrice(String(s.selling_price || s.cost || ''));
    setStockInfo({ stock: s.stock, inStock: s.stock > 0 });
    setSuggestions([]);
    setShowSug(false);
  }

  function selectLaborOp(op: ServiceOperation) {
    setName(op.name);
    setShowLaborPicker(false);
    setLaborSearch('');
  }

  async function handleAdd() {
    if (!name.trim()) { toast.error(t('orderDetail.toasts.partError')); return; }
    setSaving(true);
    const qtyNum   = parseFloat(qty) || 1;
    const priceNum = parseFloat(unitPrice.replace(',', '.')) || 0;
    const hrsNum   = parseFloat(hrs.replace(',', '.')) || 0;
    await onAdd(type, name.trim(), qtyNum, priceNum, partNumber.trim() || undefined, hrsNum || undefined);
    setName(''); setPartNumber(''); setQty('1'); setUnitPrice(''); setHrs('');
    setStockInfo(null); setSuggestions([]); setLaborSearch(''); setShowLaborPicker(false);
    setSaving(false);
  }

  const nameLabel = type === 'labor'
    ? t('orderDetail.addLine.nameLabelLabor')
    : type === 'part'
    ? t('orderDetail.addLine.nameLabelPart')
    : t('orderDetail.addLine.nameLabelOther');

  const namePlaceholder = type === 'part'
    ? t('orderDetail.addLine.namePlaceholderPart')
    : type === 'labor'
    ? t('orderDetail.addLine.namePlaceholderLabor')
    : t('orderDetail.addLine.namePlaceholderOther');

  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-[#FF6B2C]/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-600">{t('orderDetail.addLine.label')}</span>
        {(['part', 'labor', 'other'] as LineType[]).map(lt => (
          <button key={lt} type="button"
            onClick={() => { setType(lt); setSuggestions([]); setStockInfo(null); }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              type === lt ? 'bg-[#FF6B2C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {lt === 'part' ? t('orderDetail.addLine.part') : lt === 'labor' ? t('orderDetail.addLine.labor') : t('orderDetail.addLine.other')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {type === 'part' && (
          <div className="md:col-span-2 relative">
            <label className="block text-[10px] text-slate-400 mb-1">{t('orderDetail.addLine.artNr')}</label>
            <input value={partNumber}
              onChange={e => { setPartNumber(e.target.value); setStockInfo(null); }}
              onFocus={() => suggestions.length > 0 && setShowSug(true)}
              placeholder={t('orderDetail.addLine.artNrPlaceholder')} className={inp} />
          </div>
        )}

        <div className={`relative ${type === 'part' ? 'md:col-span-4' : 'md:col-span-6'}`}>
          <label className="block text-[10px] text-slate-400 mb-1">{nameLabel}</label>

          {/* Labor: combobox trigger — only opens on explicit click */}
          {type === 'labor' ? (
            <div className="relative">
              <button type="button"
                onClick={() => { setShowLaborPicker(v => !v); setLaborSearch(''); }}
                className={`${inp} flex items-center justify-between text-left ${name ? 'text-slate-800' : 'text-slate-400'}`}>
                <span className="truncate">{name || namePlaceholder}</span>
                <svg className={`w-4 h-4 shrink-0 ml-2 text-slate-400 transition-transform ${showLaborPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLaborPicker && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowLaborPicker(false)} />
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    {/* Search input inside picker */}
                    <div className="p-2 border-b border-slate-100">
                      <input autoFocus
                        value={laborSearch}
                        onChange={e => setLaborSearch(e.target.value)}
                        placeholder="Sök åtgärd…"
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {laborOps.reduce((acc: string[], op) => acc.includes(op.category) ? acc : [...acc, op.category], []).map(cat => (
                        <div key={cat}>
                          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{cat}</span>
                          </div>
                          {laborOps.filter(op => op.category === cat).map(op => (
                            <button key={op.id} type="button"
                              onClick={() => selectLaborOp(op)}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-orange-50 text-left border-b border-slate-50 last:border-0">
                              <span className="font-medium text-slate-800">{op.name}</span>
                              <span className="text-[10px] text-slate-400 ml-3 shrink-0">{op.nameEn}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {laborOps.length === 0 && (
                        <p className="px-3 py-4 text-sm text-slate-400 text-center">Inga träffar</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Parts / Other: plain text input with autocomplete */
            <>
              <input value={name}
                onChange={e => { setName(e.target.value); setStockInfo(null); }}
                onFocus={() => { if (suggestions.length > 0) setShowSug(true); }}
                onBlur={() => { setTimeout(() => setShowSug(false), 150); }}
                placeholder={namePlaceholder}
                className={inp} />

              {showSug && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {suggestions.map(s => (
                    <button key={`${s.item_type}-${s.id}`} type="button"
                      onMouseDown={() => selectSuggestion(s)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-orange-50 text-left border-b border-slate-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 truncate">{s.name}</span>
                          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            s.item_type === 'accessory' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {s.item_type === 'accessory' ? t('orderDetail.addLine.accessory') : t('orderDetail.addLine.sparePart')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.article_number && <span className="text-[10px] text-slate-400 font-mono">{s.article_number}</span>}
                          {s.size && <span className="text-[10px] text-slate-400">· {s.size}</span>}
                          {s.category && <span className="text-[10px] text-slate-400">· {s.category}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {s.stock > 0 ? t('orderDetail.addLine.stockLabel', { count: s.stock }) : t('orderDetail.addLine.outOfStockLabel')}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">{(s.selling_price || s.cost || 0).toLocaleString('sv-SE')} kr</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {type === 'labor' ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-slate-400 mb-1">{t('orderDetail.addLine.hours')}</label>
              <input type="number" value={hrs} onChange={e => setHrs(e.target.value)} placeholder="0.0" step="0.5" min="0" className={inp} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-slate-400 mb-1">{t('orderDetail.addLine.hourRate')}</label>
              <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder={String(laborRate)} className={inp} />
            </div>
          </>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-slate-400 mb-1">{t('orderDetail.addLine.qty')}</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="1" min="1" step="1" className={inp} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-slate-400 mb-1">{t('orderDetail.addLine.unitPrice')}</label>
              <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0" className={inp} />
            </div>
          </>
        )}

        <div className="md:col-span-2">
          <button type="button" onClick={handleAdd}
            disabled={saving || disabled || !name.trim()}
            className="w-full py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors disabled:opacity-40">
            {saving ? t('orderDetail.addLine.hours') : t('orderDetail.addLine.addBtn')}
          </button>
        </div>
      </div>

      {type === 'part' && stockInfo && (
        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${stockInfo.inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {stockInfo.inStock
            ? t('orderDetail.addLine.inStock', { count: stockInfo.stock })
            : t('orderDetail.addLine.outOfStock')}
        </div>
      )}
      {type === 'part' && !stockInfo && (
        <p className="text-[10px] text-slate-400">{t('orderDetail.addLine.hintPart')}</p>
      )}
      {type === 'labor' && (
        <p className="text-[10px] text-slate-400">{t('orderDetail.addLine.hintLabor', { rate: laborRate.toLocaleString('sv-SE') })}</p>
      )}
    </div>
  );
}

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const router  = useRouter();
  const t = useTranslations('service');

  const [order,        setOrder]        = useState<WorkOrder | null>(null);
  const [tasks,        setTasks]        = useState<WorkOrderTask[]>([]);
  const [parts,        setParts]        = useState<WorkOrderPart[]>([]);
  const [timeLog,      setTimeLog]      = useState<TimeEntry[]>([]);
  const [invoicePaid,  setInvoicePaid]  = useState(false);
  const [tab,          setTab]          = useState<Tab>('items');
  const [loading,      setLoading]      = useState(true);
  const [updating,     setUpdating]     = useState(false);
  const [notes,        setNotes]        = useState('');
  const [notesDirty,   setNotesDirty]   = useState(false);
  const [timeTech,       setTimeTech]       = useState('');
  const [clockingIn,     setClockingIn]     = useState(false);
  const [techList,       setTechList]       = useState<string[]>([]);
  const [showTechPicker, setShowTechPicker] = useState(false);
  const [showPOForm,     setShowPOForm]     = useState(false);
  const [poVendor,     setPoVendor]     = useState('');
  const [creatingPO,   setCreatingPO]   = useState(false);

  // Status actions built from translations (inside component so t() is available)
  const STATUS_ACTIONS: Partial<Record<WorkOrderStatus, { next: WorkOrderStatus; label: string; color: string }>> = {
    created:       { next: 'in_progress', label: t('orderDetail.statusActions.startWork'),          color: 'bg-amber-600 hover:bg-amber-700' },
    in_progress:   { next: 'ready',       label: t('orderDetail.statusActions.markReady'),          color: 'bg-emerald-600 hover:bg-emerald-700' },
    waiting_parts: { next: 'in_progress', label: t('orderDetail.statusActions.partsReceived'),      color: 'bg-amber-600 hover:bg-amber-700' },
    ready:         { next: 'completed',   label: t('orderDetail.statusActions.completeAndInvoice'), color: 'bg-[#FF6B2C] hover:bg-[#e55a1f]' },
  };

  // Part status labels from translations
  const partStatusLabel = (status: string) =>
    t(`partStatus.${status}` as Parameters<typeof t>[0]);

  const load = useCallback(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const data = await getWorkOrder(Number(id));
    setOrder(data.order);
    setTasks(data.tasks);
    setParts(data.parts);
    setTimeLog(data.time);
    if (data.order) setNotes(data.order.internal_notes ?? '');
    // Check if the linked invoice has already been paid
    if (data.order?.invoice_id) {
      const res = await fetch(`/api/invoice/by-id?id=${encodeURIComponent(data.order.invoice_id)}&dealershipId=${encodeURIComponent(dealershipId)}`);
      if (res.ok) {
        const j = await res.json() as { invoice?: { status: string } };
        setInvoicePaid(j.invoice?.status === 'paid');
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    load();
    // Pre-fill tech name from logged-in user + load workshop tech list
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { givenName?: string; name?: string };
      const myName = u.givenName || u.name || '';
      if (myName) setTimeTech(myName);
    } catch { /* ignore */ }
    const did_ = getDealershipId();
    if (did_) {
      fetch(`/api/service/technicians?dealershipId=${encodeURIComponent(did_)}`)
        .then(r => r.json())
        .then((j: { technicians?: { name: string }[] }) => {
          setTechList((j.technicians ?? []).map(tc => tc.name).filter(Boolean));
        })
        .catch(() => {});
    }
  }, [load, router]);

  useAutoRefresh(() => { void load(); });

  const did = () => getDealershipId() ?? '';

  async function addLine(type: LineType, name: string, qty: number, unitPrice: number, partNumber?: string, hrs?: number) {
    if (type === 'labor') {
      const rate = unitPrice > 0 ? unitPrice : (order?.labor_rate ?? 850);
      const estimatedHrs = hrs || qty;
      await fetch(`/api/service/orders/${id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did(), title: name, estimatedHrs, laborRate: rate, techName: order?.assigned_tech ?? '' }),
      });
      toast.success(t('orderDetail.toasts.laborAdded'));
    } else {
      const res = await fetch(`/api/service/orders/${id}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did(), partNumber, name, quantity: qty, unitCost: unitPrice }),
      });
      if (res.ok) {
        const { autoReserved } = await res.json();
        toast.success(autoReserved
          ? t('orderDetail.addLine.inStock', { count: qty }) + ' ✓'
          : name + ' tillagd');
      } else {
        toast.error(t('orderDetail.toasts.partError'));
      }
    }
    load();
  }

  async function advanceStatus() {
    if (!order) return;
    const action = STATUS_ACTIONS[order.status];
    if (!action) return;

    if (order.status === 'ready') {
      setUpdating(true);
      const res = await fetch(`/api/service/orders/${id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did() }),
      });
      setUpdating(false);
      if (res.ok) {
        const { invoiceId } = await res.json();
        toast.success(t('orderDetail.toasts.completedRedirect'));
        setTimeout(() => router.push(`/service/orders/${id}/payment?invoiceId=${invoiceId ?? ''}`), 600);
      } else {
        toast.error(t('orderDetail.toasts.completeError'));
      }
      return;
    }

    setUpdating(true);
    const res = await fetch(`/api/service/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId: did(), status: action.next }),
    });
    setUpdating(false);
    if (res.ok) {
      const { order: u } = await res.json();
      setOrder(u);
      toast.success(t(`status.${action.next}` as Parameters<typeof t>[0]));

      // Auto clock-in when work starts
      if (action.next === 'in_progress') {
        const storedUser = JSON.parse(localStorage.getItem('user') ?? '{}') as { givenName?: string; name?: string };
        const techName = order.assigned_tech || storedUser.givenName || storedUser.name || '';
        if (techName) {
          const cr = await fetch('/api/service/time', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealershipId: did(), workOrderId: Number(id), techName }),
          });
          if (cr.ok) {
            toast.success(`${techName} ${t('orderDetail.time.checkInBtn').toLowerCase()}`);
          } else {
            const j = await cr.json() as { error?: string };
            if (j.error && !j.error.toLowerCase().includes('redan')) toast.error(j.error);
          }
        }
      }

      // Auto clock-out all open entries when marked ready
      if (action.next === 'ready') {
        const openEntries = timeLog.filter(e => !e.clocked_out_at);
        await Promise.all(openEntries.map(e =>
          fetch('/api/service/time', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealershipId: did(), entryId: e.id }),
          })
        ));
        if (openEntries.length > 0) toast.success(t('orderDetail.toasts.checkedOut'));
      }

      load();
    }
  }

  async function deleteLine(line: typeof allLines[number]) {
    if (line.type === 'labor') {
      const taskId = (line.raw as WorkOrderTask).id;
      await fetch(`/api/service/orders/${id}/tasks?taskId=${taskId}&dealershipId=${did()}`, { method: 'DELETE' });
    } else {
      const partId = (line.raw as WorkOrderPart).id;
      await fetch(`/api/service/orders/${id}/parts?partId=${partId}&dealershipId=${did()}`, { method: 'DELETE' });
    }
    toast.success(t('orderDetail.toasts.lineRemoved'));
    load();
  }

  async function updatePartStatus(partId: number, status: string) {
    await fetch(`/api/service/orders/${id}/parts`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId: did(), partId, status }),
    });
    load();
  }

  async function createPurchaseOrder() {
    const neededParts = parts.filter(p => p.status === 'needed');
    if (!neededParts.length || !poVendor.trim()) return;
    setCreatingPO(true);
    const res = await fetch('/api/purchasing/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId: did(), workOrderId: Number(id), vendor: poVendor.trim(),
        items: neededParts.map(p => ({
          workOrderPartId: p.id, articleNumber: p.part_number ?? '',
          name: p.name, quantity: p.quantity, unitCost: p.unit_cost,
        })),
      }),
    });
    setCreatingPO(false);
    if (res.ok) {
      const { order: po } = await res.json();
      toast.success(t('orderDetail.toasts.orderCreated', { id: po.id }));
      setShowPOForm(false); setPoVendor('');
      load();
    } else {
      const j = await res.json();
      toast.error(j.error ?? t('orderDetail.toasts.poError'));
    }
  }

  async function clockIn() {
    if (!timeTech.trim()) { toast.error(t('orderDetail.toasts.noTechName')); return; }
    setClockingIn(true);
    const res = await fetch('/api/service/time', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId: did(), workOrderId: Number(id), techName: timeTech }),
    });
    setClockingIn(false);
    if (res.ok) { toast.success(`${timeTech} ${t('orderDetail.time.checkInBtn').toLowerCase()}`); load(); }
    else { const j = await res.json(); toast.error(j.error ?? t('orderDetail.toasts.noTechName')); }
  }

  async function clockOut(entryId: number) {
    await fetch('/api/service/time', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId: did(), entryId }),
    });
    toast.success(t('orderDetail.toasts.checkedOut'));
    load();
  }

  async function saveNotes() {
    await fetch(`/api/service/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId: did(), internal_notes: notes }),
    });
    setNotesDirty(false);
    toast.success(t('orderDetail.toasts.notesSaved'));
  }

  if (loading) return (
    <div className="flex min-h-screen bg-[#f5f7fa]"><Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center text-slate-400">{t('orderDetail.loading')}</div>
    </div>
  );
  if (!order) return (
    <div className="flex min-h-screen bg-[#f5f7fa]"><Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{t('orderDetail.notFound')}</p>
          <Link href="/service/orders" className="text-[#FF6B2C] font-semibold">{t('common.back')}</Link>
        </div>
      </div>
    </div>
  );

  const action       = STATUS_ACTIONS[order.status];
  const activeEntry  = timeLog.find(t_ => !t_.clocked_out_at);
  const totalBillMin = timeLog.filter(t_ => t_.billable && t_.duration_min).reduce((s, t_) => s + (t_.duration_min ?? 0), 0);
  const missingParts = parts.filter(p => p.status === 'needed' || p.status === 'ordered');
  const isLocked     = ['completed', 'invoiced'].includes(order.status);

  const laborLines = tasks.map(t_ => ({
    id: `t-${t_.id}`, type: 'labor' as LineType,
    name: t_.title, qty: t_.actual_hrs > 0 ? t_.actual_hrs : t_.estimated_hrs, unit: 'tim',
    unitPrice: order.labor_rate, total: (t_.actual_hrs > 0 ? t_.actual_hrs : t_.estimated_hrs) * order.labor_rate,
    status: t_.status, raw: t_,
  }));
  const partLines = parts.map(p => ({
    id: `p-${p.id}`, type: 'part' as LineType,
    name: p.name, qty: p.quantity, unit: 'st',
    unitPrice: p.unit_cost, total: p.total_cost,
    status: p.status, partNumber: p.part_number, raw: p,
  }));
  const allLines = [...laborLines, ...partLines];

  const subtotal   = allLines.reduce((s, l) => s + l.total, 0);
  const vat        = Math.round(subtotal * 0.25 * 100) / 100;   // 25% Swedish VAT on net
  const grandTotal = Math.round((subtotal + vat) * 100) / 100;
  const fmt        = (n: number) => `${n.toLocaleString('sv-SE')} kr`;

  const TABS = [
    { key: 'items'   as Tab, label: t('orderDetail.tabs.items',   { count: allLines.length }) },
    { key: 'time'    as Tab, label: t('orderDetail.tabs.time',    { count: timeLog.length }) },
    { key: 'notes'   as Tab, label: t('orderDetail.tabs.notes') },
    { key: 'details' as Tab, label: t('orderDetail.tabs.details') },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Header ── */}
        <div className="px-5 md:px-8 py-5 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>→</span>
            <Link href="/service/orders" className="hover:text-[#FF6B2C]">{t('orders.title')}</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">AO-{order.id}</span>
          </nav>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-black text-[#0b1524]">AO-{order.id} · {order.customer_name}</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${WO_STATUS_COLORS[order.status]}`}>
                  {t(`status.${order.status}` as Parameters<typeof t>[0])}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[order.priority]}`}>
                  {t(`priority.${order.priority}` as Parameters<typeof t>[0])}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {order.vehicle_name || t('common.noVehicle')}{order.plate ? ` · ${order.plate}` : ''}
                {order.assigned_tech ? ` · ${order.assigned_tech}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isLocked && parts.filter(p => p.status === 'needed').length > 0 && (
                <button onClick={() => setShowPOForm(v => !v)}
                  className="px-3 py-2 rounded-xl border border-blue-300 text-blue-700 text-xs font-semibold hover:bg-blue-50">
                  {t('orderDetail.statusActions.createPO')}
                </button>
              )}
              {order.status === 'in_progress' && missingParts.length > 0 && (
                <button
                  onClick={() => fetch(`/api/service/orders/${id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dealershipId: did(), status: 'waiting_parts' }),
                  }).then(load)}
                  className="px-3 py-2 rounded-xl border border-orange-300 text-orange-700 text-xs font-semibold hover:bg-orange-50"
                >
                  {t('orderDetail.statusActions.waitingParts')}
                </button>
              )}
              {action && !isLocked && (
                <button onClick={advanceStatus} disabled={updating}
                  className={`px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-50 ${action.color}`}>
                  {updating ? '...' : action.label}
                </button>
              )}
              {order.invoice_id && (
                invoicePaid
                  ? <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-1.5">
                      ✅ {order.invoice_id} — {t('orderDetail.statusActions.alreadyPaid')}
                    </span>
                  : <Link href={`/service/orders/${id}/payment?invoiceId=${order.invoice_id}`}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors">
                      {t('orderDetail.statusActions.payInvoice', { id: order.invoice_id })}
                    </Link>
              )}
            </div>
          </div>

          {/* Inline PO form */}
          {showPOForm && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col gap-3">
              <p className="text-sm font-semibold text-blue-800">
                {t('orderDetail.po.title', { count: parts.filter(p => p.status === 'needed').length })}
              </p>
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className="block text-[10px] text-blue-600 mb-1 font-bold uppercase tracking-wide">{t('orderDetail.po.vendor')}</label>
                  <input
                    value={poVendor} onChange={e => setPoVendor(e.target.value)}
                    placeholder={t('orderDetail.po.vendorPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white"
                  />
                </div>
                <button onClick={createPurchaseOrder} disabled={creatingPO || !poVendor.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50">
                  {creatingPO ? t('orderDetail.po.creating') : t('orderDetail.po.create')}
                </button>
                <button onClick={() => setShowPOForm(false)} className="text-blue-400 text-sm hover:underline">
                  {t('orderDetail.po.cancel')}
                </button>
              </div>
              <ul className="text-xs text-blue-700 list-disc list-inside space-y-0.5">
                {parts.filter(p => p.status === 'needed').map(p => (
                  <li key={p.id}>{p.name} × {p.quantity}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-5 overflow-x-auto">
            {TABS.map(tb => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  tab === tb.key ? 'border-[#FF6B2C] text-[#FF6B2C]' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="px-5 md:px-8 py-6 max-w-4xl">

          {/* ITEMS TAB */}
          {tab === 'items' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="col-span-1">{t('orderDetail.items.type')}</div>
                  <div className="col-span-3">{t('orderDetail.items.name')}</div>
                  <div className="col-span-1 text-right">{t('orderDetail.items.artNr')}</div>
                  <div className="col-span-1 text-right">{t('orderDetail.items.qty')}</div>
                  <div className="col-span-2 text-right">{t('orderDetail.items.unitPrice')}</div>
                  <div className="col-span-2 text-right">{t('orderDetail.items.total')}</div>
                  <div className="col-span-2 text-right">{t('orderDetail.items.status')}</div>
                </div>

                {allLines.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-2xl mb-3">📋</p>
                    <p className="text-sm font-semibold text-slate-500">{t('orderDetail.items.emptyTitle')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('orderDetail.items.emptySubtitle')}</p>
                  </div>
                )}

                {allLines.map((line, i) => (
                  <div key={line.id}
                    className={`group grid grid-cols-12 gap-2 px-5 py-3.5 items-center ${i > 0 ? 'border-t border-slate-50' : ''} ${!isLocked ? 'hover:bg-red-50/30' : ''}`}>
                    <div className="col-span-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        line.type === 'labor' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {line.type === 'labor' ? t('orderDetail.items.labor') : t('orderDetail.items.part')}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm font-semibold text-slate-900 truncate">{line.name}</p>
                    </div>
                    <div className="col-span-1 text-right">
                      {line.type === 'part' && (line as { partNumber?: string }).partNumber ? (
                        <span className="text-[10px] text-slate-400 font-mono">{(line as { partNumber?: string }).partNumber}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm text-slate-700">{line.qty} {line.unit}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm text-slate-700">{line.unitPrice.toLocaleString('sv-SE')} kr</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-bold text-slate-900">{fmt(line.total)}</span>
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-1.5">
                      {line.type === 'part' && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PART_STATUS_COLORS[(line.raw as WorkOrderPart).status]}`}>
                          {partStatusLabel((line.raw as WorkOrderPart).status)}
                        </span>
                      )}
                      {line.type === 'labor' && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          (line.raw as WorkOrderTask).status === 'done'        ? 'bg-emerald-100 text-emerald-700'
                          : (line.raw as WorkOrderTask).status === 'in_progress' ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                        }`}>
                          {(line.raw as WorkOrderTask).status === 'done'
                            ? t('orderDetail.taskStatus.done')
                            : (line.raw as WorkOrderTask).status === 'in_progress'
                            ? t('orderDetail.taskStatus.in_progress')
                            : t('orderDetail.taskStatus.pending')}
                        </span>
                      )}
                      {!isLocked && (
                        <button
                          onClick={() => deleteLine(line)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-red-100 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center text-[10px] font-bold shrink-0"
                          title={t('orderDetail.items.remove')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Part status actions */}
                {parts.filter(p => ['needed','ordered','received'].includes(p.status)).length > 0 && (
                  <div className="border-t border-slate-100 px-5 py-3 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('orderDetail.items.partActions')}</p>
                    {parts.filter(p => ['needed','ordered','received'].includes(p.status)).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PART_STATUS_COLORS[p.status]}`}>
                            {partStatusLabel(p.status)}
                          </span>
                          {p.status === 'needed' && (
                            <button onClick={() => updatePartStatus(p.id, 'ordered')}
                              className="text-orange-600 font-semibold hover:underline">{t('orderDetail.items.markOrdered')}</button>
                          )}
                          {p.status === 'ordered' && (
                            <button onClick={() => updatePartStatus(p.id, 'received')}
                              className="text-emerald-600 font-semibold hover:underline">{t('orderDetail.items.markReceived')}</button>
                          )}
                          {p.status === 'received' && (
                            <button onClick={() => updatePartStatus(p.id, 'used')}
                              className="text-slate-500 font-semibold hover:underline">{t('orderDetail.items.markUsed')}</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                {allLines.length > 0 && (
                  <div className="border-t border-slate-200 px-5 py-4 bg-slate-50 space-y-2">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>{t('orderDetail.items.subtotal')}</span><span>{fmt(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>{t('orderDetail.items.vat')}</span><span>{fmt(vat)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                      <span>{t('orderDetail.items.grandTotal')}</span>
                      <span className="text-[#FF6B2C]">{fmt(grandTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {!isLocked && (
                <AddLineForm
                  onAdd={addLine}
                  laborRate={order.labor_rate}
                  disabled={isLocked}
                  dealershipId={did()}
                  t={t}
                />
              )}

              {isLocked && order.invoice_id && (
                <div className="flex justify-center">
                  {invoicePaid
                    ? <div className="px-6 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center gap-2">
                        ✅ {order.invoice_id} — {t('orderDetail.statusActions.alreadyPaid')}
                      </div>
                    : <Link href={`/service/orders/${id}/payment?invoiceId=${order.invoice_id}`}
                        className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors">
                        {t('orderDetail.statusActions.goToPayment', { id: order.invoice_id })}
                      </Link>
                  }
                </div>
              )}
            </div>
          )}

          {/* TIME TAB */}
          {tab === 'time' && (
            <div className="space-y-4 max-w-2xl">
              {!isLocked && !activeEntry && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h3 className="text-xs font-bold text-slate-600 mb-3">{t('orderDetail.time.checkInTitle')}</h3>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      {/* Show combobox trigger only when there are techs to choose from */}
                      {techList.length > 0 ? (
                        <>
                          <button type="button"
                            onClick={() => setShowTechPicker(v => !v)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white text-left ${timeTech ? 'text-slate-800' : 'text-slate-400'}`}>
                            <span className="truncate">{timeTech || t('orderDetail.time.techPlaceholder')}</span>
                            <svg className={`w-4 h-4 shrink-0 ml-2 text-slate-400 transition-transform ${showTechPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showTechPicker && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowTechPicker(false)} />
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                                {techList.map(name => (
                                  <button key={name} type="button"
                                    onClick={() => { setTimeTech(name); setShowTechPicker(false); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left border-b border-slate-50 last:border-0 hover:bg-orange-50 transition-colors ${timeTech === name ? 'bg-orange-50 font-semibold text-[#FF6B2C]' : 'text-slate-800'}`}>
                                    <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                      {name.charAt(0).toUpperCase()}
                                    </span>
                                    {name}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <input value={timeTech} onChange={e => setTimeTech(e.target.value)}
                          placeholder={t('orderDetail.time.techPlaceholder')}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white" />
                      )}
                    </div>
                    <button onClick={clockIn} disabled={clockingIn}
                      className="px-4 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold disabled:opacity-50">
                      {clockingIn ? '...' : t('orderDetail.time.checkInBtn')}
                    </button>
                  </div>
                </div>
              )}
              {activeEntry && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-amber-900">{t('orderDetail.time.activeEntry', { name: activeEntry.tech_name })}</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {t('orderDetail.time.since')} {new Date(activeEntry.clocked_in_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => clockOut(activeEntry.id)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold">
                    {t('orderDetail.time.checkOut')}
                  </button>
                </div>
              )}
              {timeLog.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <p className="text-slate-400 text-sm">{t('orderDetail.time.noEntries')}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex justify-between">
                    <p className="text-xs font-bold text-slate-600">{t('orderDetail.time.header')}</p>
                    <p className="text-xs text-slate-500">
                      {t('orderDetail.time.totalLabel')} {Math.floor(totalBillMin / 60)}t {totalBillMin % 60}min
                    </p>
                  </div>
                  {timeLog.map((entry, i) => (
                    <div key={entry.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-900">{entry.tech_name}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(entry.clocked_in_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          {entry.clocked_out_at && ` → ${new Date(entry.clocked_out_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`}
                          {' · '}{new Date(entry.clocked_in_at).toLocaleDateString('sv-SE')}
                        </p>
                      </div>
                      <div className="text-right">
                        {entry.duration_min
                          ? <p className="text-sm font-bold text-slate-900">{Math.floor(entry.duration_min / 60)}t {entry.duration_min % 60}min</p>
                          : <p className="text-xs text-amber-600 font-semibold">{t('orderDetail.time.ongoing')}</p>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOTES TAB */}
          {tab === 'notes' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-600">{t('orderDetail.notes.title')}</h3>
                <textarea
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setNotesDirty(true); }}
                  rows={10}
                  placeholder={t('orderDetail.notes.placeholder')}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 resize-none"
                />
                {notesDirty && (
                  <button onClick={saveNotes}
                    className="px-4 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors">
                    {t('orderDetail.notes.save')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* DETAILS TAB */}
          {tab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('orderDetail.details.customer')}</h2>
                <DetailRow label={t('orderDetail.details.name')}    value={order.customer_name} />
                <DetailRow label={t('orderDetail.details.phone')}   value={order.customer_phone} />
                {order.customer_id && (
                  <Link href={`/customers/${order.customer_id}`} className="inline-block text-xs text-[#FF6B2C] font-semibold hover:underline mt-1">
                    {t('orderDetail.details.openProfile')}
                  </Link>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('orderDetail.details.vehicle')}</h2>
                <DetailRow label={t('orderDetail.details.model')}     value={order.vehicle_name} />
                <DetailRow label={t('orderDetail.details.regNr')}     value={order.plate} />
                <DetailRow label={t('orderDetail.details.vin')}       value={order.vin} />
                <DetailRow label={t('orderDetail.details.odometer')}  value={order.mileage ? `${order.mileage.toLocaleString('sv-SE')} km` : undefined} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('orderDetail.details.matter')}</h2>
                {order.description
                  ? <p className="text-xs text-slate-700 leading-relaxed">{order.description}</p>
                  : <p className="text-xs text-slate-400 italic">{t('orderDetail.details.noDescription')}</p>}
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('orderDetail.details.timestamps')}</h2>
                <DetailRow label={t('orderDetail.details.created')}   value={new Date(order.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })} />
                <DetailRow label={t('orderDetail.details.started')}   value={order.started_at ? new Date(order.started_at).toLocaleString('sv-SE') : undefined} />
                <DetailRow label={t('orderDetail.details.completed')} value={order.completed_at ? new Date(order.completed_at).toLocaleString('sv-SE') : undefined} />
                <DetailRow label={t('orderDetail.details.laborRate')} value={`${order.labor_rate.toLocaleString('sv-SE')} kr/tim`} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return value ? (
    <div className="flex items-start justify-between gap-4">
      <p className="text-[10px] text-slate-400 shrink-0">{label}</p>
      <p className="text-xs text-slate-700 font-medium text-right">{value}</p>
    </div>
  ) : null;
}
