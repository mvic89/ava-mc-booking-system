'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';

interface Survey {
  id:              number;
  token:           string;
  recipient_name:  string;
  recipient_email: string;
  score:           number | null;
  comment:         string | null;
  sent_at:         string;
  responded_at:    string | null;
  expires_at:      string;
  lead_id:         number | null;
}

function scoreClass(s: number) {
  if (s <= 6) return 'bg-red-100 text-red-700';
  if (s <= 8) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function computeNps(surveys: Survey[]) {
  const responded = surveys.filter(s => s.score !== null && s.score !== undefined);
  if (responded.length === 0) return null;
  const promoters  = responded.filter(s => (s.score ?? 0) >= 9).length;
  const detractors = responded.filter(s => (s.score ?? 0) <= 6).length;
  return Math.round(((promoters - detractors) / responded.length) * 100);
}

// ─── Send Survey Modal ─────────────────────────────────────────────────────────
interface SendModalProps {
  dealershipId: string;
  onClose: () => void;
  onSent: () => void;
}

function SendModal({ dealershipId, onClose, onSent }: SendModalProps) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [leadId,  setLeadId]  = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const res = await fetch('/api/nps/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, recipientName: name, recipientEmail: email, leadId: leadId ? parseInt(leadId) : undefined }),
    });
    if (res.ok) {
      toast.success('NPS enkät skickad!');
      onSent();
      onClose();
    } else {
      const j = await res.json() as { error?: string };
      toast.error(j.error ?? 'Misslyckades');
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
        <h2 className="text-lg font-extrabold text-slate-900 mb-4">Skicka NPS-enkät</h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Kundnamn</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]"
              placeholder="Anna Lindqvist" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">E-postadress *</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]"
              placeholder="kund@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Lead ID (valfritt)</label>
            <input type="number" value={leadId} onChange={e => setLeadId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]"
              placeholder="123" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Avbryt
            </button>
            <button type="submit" disabled={sending}
              className="px-6 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55d22] disabled:opacity-40">
              {sending ? 'Skickar...' : 'Skicka enkät'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NpsPage() {
  const router = useRouter();
  const [surveys,    setSurveys]    = useState<Survey[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<'all' | 'responded' | 'pending'>('all');
  const [showModal,  setShowModal]  = useState(false);
  const [user,       setUser]       = useState<{ dealershipId?: string } | null>(null);

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  const load = useCallback(async (did: string, f: string) => {
    setLoading(true);
    const url = new URL('/api/nps/list', window.location.origin);
    url.searchParams.set('dealershipId', did);
    if (f === 'responded') url.searchParams.set('responded', 'true');
    if (f === 'pending')   url.searchParams.set('responded', 'false');
    const res = await fetch(url.toString());
    if (res.ok) {
      const j = await res.json() as { surveys: Survey[] };
      setSurveys(j.surveys);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { dealershipId?: string };
    setUser(u);
    const did = u.dealershipId ?? getDealershipId() ?? '';
    if (did) load(did, filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (dealershipId) load(dealershipId, filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // ── Computed stats ────────────────────────────────────────────────────────────
  const responded   = surveys.filter(s => s.score !== null);
  const npsScore    = computeNps(surveys);
  const avgScore    = responded.length > 0
    ? (responded.reduce((s, x) => s + (x.score ?? 0), 0) / responded.length).toFixed(1)
    : '—';
  const promoters   = responded.filter(s => (s.score ?? 0) >= 9).length;
  const detractors  = responded.filter(s => (s.score ?? 0) <= 6).length;
  const responseRate = surveys.length > 0 ? Math.round((responded.length / surveys.length) * 100) : 0;

  // Score distribution for mini bar
  const dist = Array.from({ length: 11 }, (_, i) =>
    responded.filter(s => s.score === i).length
  );
  const maxDist = Math.max(...dist, 1);

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      {showModal && dealershipId && (
        <SendModal dealershipId={dealershipId} onClose={() => setShowModal(false)} onSent={() => load(dealershipId, filter)} />
      )}

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">NPS & Kundnöjdhet</h1>
            <p className="text-sm text-slate-500 mt-0.5">Net Promoter Score – spåra kundlojalitet</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55d22] shadow transition-colors">
            + Skicka enkät
          </button>
        </div>

        {/* KPI strip */}
        <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              {
                label: 'NPS Score',
                value: npsScore !== null ? npsScore.toString() : '—',
                sub: npsScore !== null ? (npsScore >= 50 ? 'Utmärkt' : npsScore >= 0 ? 'OK' : 'Kritiskt') : 'Ingen data',
                alert: npsScore !== null && npsScore < 0,
                highlight: npsScore !== null && npsScore >= 50,
              },
              { label: 'Snittbetyg', value: avgScore, sub: `av ${responded.length} svar` },
              { label: 'Svarsfrekvens', value: `${responseRate}%`, sub: `${responded.length}/${surveys.length}` },
              { label: 'Promoters (9–10)', value: promoters.toString(), sub: 'Lojala kunder' },
              { label: 'Detractors (0–6)', value: detractors.toString(), sub: 'Missnöjda kunder', alert: detractors > 0 },
            ].map(k => (
              <div key={k.label} className={`rounded-2xl border p-4
                ${k.alert ? 'bg-red-50 border-red-200' : k.highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-2xl font-extrabold ${k.alert ? 'text-red-700' : k.highlight ? 'text-emerald-700' : 'text-slate-900'}`}>{k.value}</p>
                {k.sub && <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Score distribution bar */}
        {responded.length > 0 && (
          <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Betygsfördelning</p>
            <div className="flex items-end gap-1 h-10">
              {dist.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t transition-all ${i <= 6 ? 'bg-red-400' : i <= 8 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ height: `${(count / maxDist) * 36}px`, minHeight: count > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[10px] text-slate-400">{i}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="px-6 md:px-8 py-3 bg-white border-b border-slate-100">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-fit">
            {(['all', 'responded', 'pending'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === f ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {f === 'all' ? 'Alla' : f === 'responded' ? 'Besvarade' : 'Väntande'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 px-6 md:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : surveys.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">📊</p>
              <p className="font-bold text-slate-700 text-lg">Inga enkäter ännu</p>
              <p className="text-sm text-slate-400 mt-1">Skicka din första NPS-enkät till en kund ovan.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Kund', 'E-post', 'Skickad', 'Betyg', 'Kommentar', 'Lead', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {surveys.map(s => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{s.recipient_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.recipient_email}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(s.sent_at)}</td>
                      <td className="px-4 py-3">
                        {s.score !== null ? (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreClass(s.score)}`}>
                            {s.score}/10
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Väntar</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{s.comment || '—'}</td>
                      <td className="px-4 py-3">
                        {s.lead_id && (
                          <a href={`/sales/leads/${s.lead_id}`}
                            className="text-xs text-[#FF6B2C] hover:underline font-medium">
                            Lead →
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/nps/${s.token}`;
                            navigator.clipboard.writeText(url);
                            toast.success('Länk kopierad');
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                          title="Kopiera enkätlänk">
                          🔗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
