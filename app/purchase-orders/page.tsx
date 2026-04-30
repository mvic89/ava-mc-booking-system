'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { useAutoRefresh } from '@/lib/realtime';

// ── Types ─────────────────────────────────────────────────────────────────────

type POStatus = 'Draft' | 'Ordered' | 'Partial' | 'Reviewed' | 'Cancelled';

interface POItem {
  id:                 number;
  purchase_order_id:  string;
  work_order_id:      number | null;
  work_order_part_id: number | null;
  article_number:     string;
  name:               string;
  quantity:           number;
  unit_cost:          number;
  total_cost:         number;
  status:             'ordered' | 'received';
  received_at:        string | null;
}

interface PurchaseOrder {
  id:            string;
  dealership_id: string;
  vendor:        string;
  vendor_id:     string | null;
  work_order_id: number | null;
  date:          string;
  eta:           string | null;
  status:        POStatus;
  total_cost:    number;
  notes:         string | null;
  created_at:    string;
  updated_at:    string | null;
  purchase_order_items?: POItem[];
  work_order?: { customer_name: string; vehicle_name: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type TFunc = ReturnType<typeof useTranslations<'service'>>;

function fmt(n: number) { return `${n.toLocaleString('sv-SE')} kr`; }
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Status badge colours (not translated, just Tailwind classes) ──────────────

const STATUS_BADGE: Record<POStatus, { badge: string; dot: string }> = {
  Draft:     { badge: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  Ordered:   { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  Partial:   { badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  Reviewed:  { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  Cancelled: { badge: 'bg-red-100 text-red-600',       dot: 'bg-red-400' },
};

const STEPS: POStatus[] = ['Draft', 'Ordered', 'Partial', 'Reviewed'];

// ── Send to Supplier Modal ────────────────────────────────────────────────────

function SendSupplierModal({ po, onClose, onSent, t }: {
  po: PurchaseOrder;
  onClose: () => void;
  onSent:  () => void;
  t:       TFunc;
}) {
  const [vendorEmail, setVendorEmail] = useState('');
  const dealershipId = getDealershipId() ?? '';

  const subject = encodeURIComponent(`PO ${po.id}`);
  const itemLines = (po.purchase_order_items ?? [])
    .map(i => `  • ${i.name}${i.article_number ? ` (art. ${i.article_number})` : ''} — ${i.quantity} × ${fmt(i.unit_cost)}`)
    .join('\n');

  const body = encodeURIComponent(
    `Hi,\n\nWe would like to order:\n\n${itemLines}\n\nTotal: ${fmt(po.total_cost)}\nRef: ${po.id}\n\nPlease confirm receipt and delivery date.\n\nBest regards`
  );

  const mailtoHref = vendorEmail
    ? `mailto:${vendorEmail}?subject=${subject}&body=${body}`
    : `mailto:?subject=${subject}&body=${body}`;

  async function markOrdered() {
    const res = await fetch(`/api/purchasing/orders/${po.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: 'Ordered' }),
    });
    if (res.ok) {
      onSent();
      toast.success(`${po.id} ${t('purchaseOrders.send.toastOrdered')}`);
    } else {
      toast.error(t('purchaseOrders.send.toastError'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">{t('purchaseOrders.send.title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{po.id} · {po.vendor}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        {/* Items preview */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
          {(po.purchase_order_items ?? []).map(i => (
            <div key={i.id} className="flex items-center justify-between text-xs">
              <div>
                <span className="font-medium text-slate-800">{i.name}</span>
                {i.article_number && <span className="ml-2 font-mono text-slate-400">{i.article_number}</span>}
              </div>
              <span className="text-slate-500 ml-4">{i.quantity} × {fmt(i.unit_cost)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-slate-200 text-xs font-bold">
            <span className="text-slate-600">{t('purchaseOrders.send.total')}</span>
            <span className="text-[#FF6B2C]">{fmt(po.total_cost)}</span>
          </div>
        </div>

        {/* Email input */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('purchaseOrders.send.emailLabel')}</label>
          <input value={vendorEmail} onChange={e => setVendorEmail(e.target.value)}
            placeholder={t('purchaseOrders.send.emailPlaceholder')}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]/60" />
        </div>

        {/* Options */}
        <div className="space-y-2">
          <a href={mailtoHref}
            onClick={() => setTimeout(markOrdered, 500)}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors">
            <span className="text-lg">📧</span>
            <div className="text-left">
              <p>{t('purchaseOrders.send.sendEmail')}</p>
              <p className="text-xs opacity-75 font-normal">{t('purchaseOrders.send.sendEmailDesc')}</p>
            </div>
          </a>

          <button onClick={() => { window.print(); setTimeout(markOrdered, 500); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors">
            <span className="text-lg">🖨</span>
            <div className="text-left">
              <p>{t('purchaseOrders.send.print')}</p>
              <p className="text-xs text-slate-400 font-normal">{t('purchaseOrders.send.printDesc')}</p>
            </div>
          </button>

          <button onClick={markOrdered}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors">
            <span className="text-lg">✓</span>
            <div className="text-left">
              <p>{t('purchaseOrders.send.markOrdered')}</p>
              <p className="text-xs text-slate-400 font-normal">{t('purchaseOrders.send.markOrderedDesc')}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Receive Goods Modal ────────────────────────────────────────────────────────

function ReceiveGoodsModal({ po, onClose, onReceived, t }: {
  po: PurchaseOrder;
  onClose:    () => void;
  onReceived: () => void;
  t:          TFunc;
}) {
  const dealershipId = getDealershipId() ?? '';
  const pendingItems = (po.purchase_order_items ?? []).filter(i => i.status !== 'received');
  const [checked, setChecked] = useState<Set<number>>(() => new Set(pendingItems.map(i => i.id)));
  const [saving,  setSaving]  = useState(false);

  const toggle = (id: number) =>
    setChecked(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  async function receive() {
    if (checked.size === 0) { toast.error(t('purchaseOrders.receive.toastSelect')); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/purchasing/orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, itemIds: [...checked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('purchaseOrders.receive.toastError'));
      toast.success(`${checked.size} ${t('purchaseOrders.receive.toastOk')}`);
      onReceived();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('purchaseOrders.receive.toastError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">{t('purchaseOrders.receive.title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{po.id} · {po.vendor}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        {pendingItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm font-medium">{t('purchaseOrders.receive.allReceived')}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500">{t('purchaseOrders.receive.instruction')}</p>
            <div className="space-y-2">
              {pendingItems.map(item => (
                <label key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    checked.has(item.id) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)}
                    className="w-4 h-4 accent-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    {item.article_number && (
                      <p className="text-[10px] font-mono text-slate-400">{item.article_number}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-700">{item.quantity}</p>
                    <p className="text-[10px] text-slate-400">{fmt(item.total_cost)}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setChecked(new Set(pendingItems.map(i => i.id)))}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                {t('purchaseOrders.receive.selectAll')}
              </button>
              <button onClick={() => setChecked(new Set())}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                {t('purchaseOrders.receive.clear')}
              </button>
              <div className="flex-1" />
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                {t('purchaseOrders.receive.cancel')}
              </button>
              <button onClick={receive} disabled={saving || checked.size === 0}
                className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                {saving
                  ? t('purchaseOrders.receive.saving')
                  : t('purchaseOrders.receive.confirmBtn').replace('{n}', String(checked.size))}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── ETA editor ────────────────────────────────────────────────────────────────

function ETACell({ po, dealershipId, onChange, t }: {
  po: PurchaseOrder; dealershipId: string; onChange: () => void; t: TFunc;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(po.eta ?? '');
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function save() {
    setEditing(false);
    if (val === (po.eta ?? '')) return;
    await fetch(`/api/purchasing/orders/${po.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, eta: val || null }),
    });
    onChange();
  }

  if (editing) return (
    <input ref={inputRef} type="date" value={val} onChange={e => setVal(e.target.value)}
      onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
      className="text-xs px-2 py-1 border border-[#FF6B2C] rounded-lg focus:outline-none" />
  );

  return (
    <button onClick={() => setEditing(true)} title={t('purchaseOrders.eta.tooltip')}
      className="group flex items-center gap-1 text-xs text-slate-500 hover:text-[#FF6B2C] transition-colors">
      {po.eta ? fmtDate(po.eta) : <span className="text-slate-300 italic">{t('purchaseOrders.eta.set')}</span>}
      <svg className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.94l-3.828.94.94-3.828a4 4 0 01.94-1.414z" />
      </svg>
    </button>
  );
}

// ── PO row (expandable) ───────────────────────────────────────────────────────

function PORow({ po, dealershipId, onRefresh, t }: {
  po: PurchaseOrder;
  dealershipId: string;
  onRefresh: () => void;
  t: TFunc;
}) {
  const [expanded,    setExpanded]   = useState(false);
  const [showSend,    setShowSend]   = useState(false);
  const [showReceive, setShowReceive]= useState(false);

  const cfg         = STATUS_BADGE[po.status] ?? STATUS_BADGE.Draft;
  const items       = po.purchase_order_items ?? [];
  const receivedCnt = items.filter(i => i.status === 'received').length;
  const allReceived = items.length > 0 && receivedCnt === items.length;
  const stepIdx     = STEPS.indexOf(po.status);

  const statusLabel = (s: POStatus) =>
    t(`purchaseOrders.status.${s}` as Parameters<typeof t>[0]);

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}>

        {/* PO ID */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[#0b1524] text-sm">{po.id}</span>
            {po.work_order_id && (
              <Link href={`/service/orders/${po.work_order_id}`} onClick={e => e.stopPropagation()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold hover:bg-orange-200 transition-colors">
                AO-{po.work_order_id}
              </Link>
            )}
          </div>
          {po.work_order && (
            <p className="text-[10px] text-slate-400 mt-0.5">{po.work_order.customer_name} · {po.work_order.vehicle_name}</p>
          )}
        </td>

        {/* Vendor */}
        <td className="px-4 py-3 text-sm text-slate-700 font-medium max-w-40 truncate">
          {po.vendor || <span className="text-slate-300">—</span>}
        </td>

        {/* Items count */}
        <td className="px-4 py-3">
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {t('purchaseOrders.itemsReceived').replace('{r}', String(receivedCnt)).replace('{t}', String(items.length))}
          </span>
        </td>

        {/* ETA */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <ETACell po={po} dealershipId={dealershipId} onChange={onRefresh} t={t} />
        </td>

        {/* Total */}
        <td className="px-4 py-3 font-bold text-slate-900 text-sm">
          {fmt(po.total_cost)}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {statusLabel(po.status)}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(po.status === 'Draft' || po.status === 'Ordered') && (
              <button onClick={() => setShowSend(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-all">
                {t('purchaseOrders.actions.send')}
              </button>
            )}
            {(po.status === 'Ordered' || po.status === 'Partial') && !allReceived && (
              <button onClick={() => setShowReceive(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-all">
                {t('purchaseOrders.actions.receive')}
              </button>
            )}
            {allReceived && (
              <span className="text-[10px] text-emerald-600 font-bold">{t('purchaseOrders.actions.done')}</span>
            )}
          </div>
        </td>

        {/* Expand chevron */}
        <td className="px-3 py-3 text-slate-400">
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="bg-slate-50/80">
          <td colSpan={8} className="px-6 py-4">
            {/* Progress pipeline */}
            <div className="flex items-center gap-0 mb-4">
              {STEPS.map((s, i) => {
                const done = stepIdx > i;
                const curr = stepIdx === i;
                const bc   = STATUS_BADGE[s];
                return (
                  <div key={s} className="flex items-center">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      done ? 'bg-emerald-100 text-emerald-700' :
                      curr ? bc.badge : 'bg-slate-100 text-slate-400'
                    }`}>
                      {done && <span>✓</span>}
                      {statusLabel(s)}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`h-0.5 w-6 mx-0.5 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Line items table */}
            {items.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {[
                        t('purchaseOrders.subTable.article'),
                        t('purchaseOrders.subTable.artNo'),
                        t('purchaseOrders.subTable.qty'),
                        t('purchaseOrders.subTable.unitPrice'),
                        t('purchaseOrders.subTable.total'),
                        t('purchaseOrders.subTable.status'),
                      ].map(col => (
                        <th key={col} className={`px-3 py-2 font-semibold text-slate-400 uppercase tracking-wide ${
                          col === t('purchaseOrders.subTable.qty') || col === t('purchaseOrders.subTable.unitPrice') || col === t('purchaseOrders.subTable.total') ? 'text-right' : col === t('purchaseOrders.subTable.status') ? 'text-center' : 'text-left'
                        }`}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2.5 font-medium text-slate-800">{item.name}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">{item.article_number || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{fmt(item.unit_cost)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{fmt(item.total_cost)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {item.status === 'received' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              {t('purchaseOrders.itemStatus.received')}{item.received_at ? ` · ${fmtDate(item.received_at)}` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                              {t('purchaseOrders.itemStatus.pending')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">{t('purchaseOrders.noItems')}</p>
            )}

            {po.notes && (
              <p className="text-xs text-slate-500 mt-3 italic">{t('purchaseOrders.notesLabel')} {po.notes}</p>
            )}
          </td>
        </tr>
      )}

      {/* Modals — rendered outside the table via portals would be ideal, but keeping inline for simplicity */}
      {showSend && (
        <tr><td colSpan={8}>
          <SendSupplierModal po={po} t={t} onClose={() => setShowSend(false)} onSent={() => { setShowSend(false); onRefresh(); }} />
        </td></tr>
      )}
      {showReceive && (
        <tr><td colSpan={8}>
          <ReceiveGoodsModal po={po} t={t} onClose={() => setShowReceive(false)} onReceived={() => { setShowReceive(false); onRefresh(); }} />
        </td></tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterTab = 'all' | POStatus;

export default function ServicePurchaseOrdersPage() {
  const router       = useRouter();
  const t            = useTranslations('service');
  const dealershipId = getDealershipId() ?? '';
  const [orders,  setOrders]  = useState<PurchaseOrder[]>([]);
  const [filter,  setFilter]  = useState<FilterTab>('all');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',       label: t('purchaseOrders.tabs.all') },
    { id: 'Draft',     label: t('purchaseOrders.tabs.Draft') },
    { id: 'Ordered',   label: t('purchaseOrders.tabs.Ordered') },
    { id: 'Partial',   label: t('purchaseOrders.tabs.Partial') },
    { id: 'Reviewed',  label: t('purchaseOrders.tabs.Reviewed') },
    { id: 'Cancelled', label: t('purchaseOrders.tabs.Cancelled') },
  ];

  const load = useCallback(async () => {
    if (!dealershipId) return;
    try {
      const res  = await fetch(`/api/purchasing/orders?dealershipId=${encodeURIComponent(dealershipId)}`);
      const data = await res.json() as { orders?: PurchaseOrder[] };

      const servicePOs = (data.orders ?? []).filter(o => o.work_order_id != null);

      const woIds = [...new Set(servicePOs.map(o => o.work_order_id).filter(Boolean))] as number[];
      if (woIds.length > 0) {
        const woRes = await fetch(
          `/api/service/orders?dealershipId=${encodeURIComponent(dealershipId)}&ids=${woIds.join(',')}`
        ).catch(() => null);
        if (woRes?.ok) {
          const woData = await woRes.json() as { orders?: { id: number; customer_name: string; vehicle_name: string }[] };
          const woMap: Record<number, { customer_name: string; vehicle_name: string }> = {};
          (woData.orders ?? []).forEach(w => { woMap[w.id] = { customer_name: w.customer_name, vehicle_name: w.vehicle_name }; });
          servicePOs.forEach(po => {
            if (po.work_order_id && woMap[po.work_order_id]) {
              po.work_order = woMap[po.work_order_id];
            }
          });
        }
      }

      setOrders(servicePOs);
    } finally {
      setLoading(false);
    }
  }, [dealershipId]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/auth/login'); return; }
    load();
  }, [load, router]);

  useAutoRefresh(load);

  const visible = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const items = o.purchase_order_items ?? [];
      return (
        o.id.toLowerCase().includes(q) ||
        o.vendor.toLowerCase().includes(q) ||
        String(o.work_order_id).includes(q) ||
        items.some(i => i.name.toLowerCase().includes(q) || i.article_number.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const stats = {
    total:   orders.length,
    active:  orders.filter(o => o.status === 'Ordered' || o.status === 'Partial').length,
    waiting: orders.filter(o => o.status === 'Draft').length,
    done:    orders.filter(o => o.status === 'Reviewed').length,
  };

  const howItWorksSteps = [
    { icon: '🔧', step: t('purchaseOrders.howItWorks.steps.0.title' as Parameters<typeof t>[0]), desc: t('purchaseOrders.howItWorks.steps.0.desc' as Parameters<typeof t>[0]) },
    { icon: '📋', step: t('purchaseOrders.howItWorks.steps.1.title' as Parameters<typeof t>[0]), desc: t('purchaseOrders.howItWorks.steps.1.desc' as Parameters<typeof t>[0]) },
    { icon: '📧', step: t('purchaseOrders.howItWorks.steps.2.title' as Parameters<typeof t>[0]), desc: t('purchaseOrders.howItWorks.steps.2.desc' as Parameters<typeof t>[0]) },
    { icon: '📦', step: t('purchaseOrders.howItWorks.steps.3.title' as Parameters<typeof t>[0]), desc: t('purchaseOrders.howItWorks.steps.3.desc' as Parameters<typeof t>[0]) },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{t('purchaseOrders.section')}</p>
          <h1 className="text-2xl font-black text-[#0b1524]">{t('purchaseOrders.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('purchaseOrders.subtitle')}</p>
        </div>

        <div className="flex-1 px-5 md:px-8 py-6 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('purchaseOrders.stats.total'),   value: stats.total,   icon: '📦', color: 'text-slate-700' },
              { label: t('purchaseOrders.stats.active'),  value: stats.active,  icon: '🚚', color: 'text-blue-600' },
              { label: t('purchaseOrders.stats.waiting'), value: stats.waiting, icon: '⏳', color: 'text-amber-600' },
              { label: t('purchaseOrders.stats.done'),    value: stats.done,    icon: '✅', color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* How it works banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">{t('purchaseOrders.howItWorks.title')}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {howItWorksSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                  <div>
                    <p className="text-xs font-bold text-blue-900">{s.icon} {s.step}</p>
                    <p className="text-[10px] text-blue-600 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table card */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">

            {/* Tabs + search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1 flex-wrap">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filter === tab.id ? 'bg-[#FF6B2C] text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}>
                    {tab.label}
                    <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded-full font-bold ${
                      filter === tab.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tab.id === 'all' ? orders.length : orders.filter(o => o.status === tab.id).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-56">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('purchaseOrders.searchPlaceholder')}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]/50" />
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="py-16 flex items-center justify-center text-slate-400">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-[#FF6B2C] rounded-full animate-spin mr-2" />
                {t('purchaseOrders.loading')}
              </div>
            ) : visible.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                <span className="text-4xl">📦</span>
                <p className="text-sm font-semibold">
                  {orders.length === 0 ? t('purchaseOrders.noOrders') : t('purchaseOrders.noResults')}
                </p>
                {orders.length === 0 && (
                  <p className="text-xs text-center max-w-xs text-slate-300">
                    {t('purchaseOrders.noOrdersHint')}
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {[
                        t('purchaseOrders.table.order'),
                        t('purchaseOrders.table.vendor'),
                        t('purchaseOrders.table.items'),
                        t('purchaseOrders.table.eta'),
                        t('purchaseOrders.table.total'),
                        t('purchaseOrders.table.status'),
                        t('purchaseOrders.table.actions'),
                        '',
                      ].map((col, i) => (
                        <th key={i} className="px-4 py-3 text-left font-semibold text-slate-400 uppercase tracking-wide text-[10px] whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(po => (
                      <PORow key={po.id} po={po} dealershipId={dealershipId} onRefresh={load} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Back link */}
          <div className="text-center">
            <Link href="/service" className="text-xs text-slate-400 hover:text-[#FF6B2C] transition-colors">
              {t('purchaseOrders.backToService')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
