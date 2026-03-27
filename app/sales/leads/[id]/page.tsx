'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';

interface LeadDetail {
  id:           number;
  name:         string;
  bike:         string;
  value:        number;
  status:       string;
  stage:        string;
  email:        string;
  phone:        string;
  personnummer: string;
  createdAt:    string;
  notes:        string;
}

const STAGE_LABELS: Record<string, string> = {
  new:             'Ny',
  contacted:       'Kontaktad',
  testride:        'Provkörning',
  negotiating:     'Förhandling',
  pending_payment: 'Betalning pågår',
  closed:          'Avslutad',
};

const STATUS_CFG: Record<string, { cls: string; dot: string; label: string }> = {
  hot:  { cls: 'bg-red-50 text-red-700',      dot: 'bg-red-500 animate-pulse', label: 'Varm' },
  warm: { cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400',            label: 'Neutral' },
  cold: { cls: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-400',              label: 'Kall' },
};

export default function LeadDetailPage() {
  const router  = useRouter();
  const params  = useParams();
  const id      = (params?.id as string) || '';

  const [lead,    setLead]    = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }

    const leadId       = Number(id);
    const dealershipId = getDealershipId();
    if (Number.isNaN(leadId) || !dealershipId) { setLoading(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getSupabaseBrowser() as any)
      .from('leads')
      .select('id, name, bike, value, lead_status, stage, email, phone, personnummer, created_at, notes')
      .eq('id', leadId)
      .eq('dealership_id', dealershipId)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data) {
          setLead({
            id:           data.id,
            name:         data.name         ?? '',
            bike:         data.bike         ?? '',
            value:        parseFloat(data.value ?? '0'),
            status:       data.lead_status  ?? 'warm',
            stage:        data.stage        ?? 'new',
            email:        data.email        ?? '',
            phone:        data.phone        ?? '',
            personnummer: data.personnummer ?? '',
            createdAt:    data.created_at   ?? '',
            notes:        data.notes        ?? '',
          });
        }
        setLoading(false);
      });
  }, [id, router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!lead) return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Lead hittades inte.</p>
          <Link href="/sales/leads" className="text-[#FF6B2C] font-semibold hover:underline">
            ← Tillbaka till pipeline
          </Link>
        </div>
      </div>
    </div>
  );

  const status   = STATUS_CFG[lead.status] ?? STATUS_CFG.warm;
  const initials = lead.name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  const isClosed = lead.stage === 'closed';

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Försäljning</Link>
            <span>→</span>
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Pipeline</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{lead.name}</span>
          </nav>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#0f1729] flex items-center justify-center text-sm font-bold text-white shrink-0">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
                  {lead.personnummer && (
                    <span className="text-[10px] bg-[#0f1729] text-white px-1.5 py-0.5 rounded font-bold tracking-wide">BankID</span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">{lead.bike}</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${status.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 md:px-8 py-8">
          <div className="max-w-2xl mx-auto grid gap-4">

            {/* Lead info card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up">
              <h2 className="font-bold text-slate-900 mb-4">Leadinformation</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">

                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Fordon</p>
                  <p className="text-slate-800 font-medium">{lead.bike || '—'}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Värde</p>
                  <p className="text-slate-800 font-medium">{lead.value.toLocaleString('sv-SE')} kr</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Fas</p>
                  <p className="text-slate-800 font-medium">{STAGE_LABELS[lead.stage] ?? lead.stage}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Personnummer</p>
                  <p className="text-slate-800 font-medium">{lead.personnummer || '—'}</p>
                </div>

                {lead.email && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">E-post</p>
                    <a href={`mailto:${lead.email}`} className="text-[#FF6B2C] hover:underline font-medium">{lead.email}</a>
                  </div>
                )}

                {lead.phone && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Telefon</p>
                    <a href={`tel:${lead.phone}`} className="text-[#FF6B2C] hover:underline font-medium">{lead.phone}</a>
                  </div>
                )}

                {lead.createdAt && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Skapad</p>
                    <p className="text-slate-800 font-medium">
                      {new Date(lead.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                )}

                {lead.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Anteckningar</p>
                    <p className="text-slate-700 leading-relaxed">{lead.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 animate-fade-up">
              <Link
                href="/sales/leads"
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
              >
                ← Tillbaka
              </Link>
              <div className="flex-1" />
              {isClosed ? (
                <Link
                  href={`/sales/leads/${id}/agreement/complete`}
                  className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors"
                >
                  Visa avslutad affär →
                </Link>
              ) : (
                <Link
                  href={`/sales/leads/${id}/agreement`}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors"
                >
                  Fortsätt till avtal →
                </Link>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
