'use client';

import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SurveyMeta {
  id: number;
  recipient_name: string;
  score: number | null;
  responded_at: string | null;
  expires_at: string;
}

export default function NpsSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [survey,    setSurvey]    = useState<SurveyMeta | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [expired,   setExpired]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [hover,   setHover]   = useState<number | null>(null);
  const [score,   setScore]   = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/nps/respond/${token}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json() as Promise<{ survey: SurveyMeta }>;
      })
      .then(d => {
        if (!d) return;
        setSurvey(d.survey);
        if (d.survey.responded_at) setSubmitted(true);
        if (new Date(d.survey.expires_at) < new Date()) setExpired(true);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    if (score === null) { toast.error('Välj ett betyg 0–10'); return; }
    setSending(true);
    const res = await fetch(`/api/nps/respond/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comment }),
    });
    if (res.ok) {
      setSubmitted(true);
    } else {
      const j = await res.json() as { error?: string };
      toast.error(j.error ?? 'Något gick fel');
    }
    setSending(false);
  }

  function scoreLabel(n: number) {
    if (n <= 6) return 'Missnöjd';
    if (n <= 8) return 'Neutral';
    return 'Nöjd';
  }

  function scoreColor(n: number) {
    if (n <= 6) return 'bg-red-500';
    if (n <= 8) return 'bg-amber-400';
    return 'bg-emerald-500';
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
      <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
      <div className="text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-xl font-bold text-slate-800">Enkäten hittades inte</h1>
        <p className="text-slate-500 mt-2 text-sm">Länken kan vara felaktig eller har tagits bort.</p>
      </div>
    </div>
  );

  if (expired && !submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
      <div className="text-center">
        <p className="text-5xl mb-4">⏰</p>
        <h1 className="text-xl font-bold text-slate-800">Enkäten har gått ut</h1>
        <p className="text-slate-500 mt-2 text-sm">Den här enkäten var giltig i 30 dagar och har nu stängt.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Tack för ditt svar!</h1>
        <p className="text-slate-500 mt-2">Vi uppskattar din feedback och jobbar ständigt på att bli bättre.</p>
        {score !== null && (
          <div className={`mt-4 inline-block px-4 py-2 rounded-full text-white font-bold text-lg ${scoreColor(score)}`}>
            {score}/10 – {scoreLabel(score)}
          </div>
        )}
      </div>
    </div>
  );

  const activeScore = hover ?? score;

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 w-full max-w-lg">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#FF6B2C] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-black">B</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Hur nöjd är du?</h1>
          <p className="text-slate-500 text-sm mt-1">
            Hej {survey?.recipient_name || 'kund'}, vi vill veta din åsikt om ditt köp.
          </p>
        </div>

        {/* NPS scale */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-3 text-center">
            Hur troligt är det att du rekommenderar oss till en vän eller kollega?
          </p>
          <div className="flex justify-between gap-1">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setScore(i)}
                className={`flex-1 aspect-square rounded-xl text-sm font-bold transition-all
                  ${score === i
                    ? i <= 6 ? 'bg-red-500 text-white scale-110 shadow'
                    : i <= 8 ? 'bg-amber-400 text-white scale-110 shadow'
                    : 'bg-emerald-500 text-white scale-110 shadow'
                    : hover === i
                    ? 'bg-slate-100 scale-105'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-slate-400">Inte alls troligt</span>
            <span className="text-xs text-slate-400">Mycket troligt</span>
          </div>
          {activeScore !== null && (
            <div className={`mt-3 text-center text-sm font-semibold rounded-lg py-1.5
              ${activeScore <= 6 ? 'text-red-600 bg-red-50' : activeScore <= 8 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
              {activeScore}/10 – {scoreLabel(activeScore)}
            </div>
          )}
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Kommentar <span className="font-normal text-slate-400">(frivilligt)</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder="Berätta mer om din upplevelse..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C] resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={score === null || sending}
          className="w-full py-3.5 rounded-xl bg-[#FF6B2C] text-white font-bold text-base hover:bg-[#e55d22] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Skickar...' : 'Skicka svar'}
        </button>
      </div>
    </div>
  );
}
