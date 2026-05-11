'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { getCustomers, type Customer } from '@/lib/customers';

// ── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id:            string;
  name:          string;
  article_number:string;
  stock:         number;
  selling_price: number;
  item_type:     'spare_part' | 'accessory';
  category?:     string;
  size?:         string;
  vendor?:       string;
}

interface CartLine {
  itemId:      string;
  name:        string;
  partNumber:  string;
  qty:         number;
  unitPrice:   number;
  discountPct: number;
}

interface ReceiptData {
  id:            string;
  customerName:  string;
  lines:         CartLine[];
  subtotal:      number;
  cartDiscount:  number;
  finalTotal:    number;
  net:           number;
  vat:           number;
  paymentMethod: string;
  paymentLabel:  string;
  note:          string;
  createdAt:     string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const VAT_RATE = 0.25;

// ── Helpers ──────────────────────────────────────────────────────────────────

function lineNet(l: CartLine)   { return l.qty * l.unitPrice * (1 - l.discountPct / 100); }
function krFmt(n: number)       { return n.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr'; }
function dateFmt(iso: string)   { return new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

function breakdown(finalTotal: number) {
  const net = Math.round((finalTotal / (1 + VAT_RATE)) * 100) / 100;
  const vat = Math.round((finalTotal - net) * 100) / 100;
  return { net, vat };
}

// ── Receipt modal ─────────────────────────────────────────────────────────────

function ReceiptModal({ data, onClose, onNew }: { data: ReceiptData; onClose: () => void; onNew: () => void }) {
  const t = useTranslations('counterSale');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-black text-slate-900">{t('receiptTitle', { id: data.id })}</p>
              <p className="text-xs text-slate-400">{dateFmt(data.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">✕</button>
        </div>

        {/* Receipt body — print-friendly */}
        <div id="receipt-print" className="px-6 py-5 space-y-4">
          {/* Customer */}
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">{t('receiptCustomer')}</span>
            <span className="font-semibold text-slate-900">{data.customerName}</span>
          </div>

          {/* Items */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-slate-400 font-semibold px-3 py-2">{t('receiptColItem')}</th>
                  <th className="text-center text-slate-400 font-semibold px-2 py-2">{t('receiptColQty')}</th>
                  <th className="text-right text-slate-400 font-semibold px-3 py-2">{t('receiptColTotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.lines.map(l => {
                  const total = lineNet(l);
                  return (
                    <tr key={l.itemId}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-900 leading-tight">{l.name}</p>
                        <p className="text-slate-400 text-[10px]">
                          {krFmt(l.unitPrice)} {t('perUnit')}
                          {l.discountPct > 0 ? ` · ${l.discountPct}% ${t('receiptVat').includes('%') ? 'rabatt' : 'discount'}` : ''}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-center text-slate-700 font-semibold">{l.qty}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">{krFmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>{t('subtotal')}</span><span className="font-semibold">{krFmt(data.subtotal)}</span>
            </div>
            {data.cartDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{t('receiptOrderDiscount')}</span><span className="font-semibold">− {krFmt(data.cartDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>{t('receiptNet')}</span><span className="font-semibold">{krFmt(data.net)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t('receiptVat')}</span><span className="font-semibold">{krFmt(data.vat)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>{t('receiptTotal')}</span><span className="text-[#FF6B2C]">{krFmt(data.finalTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px] pt-0.5">
              <span>{t('receiptPayment')}</span>
              <span className="font-semibold">{data.paymentLabel}</span>
            </div>
          </div>

          {data.note && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{t('receiptNote')}</span>{data.note}
            </div>
          )}

          <p className="text-center text-xs text-slate-300 pt-1">{t('receiptThanks')}</p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
          >
            🖨️ {t('print')}
          </button>
          <button
            onClick={onNew}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors"
            style={{ background: '#FF6B2C' }}
          >
            {t('newSale')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CounterSalePage() {
  const router = useRouter();
  const t = useTranslations('counterSale');
  const dealershipId = getDealershipId();

  const PAYMENT_OPTIONS = [
    { key: 'card',  label: t('payCard'),  icon: '💳' },
    { key: 'cash',  label: t('payCash'),  icon: '💵' },
    { key: 'swish', label: t('paySwish'), icon: '📱' },
  ];

  // ── Item search ─────────────────────────────────────────────────────────────
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<InventoryItem[]>([]);
  const [searching,   setSearching]   = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchItems = useCallback(async (q: string) => {
    if (q.length < 2 || !dealershipId) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const res  = await fetch(`/api/service/spare-parts?dealershipId=${dealershipId}&q=${encodeURIComponent(q)}`);
      const json = await res.json() as { results: InventoryItem[] };
      setSuggestions(json.results ?? []);
    } finally {
      setSearching(false);
    }
  }, [dealershipId]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => void searchItems(query), 260);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, searchItems]);

  // ── Cart ────────────────────────────────────────────────────────────────────
  const [cart,        setCart]        = useState<CartLine[]>([]);
  const [expandedLine,setExpandedLine]= useState<string | null>(null);

  function addToCart(item: InventoryItem) {
    setCart(prev => {
      const existing = prev.find(l => l.itemId === item.id);
      if (existing) return prev.map(l => l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { itemId: item.id, name: item.name, partNumber: item.article_number, qty: 1, unitPrice: item.selling_price, discountPct: 0 }];
    });
    setQuery('');
    setSuggestions([]);
    searchInputRef.current?.focus();
  }

  function updateQty(itemId: string, delta: number) {
    setCart(prev => prev.map(l => l.itemId === itemId ? { ...l, qty: Math.max(1, l.qty + delta) } : l));
  }

  function setDiscount(itemId: string, pct: number) {
    const clamped = Math.min(100, Math.max(0, pct));
    setCart(prev => prev.map(l => l.itemId === itemId ? { ...l, discountPct: clamped } : l));
  }

  function removeLine(itemId: string) {
    setCart(prev => prev.filter(l => l.itemId !== itemId));
    if (expandedLine === itemId) setExpandedLine(null);
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && suggestions.length > 0) addToCart(suggestions[0]);
    if (e.key === 'Escape') { setQuery(''); setSuggestions([]); }
  }

  // ── Discount ────────────────────────────────────────────────────────────────
  const [showCartDiscount,  setShowCartDiscount]  = useState(false);
  const [cartDiscountType,  setCartDiscountType]  = useState<'pct' | 'fixed'>('pct');
  const [cartDiscountValue, setCartDiscountValue] = useState('');

  const subtotal = cart.reduce((s, l) => s + lineNet(l), 0);
  const cartDiscountAmt = (() => {
    const v = parseFloat(cartDiscountValue) || 0;
    if (v <= 0) return 0;
    if (cartDiscountType === 'pct') return Math.min(subtotal, subtotal * v / 100);
    return Math.min(subtotal, v);
  })();
  const finalTotal = subtotal - cartDiscountAmt;
  const { net, vat } = breakdown(finalTotal);

  // ── Customer ────────────────────────────────────────────────────────────────
  const [customers,        setCustomers]        = useState<Customer[]>([]);
  const [custQuery,        setCustQuery]        = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [walkInName,       setWalkInName]       = useState('');

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    getCustomers().then(setCustomers);
  }, [router]);

  const custResults = custQuery.length >= 2
    ? customers.filter(c =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(custQuery.toLowerCase()) ||
        c.phone.includes(custQuery)
      ).slice(0, 5)
    : [];

  // ── Payment + note ──────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [note,          setNote]          = useState('');

  // ── Submit ──────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [receipt,    setReceipt]    = useState<ReceiptData | null>(null);

  async function handleSell() {
    if (!cart.length) { toast.error(t('toastAddItems')); return; }
    if (!dealershipId) { toast.error(t('toastNotLoggedIn')); return; }

    const customerName = selectedCustomer
      ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
      : walkInName.trim() || 'Gångkund';

    const paymentLabel = PAYMENT_OPTIONS.find(p => p.key === paymentMethod)?.label ?? paymentMethod;

    setSubmitting(true);
    try {
      const res = await fetch('/api/counter-sale', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          dealershipId,
          customerName,
          customerId:   selectedCustomer?.id ?? null,
          note,
          items: cart.map(l => ({
            name:         l.name,
            quantity:     l.qty,
            unit_cost:    l.unitPrice * (1 - l.discountPct / 100),
            total_cost:   lineNet(l),
            part_number:  l.partNumber,
            discount_pct: l.discountPct,
          })),
          cartDiscount:  cartDiscountAmt,
          paymentMethod,
          totalAmount:   finalTotal,
          vatAmount:     vat,
          netAmount:     net,
        }),
      });
      const json = await res.json() as { invoice?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? t('toastError'));

      setReceipt({
        id:           json.invoice!.id,
        customerName,
        lines:        [...cart],
        subtotal,
        cartDiscount: cartDiscountAmt,
        finalTotal,
        net,
        vat,
        paymentMethod,
        paymentLabel,
        note,
        createdAt:    new Date().toISOString(),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('toastError'));
    } finally {
      setSubmitting(false);
    }
  }

  function resetSale() {
    setCart([]);
    setSelectedCustomer(null);
    setWalkInName('');
    setNote('');
    setCartDiscountValue('');
    setShowCartDiscount(false);
    setReceipt(null);
    searchInputRef.current?.focus();
  }

  const hasLineDiscounts = cart.some(l => l.discountPct > 0);
  const totalItemCount   = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <>
      {receipt && (
        <ReceiptModal
          data={receipt}
          onClose={() => setReceipt(null)}
          onNew={resetSale}
        />
      )}

      <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />

        <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
          <div className="brand-top-bar" />

          {/* Header */}
          <div className="px-5 md:px-8 py-5 bg-white border-b border-slate-100">
            <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
              <Link href="/sales/leads" className="hover:text-[#FF6B2C]">{t('breadcrumb')}</Link>
              <span>›</span>
              <span className="text-slate-700 font-medium">{t('title')}</span>
            </nav>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-black text-[#0b1524]">{t('title')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{t('subtitle')}</p>
              </div>
              <Link
                href="/invoices"
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('viewReceipts')}
              </Link>
            </div>
          </div>

          <div className="flex-1 px-5 md:px-8 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

              {/* ── LEFT ──────────────────────────────────────────────────── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Search */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-900">{t('searchTitle')}</h2>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{t('searchHint')}</span>
                  </div>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={handleSearchKey}
                      placeholder={t('searchPlaceholder')}
                      className="w-full pl-9 pr-10 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]"
                      autoFocus
                    />
                    {searching
                      ? <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-200 border-t-[#FF6B2C] rounded-full animate-spin" />
                      : query.length > 0 && (
                        <button onClick={() => { setQuery(''); setSuggestions([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">✕</button>
                      )
                    }
                  </div>

                  {suggestions.length > 0 && (
                    <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 shadow-sm">
                      {suggestions.map((item, i) => (
                        <button
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className={`w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50 transition-colors text-left ${i === 0 ? 'bg-slate-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl shrink-0">{item.item_type === 'accessory' ? '🧤' : '🔩'}</span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 leading-tight">{item.name}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {item.article_number}
                                {item.size     ? ` · ${item.size}`     : ''}
                                {item.category ? ` · ${item.category}` : ''}
                                {item.vendor   ? ` · ${item.vendor}`   : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm font-black text-slate-900">{krFmt(item.selling_price)}</p>
                            <p className={`text-[10px] font-semibold ${item.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {item.stock > 0 ? t('inStock', { n: item.stock }) : t('outOfStock')}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {query.length >= 2 && !searching && suggestions.length === 0 && (
                    <p className="mt-3 text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-xl">
                      {t('noResults', { q: query })}
                    </p>
                  )}
                </div>

                {/* Cart */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900">{t('cartTitle')}</h2>
                      {cart.length > 0 && (
                        <span className="text-[10px] font-bold bg-[#FF6B2C] text-white px-1.5 py-0.5 rounded-full">
                          {totalItemCount}
                        </span>
                      )}
                    </div>
                    {cart.length > 0 && (
                      <button onClick={() => { setCart([]); setExpandedLine(null); }} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                        {t('clearAll')}
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">🛒</div>
                      <p className="text-sm font-semibold text-slate-400">{t('cartEmpty')}</p>
                      <p className="text-xs text-slate-300 mt-1">{t('cartEmptyHint')}</p>
                    </div>
                  ) : (
                    <div>
                      {/* Table header */}
                      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center border-b border-slate-50 bg-slate-50 px-5 py-2 gap-4">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t('colItem')}</span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-20 text-center">{t('colQty')}</span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-24 text-right">{t('colPrice')}</span>
                        <span className="w-6" />
                      </div>

                      {/* Lines */}
                      <div className="divide-y divide-slate-50">
                        {cart.map(line => {
                          const discountedUnit = line.unitPrice * (1 - line.discountPct / 100);
                          const lineTotal      = line.qty * discountedUnit;
                          const isExpanded     = expandedLine === line.itemId;

                          return (
                            <div key={line.itemId} className="group">
                              {/* Main row */}
                              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-5 py-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                {/* Name + discount toggle */}
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 leading-tight">{line.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {line.partNumber && <span className="text-[10px] text-slate-400">{line.partNumber}</span>}
                                    <button
                                      onClick={() => setExpandedLine(isExpanded ? null : line.itemId)}
                                      className={`text-[10px] font-semibold transition-colors ${
                                        line.discountPct > 0
                                          ? 'text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full'
                                          : 'text-slate-300 hover:text-[#FF6B2C]'
                                      }`}
                                    >
                                      {line.discountPct > 0 ? t('lineDiscount', { pct: line.discountPct }) : t('addDiscount')}
                                    </button>
                                  </div>
                                </div>

                                {/* Qty stepper */}
                                <div className="flex items-center gap-1.5 w-20 justify-center">
                                  <button
                                    onClick={() => updateQty(line.itemId, -1)}
                                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm transition-colors"
                                  >−</button>
                                  <span className="text-sm font-bold text-slate-900 w-5 text-center">{line.qty}</span>
                                  <button
                                    onClick={() => updateQty(line.itemId, +1)}
                                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm transition-colors"
                                  >+</button>
                                </div>

                                {/* Price */}
                                <div className="text-right w-24">
                                  <p className="text-sm font-black text-slate-900">{krFmt(lineTotal)}</p>
                                  {line.discountPct > 0 && (
                                    <p className="text-[10px] text-slate-400 line-through">{krFmt(line.qty * line.unitPrice)}</p>
                                  )}
                                  {line.qty > 1 && line.discountPct === 0 && (
                                    <p className="text-[10px] text-slate-400">{krFmt(line.unitPrice)} {t('perUnit')}</p>
                                  )}
                                </div>

                                {/* Remove */}
                                <button
                                  onClick={() => removeLine(line.itemId)}
                                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              {/* Expandable discount panel */}
                              {isExpanded && (
                                <div className="px-5 pb-3 bg-orange-50/50 border-t border-orange-100/60">
                                  <p className="text-[11px] text-slate-500 font-semibold mt-2 mb-2">{t('discountOn', { name: line.name })}</p>
                                  <div className="flex items-center gap-2">
                                    {[0, 5, 10, 15, 20, 25, 30].map(pct => (
                                      <button
                                        key={pct}
                                        onClick={() => { setDiscount(line.itemId, pct); if (pct === 0) setExpandedLine(null); }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                          line.discountPct === pct
                                            ? 'bg-[#FF6B2C] text-white'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:border-[#FF6B2C] hover:text-[#FF6B2C]'
                                        }`}
                                      >
                                        {pct === 0 ? t('noDiscount') : `${pct}%`}
                                      </button>
                                    ))}
                                    <div className="flex items-center gap-1 ml-auto">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={line.discountPct || ''}
                                        onChange={e => setDiscount(line.itemId, parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-14 px-2 py-1 text-xs border border-slate-200 rounded-lg text-center focus:outline-none focus:border-[#FF6B2C]"
                                      />
                                      <span className="text-xs text-slate-400">%</span>
                                    </div>
                                  </div>
                                  {line.discountPct > 0 && (
                                    <p className="text-[11px] text-emerald-600 mt-2 font-semibold">
                                      {t('saving', { amount: krFmt(line.qty * line.unitPrice * line.discountPct / 100) })}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Cart discount row */}
                      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                        {!showCartDiscount ? (
                          <button
                            onClick={() => setShowCartDiscount(true)}
                            className="text-xs font-semibold text-slate-400 hover:text-[#FF6B2C] transition-colors flex items-center gap-1"
                          >
                            {t('addOrderDiscount')}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-700">{t('orderDiscount')}</p>
                              <button onClick={() => { setShowCartDiscount(false); setCartDiscountValue(''); }} className="text-xs text-slate-400 hover:text-red-500">{t('removeDiscount')}</button>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setCartDiscountType('pct')}
                                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${cartDiscountType === 'pct' ? 'bg-[#FF6B2C] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                  %
                                </button>
                                <button
                                  onClick={() => setCartDiscountType('fixed')}
                                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${cartDiscountType === 'fixed' ? 'bg-[#FF6B2C] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                  kr
                                </button>
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={cartDiscountValue}
                                onChange={e => setCartDiscountValue(e.target.value)}
                                placeholder={cartDiscountType === 'pct' ? 'ex. 10' : 'ex. 500'}
                                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#FF6B2C]"
                              />
                              {cartDiscountAmt > 0 && (
                                <span className="text-xs font-bold text-emerald-600 shrink-0">= − {krFmt(cartDiscountAmt)}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Totals */}
                      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 space-y-1.5">
                        {hasLineDiscounts && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>{t('originalPrice')}</span>
                            <span className="font-semibold line-through text-slate-400">{krFmt(cart.reduce((s, l) => s + l.qty * l.unitPrice, 0))}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{hasLineDiscounts || cartDiscountAmt > 0 ? t('subtotalAfter') : t('subtotal')}</span>
                          <span className="font-semibold">{krFmt(subtotal)}</span>
                        </div>
                        {cartDiscountAmt > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600">
                            <span>{t('orderDiscount')}</span>
                            <span className="font-semibold">− {krFmt(cartDiscountAmt)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{t('net')}</span>
                          <span className="font-semibold">{krFmt(net)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{t('vat25')}</span>
                          <span className="font-semibold">{krFmt(vat)}</span>
                        </div>
                        <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                          <span>{t('totalToPay')}</span>
                          <span className="text-[#FF6B2C]">{krFmt(finalTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-2">{t('notesTitle')}</h2>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={t('notesPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]"
                  />
                </div>
              </div>

              {/* ── RIGHT ─────────────────────────────────────────────────── */}
              <div className="space-y-4 lg:sticky lg:top-6">

                {/* Customer */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3">{t('customerTitle')}</h2>

                  {selectedCustomer ? (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-[#FF6B2C]/20 flex items-center justify-center text-sm font-bold text-[#FF6B2C] shrink-0">
                        {selectedCustomer.firstName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {selectedCustomer.firstName} {selectedCustomer.lastName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{selectedCustomer.phone}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedCustomer(null); setCustQuery(''); }}
                        className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
                        <input
                          value={custQuery}
                          onChange={e => setCustQuery(e.target.value)}
                          placeholder={t('customerSearch')}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]"
                        />
                        {custResults.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl overflow-hidden shadow-lg divide-y divide-slate-50">
                            {custResults.map(c => (
                              <button
                                key={c.id}
                                onClick={() => { setSelectedCustomer(c); setCustQuery(''); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                              >
                                <div className="w-7 h-7 rounded-full bg-[#FF6B2C]/15 flex items-center justify-center text-xs font-bold text-[#FF6B2C] shrink-0">
                                  {c.firstName[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{c.firstName} {c.lastName}</p>
                                  <p className="text-xs text-slate-400">{c.phone}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2"><div className="flex-1 h-px bg-slate-100"/><span className="text-[10px] text-slate-400 uppercase tracking-wider">{t('walkIn')}</span><div className="flex-1 h-px bg-slate-100"/></div>
                      <input
                        value={walkInName}
                        onChange={e => setWalkInName(e.target.value)}
                        placeholder={t('walkInName')}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]"
                      />
                    </div>
                  )}
                </div>

                {/* Payment */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3">{t('paymentTitle')}</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setPaymentMethod(opt.key)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                          paymentMethod === opt.key
                            ? 'border-[#FF6B2C] bg-[#FF6B2C]/5 text-slate-900'
                            : 'border-slate-100 hover:border-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <span className="text-[11px] font-semibold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary + CTA */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="space-y-1.5 mb-5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{t('items', { count: totalItemCount })}</span>
                      <span>{krFmt(net)} {t('netSuffix')}</span>
                    </div>
                    {(hasLineDiscounts || cartDiscountAmt > 0) && (
                      <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                        <span>{t('totalSaving')}</span>
                        <span>− {krFmt(cart.reduce((s,l) => s + l.qty * l.unitPrice, 0) - finalTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-slate-900 pt-1.5 border-t border-slate-100">
                      <span>{t('toPay')}</span>
                      <span className="text-[#FF6B2C]">{krFmt(finalTotal)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSell}
                    disabled={submitting || cart.length === 0}
                    className="w-full py-4 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    style={{ background: cart.length > 0 ? '#FF6B2C' : '#e2e8f0' }}
                  >
                    {submitting
                      ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>{t('creating')}</span>
                      : cart.length === 0
                        ? t('addItems')
                        : t('complete', { amount: krFmt(finalTotal) })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
