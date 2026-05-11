'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { getCustomers, type Customer } from '@/lib/customers';

interface Communication {
  id: number; channel: 'email' | 'sms'; direction: string;
  subject: string | null; body: string; status: string; error_message: string | null;
  recipient_name: string | null; recipient_email: string | null; recipient_phone: string | null;
  sent_by: string | null; customer_id: number | null; created_at: string;
}

const CHANNEL_BADGE: Record<string, string> = {
  email: 'bg-blue-100 text-blue-700',
  sms:   'bg-purple-100 text-purple-700',
};
const STATUS_BADGE: Record<string, string> = {
  sent:    'bg-emerald-100 text-emerald-700',
  failed:  'bg-red-100 text-red-600',
  pending: 'bg-amber-100 text-amber-700',
};

const inp = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 bg-white dark:bg-slate-700 dark:text-white';

export default function ServiceCommunicationsPage() {
  const router = useRouter();
  const t = useTranslations('service');

  const [comms,       setComms]       = useState<Communication[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [expanded,    setExpanded]    = useState<number | null>(null);

  // Compose form
  const [composeForm, setComposeForm] = useState({
    channel: 'email' as 'email' | 'sms',
    recipientName: '', recipientEmail: '', recipientPhone: '',
    subject: '', message: '',
  });
  const [custSearch,   setCustSearch]   = useState('');
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [sending,      setSending]      = useState(false);

  const loadComms = useCallback(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/communications/list?dealershipId=${encodeURIComponent(dealershipId)}`);
      if (res.ok) {
        const json = await res.json() as { communications: Communication[] };
        // Exclude payment-page messages — those belong on the lead/sales detail page
        const serviceOnly = (json.communications ?? []).filter(c => c.sent_by !== 'payment-page');
        setComms(serviceOnly);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    loadComms();
    getCustomers().then(setCustomers);
  }, [router, loadComms]);

  const filteredCustomers = custSearch.trim().length > 1
    ? customers.filter(c => `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase().includes(custSearch.toLowerCase())).slice(0, 5)
    : [];

  function pickCustomer(c: Customer) {
    setSelectedCust(c); setCustSearch('');
    setComposeForm(f => ({
      ...f,
      recipientName:  `${c.firstName} ${c.lastName}`,
      recipientEmail: c.email  ?? '',
      recipientPhone: c.phone  ?? '',
    }));
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setSending(true);
    try {
      const res = await fetch('/api/communications/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId,
          channel:        composeForm.channel,
          customerId:     selectedCust?.id ?? null,
          recipientName:  composeForm.recipientName,
          recipientEmail: composeForm.recipientEmail || undefined,
          recipientPhone: composeForm.recipientPhone || undefined,
          subject:        composeForm.subject || undefined,
          message:        composeForm.message,
          sentBy:         JSON.parse(localStorage.getItem('user') ?? '{}').name ?? 'staff',
        }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (json.ok) {
        toast.success(t('comms.sent'));
        setShowCompose(false);
        setComposeForm({ channel: 'email', recipientName: '', recipientEmail: '', recipientPhone: '', subject: '', message: '' });
        setSelectedCust(null);
        loadComms();
      } else {
        toast.error(json.error ?? t('comms.sendError'));
      }
    } finally { setSending(false); }
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa] dark:bg-slate-900">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-5 md:px-8 py-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>›</span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">{t('comms.title')}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524] dark:text-white">{t('comms.title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('comms.subtitle')}</p>
            </div>
            <button
              onClick={() => setShowCompose(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55a1f] transition-colors shadow-md shadow-[#FF6B2C]/30"
            >
              <span>✉</span> {t('comms.compose')}
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-8 max-w-4xl space-y-6">

          {/* Compose panel */}
          {showCompose && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-[#FF6B2C]/30 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">✉ {t('comms.newMessage')}</h2>
                <button onClick={() => setShowCompose(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
              </div>

              <form onSubmit={handleSend} className="space-y-4">
                {/* Channel toggle */}
                <div className="flex gap-2">
                  {(['email', 'sms'] as const).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setComposeForm(f => ({ ...f, channel: ch }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${composeForm.channel === ch ? 'bg-[#FF6B2C] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      {ch === 'email' ? '📧 Email' : '💬 SMS'}
                    </button>
                  ))}
                </div>

                {/* Customer search */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('comms.searchCustomer')}</label>
                  <input
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    placeholder={t('comms.searchPlaceholder')}
                    className={inp}
                  />
                  {filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg z-10 divide-y divide-slate-50 dark:divide-slate-700">
                      {filteredCustomers.map(c => (
                        <button key={c.id} type="button" onClick={() => pickCustomer(c)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-slate-400">{c.email} · {c.phone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedCust && (
                    <div className="mt-2 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-2 rounded-lg">
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">✓ {selectedCust.firstName} {selectedCust.lastName}</span>
                      <button type="button" onClick={() => { setSelectedCust(null); setComposeForm(f => ({ ...f, recipientName: '', recipientEmail: '', recipientPhone: '' })); }} className="ml-auto text-slate-400 hover:text-red-400">✕</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('comms.recipientName')}</label>
                    <input value={composeForm.recipientName} onChange={e => setComposeForm(f => ({ ...f, recipientName: e.target.value }))} className={inp} placeholder={t('comms.namePlaceholder')} />
                  </div>
                  {composeForm.channel === 'email' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('comms.email')}</label>
                      <input type="email" value={composeForm.recipientEmail} onChange={e => setComposeForm(f => ({ ...f, recipientEmail: e.target.value }))} className={inp} placeholder="email@example.com" required />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('comms.phone')}</label>
                      <input type="tel" value={composeForm.recipientPhone} onChange={e => setComposeForm(f => ({ ...f, recipientPhone: e.target.value }))} className={inp} placeholder="+46..." required />
                    </div>
                  )}
                </div>

                {composeForm.channel === 'email' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('comms.subject')}</label>
                    <input value={composeForm.subject} onChange={e => setComposeForm(f => ({ ...f, subject: e.target.value }))} className={inp} placeholder={t('comms.subjectPlaceholder')} />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{t('comms.message')}</label>
                  <textarea value={composeForm.message} onChange={e => setComposeForm(f => ({ ...f, message: e.target.value }))} rows={4}
                    placeholder={t('comms.messagePlaceholder')} required
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 resize-none bg-white dark:bg-slate-700 dark:text-white" />
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowCompose(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    {t('comms.cancel')}
                  </button>
                  <button type="submit" disabled={sending || !composeForm.message}
                    className="px-6 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55a1f] transition-colors disabled:opacity-50">
                    {sending ? t('comms.sending') : t('comms.send')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Auto-email info banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-2xl mt-0.5">🤖</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-800 dark:text-blue-300">{t('comms.autoTitle')}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 leading-relaxed">{t('comms.autoDesc')}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 border-t border-blue-200 dark:border-blue-700 pt-2">
                💳 {t('comms.paymentNote')}
              </p>
            </div>
          </div>

          {/* Communications log */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('comms.log')}</h2>
              <span className="text-xs text-slate-400">{comms.length} {t('comms.messages')}</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-400">{t('common.loading')}</div>
            ) : comms.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-3">📭</div>
                <p className="text-sm text-slate-400">{t('comms.empty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {comms.map(c => (
                  <div key={c.id} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm shrink-0 mt-0.5">
                        {c.channel === 'email' ? '📧' : '💬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {c.recipient_name ?? c.recipient_email ?? c.recipient_phone ?? '—'}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${CHANNEL_BADGE[c.channel] ?? 'bg-slate-100 text-slate-500'}`}>
                            {c.channel.toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[c.status] ?? 'bg-slate-100 text-slate-500'}`}>
                            {c.status}
                          </span>
                          {c.sent_by === 'system' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-600">🤖 {t('comms.auto')}</span>
                          )}
                        </div>
                        {c.subject && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{c.subject}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(c.created_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
                          {c.sent_by && c.sent_by !== 'system' && ` · ${c.sent_by}`}
                        </p>
                      </div>
                      <span className="text-slate-300 dark:text-slate-600 text-xs mt-1">{expanded === c.id ? '▲' : '▼'}</span>
                    </div>

                    {expanded === c.id && (
                      <div className="mt-3 ml-11 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                        {c.subject && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{c.subject}</p>}
                        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                        {c.error_message && (
                          <p className="text-xs text-red-500 mt-2 border-t border-red-100 pt-2">⚠ {c.error_message}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
