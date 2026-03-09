
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { getCustomers } from '@/lib/customers';
import { getInvoices } from '@/lib/invoices';
import { useAutoRefresh } from '@/lib/realtime';

// ── Count-up hook ──────────────────────────────────────
function useCountUp(target: number, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setVal(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, duration, delay]);
  return val;
}

// ── Sparkline SVG ──────────────────────────────────────
function Sparkline({ data, color = '#FF6B2C' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 80; const H = 32;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`)
    .join(' ');
  const fillPts = `0,${H} ${pts} ${W},${H}`;
  const gradId = `sg${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-8" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bar chart ──────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number; highlight?: boolean }[] }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
          <div
            className="w-full rounded-t-sm"
            style={{
              height: `${(d.value / max) * 100}px`,
              background: d.highlight ? '#FF6B2C' : '#0f1729',
              opacity: d.highlight ? 1 : 0.35 + i * 0.1,
              transition: 'height 0.8s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
          <span className="text-[9px] text-slate-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Funnel row ─────────────────────────────────────────
function FunnelRow({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full stat-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-5 text-right">{count}</span>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('dashboard');
  const cfg: Record<string, { cls: string; dot: string }> = {
    hot:  { cls: 'bg-red-50 text-red-700',      dot: 'bg-red-500 animate-pulse-dot' },
    warm: { cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
    cold: { cls: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-400' },
  };
  const labels: Record<string, string> = {
    hot:  t('recentLeads.hot'),
    warm: t('recentLeads.warm'),
    cold: t('recentLeads.cold'),
  };
  const { cls, dot } = cfg[status] ?? cfg.cold;
  const label = labels[status] ?? status;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ── Quick action card ──────────────────────────────────
function QuickAction({ href, icon, label, desc, accent }: {
  href: string; icon: string; label: string; desc: string; accent: string;
}) {
  return (
    <Link href={href}
      className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform"
        style={{ background: `${accent}1a` }}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <span className="ml-auto text-slate-300 group-hover:text-slate-600 transition-colors">→</span>
    </Link>
  );
}

function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ── Compute last-6-months revenue bars from paid invoices ─────────────────────
function buildRevenueData(invoices: ReturnType<typeof getInvoices>) {
  const now = new Date();
  const months: { label: string; value: number; highlight: boolean }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('sv-SE', { month: 'short' });
    const value = invoices
      .filter(inv => {
        if (inv.status !== 'paid' || !inv.paidDate) return false;
        const pd = new Date(inv.paidDate);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      })
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    months.push({ label, value: Math.round(value / 1000), highlight: i === 0 });
  }
  // Ensure bars are never all-zero (show seed data scale if real data is empty)
  const max = Math.max(...months.map(m => m.value));
  if (max === 0) {
    const defaults = [720, 890, 670, 1050, 980, 1200];
    return months.map((m, i) => ({ ...m, value: defaults[i] }));
  }
  return months;
}

// ── Page ───────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // ── Live stats ─────────────────────────────────────────────────────────────
  const [liveCustomers, setLiveCustomers] = useState(0);
  const [liveRevenue,   setLiveRevenue]   = useState(0);
  const [liveLeads,     setLiveLeads]     = useState(0);
  const [revenueData,   setRevenueData]   = useState(() => buildRevenueData([]));

  const loadStats = () => {
    const invoices = getInvoices();
    const paidTotal = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((s, inv) => s + inv.totalAmount, 0);
    setLiveRevenue(Math.round(paidTotal / 1000));
    setRevenueData(buildRevenueData(invoices));

    const allCustomers = getCustomers();
    setLiveCustomers(allCustomers.length);

    // Leads: custom leads + 15 initial seed leads
    try {
      const custom = JSON.parse(localStorage.getItem('custom_leads') || '[]');
      setLiveLeads(custom.length + 15);
    } catch {
      setLiveLeads(15);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/auth/login'); return; }
    setUser(JSON.parse(stored));

    const loadProfile = () => {
      try {
        const p = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
        setProfile(p.name ? p : null);
      } catch { setProfile(null); }
    };
    loadProfile();
    loadStats();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dealership_profile') loadProfile();
      if (e.key === 'app_invoices' || e.key === 'app_customers' || e.key === 'custom_leads') loadStats();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh stats when realtime events fire (same tab or other tabs)
  useAutoRefresh(loadStats);

  const leads     = useCountUp(liveLeads,     1000, 100);
  const vehicles  = useCountUp(47,            1100, 200);
  const revenue   = useCountUp(liveRevenue,   1300, 300);
  const customers = useCountUp(liveCustomers, 1200, 400);

  const recentLeads = [
    { name: 'Lars Andersson', bike: 'Ninja ZX-6R', time: '2h ago', status: 'hot',  verified: true },
    { name: 'Maria Svensson', bike: 'MT-07',        time: '5h ago', status: 'warm', verified: true },
    { name: 'Erik Johansson', bike: 'CB650R',       time: '1d ago', status: 'warm', verified: false },
    { name: 'Anna Lindgren',  bike: 'Duke 390',     time: '2d ago', status: 'cold', verified: false },
  ];

  const topBikes = [
    { name: 'Kawasaki Ninja ZX-6R', sales: 12, rev: '1.8M kr' },
    { name: 'Yamaha MT-07',          sales: 9,  rev: '810k kr'  },
    { name: 'Honda CB650R',          sales: 7,  rev: '735k kr'  },
    { name: 'KTM Duke 390',          sales: 5,  rev: '435k kr'  },
  ];

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="text-center animate-fade-in">
        <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">{t('loading')}</p>
      </div>
    </div>
  );

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col">
        <div className="flex-1 p-5 md:p-8">

          {/* ── Dealership Hero Banner ─────────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden mb-8 animate-fade-up" style={{ minHeight: 250 }}>

            {/* Background — cover photo or brand gradient */}
            {profile?.coverImageDataUrl ? (
              <img
                src={profile.coverImageDataUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-linear-to-br from-[#0b1524] via-[#162236] to-[#0a1120]" />
            )}

            {/* Readability overlay */}
            <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/55 to-black/20" />

            {/* Brand accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#FF6B2C] via-[#ff9a6c] to-transparent" />

            {/* Content */}
            <div className="relative z-10 p-7 md:p-10 flex flex-col justify-between" style={{ minHeight: 250 }}>

              {/* Top row — dealer identity + CTA */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">

                  {/* Logo or brand icon */}
                  {profile?.logoDataUrl ? (
                    <img
                      src={profile.logoDataUrl}
                      alt="logo"
                      className="w-14 h-14 rounded-2xl object-contain bg-white/15 p-1.5 border border-white/20 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-[#FF6B2C] flex items-center justify-center shrink-0 shadow-lg">
                      <svg viewBox="0 0 20 20" className="w-7 h-7" fill="white">
                        <circle cx="4.5" cy="14.5" r="2" />
                        <circle cx="15.5" cy="14.5" r="2" />
                        <path d="M4.5 14.5H3.5a.5.5 0 0 1-.48-.36L2 10h5l.8 2.4H11L12.5 8H15l.5 1.5L13 11v2a.5.5 0 0 1-.5.5H7.5" />
                        <path d="M7.5 10L9 7h3l.8 1.5" />
                      </svg>
                    </div>
                  )}

                  {/* Name + location + badges */}
                  <div>
                    <h2 className="text-white text-xl md:text-2xl font-black tracking-tight leading-none drop-shadow-sm">
                      {profile?.name || user.dealershipName || user.dealership || 'My Dealership'}
                    </h2>
                    {(profile?.city || profile?.county) && (
                      <p className="text-white/55 text-sm mt-1">
                        {[profile?.city, profile?.county].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full border border-green-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Aktiv prenumeration
                      </span>
                      {profile?.orgNr && (
                        <span className="text-[10px] text-white/35 font-mono">Org.nr {profile.orgNr}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* New lead button */}
                <Link
                  href="/sales/leads/new"
                  className="hidden md:flex items-center gap-2 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shrink-0"
                >
                  {t('newLead')}
                </Link>
              </div>

              {/* Bottom — greeting */}
              <div className="mt-8">
                <p className="text-white/40 text-[11px] uppercase tracking-widest font-semibold">{today}</p>
                <h1 className="text-white text-2xl md:text-3xl font-bold mt-1 drop-shadow-sm">
                  {{ morning: t('greeting.morning'), afternoon: t('greeting.afternoon'), evening: t('greeting.evening') }[getGreetingKey()]}, {user.givenName || user.name?.split(' ')[0] || 'there'} 👋
                </h1>
                <p className="text-white/55 text-sm mt-1">{t('happeningToday')}</p>
              </div>

            </div>
          </div>

          {/* BankID Verified Identity Card — shown only when Roaring data is present */}
          {user.roaring && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-8 animate-fade-up flex flex-wrap gap-6 items-start">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-[#235971] flex items-center justify-center text-white font-extrabold text-xs shrink-0">
                  BankID
                </div>
                <div>
                  <p className="text-xs font-bold text-[#235971] uppercase tracking-wide">{tCommon('verifiedIdentity')}</p>
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.personalNumber?.replace(/(\d{8})(\d{4})/, '$1-$2')}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 text-sm">
                {user.roaring.address && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{tCommon('address')}</p>
                    <p className="text-slate-700 font-medium">{user.roaring.address.street || '—'}</p>
                    <p className="text-slate-500">{user.roaring.address.postalCode} {user.roaring.address.city}</p>
                  </div>
                )}
                {user.dateOfBirth && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{tCommon('dateOfBirth')}</p>
                    <p className="text-slate-700 font-medium">{user.dateOfBirth}</p>
                  </div>
                )}
                {user.roaring.gender && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{tCommon('gender')}</p>
                    <p className="text-slate-700 font-medium">
                      {user.roaring.gender === 'M' ? 'Male' : 'Female'}
                    </p>
                  </div>
                )}
                {user.roaring.protectedIdentity && (
                  <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-0.5">{tCommon('protectedIdentity')}</p>
                    <p className="text-red-600 font-semibold text-xs">{tCommon('protectedIdentityYes')}</p>
                  </div>
                )}
              </div>

              <div className="ml-auto shrink-0 self-center">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {tCommon('populationVerified')}
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
            {[
              { icon: '💰', label: t('stats.activeLeads'), value: leads,     suffix: '',  change: '+12%',    color: '#FF6B2C', trend: [14,18,15,22,20,24] },
              { icon: '🏍', label: t('stats.inStock'),      value: vehicles,  suffix: '',  change: '8 new',   color: '#3b82f6', trend: [35,40,38,44,45,47] },
              { icon: '📊', label: t('stats.revenueKr'),    value: revenue,   suffix: 'k', change: '+9%',     color: '#10b981', trend: [720,890,670,1050,980,1200] },
              { icon: '👥', label: t('stats.customers'),    value: customers, suffix: '',  change: '+5 today',color: '#8b5cf6', trend: [120,130,135,140,150,156] },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 animate-fade-up hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{s.icon}</span>
                  <Sparkline data={s.trend} color={s.color} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                    {s.value.toLocaleString('sv-SE')}{s.suffix}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-green-600">↑ {s.change}</span>
                  <span className="text-xs text-slate-400">{t('vsLastMonth')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up" style={{ animationDelay: '150ms' }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-slate-900">{t('revenueTrend')}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{t('revenueTrendSub')}</p>
                </div>
                <span className="text-xs bg-green-50 text-green-700 font-semibold px-2.5 py-1 rounded-full">{t('vsLastYear')}</span>
              </div>
              <BarChart data={revenueData} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up" style={{ animationDelay: '200ms' }}>
              <h2 className="font-bold text-slate-900 mb-0.5">{t('salesFunnel')}</h2>
              <p className="text-xs text-slate-400 mb-5">{t('salesFunnelSub')}</p>
              <div className="space-y-4">
                <FunnelRow label={t('funnelStages.new')}         count={8} total={24} color="#FF6B2C" />
                <FunnelRow label={t('funnelStages.contacted')}   count={6} total={24} color="#f59e0b" />
                <FunnelRow label={t('funnelStages.testRide')}    count={5} total={24} color="#8b5cf6" />
                <FunnelRow label={t('funnelStages.negotiating')} count={3} total={24} color="#3b82f6" />
                <FunnelRow label={t('funnelStages.closed')}      count={2} total={24} color="#10b981" />
              </div>
              <Link href="/sales/leads" className="mt-5 flex items-center gap-1 text-xs text-[#FF6B2C] font-semibold hover:underline">
                {t('openPipeline')}
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-8 animate-fade-up" style={{ animationDelay: '250ms' }}>
            <h2 className="font-bold text-slate-900 mb-4">{t('quickActions.title')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <QuickAction href="/sales/leads/new" icon="➕" label={t('quickActions.newLead')}      desc={t('quickActions.newLeadDesc')}      accent="#FF6B2C" />
              <QuickAction href="/inventory"        icon="🏍" label={t('quickActions.addVehicle')}   desc={t('quickActions.addVehicleDesc')}   accent="#3b82f6" />
              <QuickAction href="/purchase"  icon="📦" label={t('quickActions.purchaseOrder')} desc={t('quickActions.purchaseOrderDesc')} accent="#10b981" />
            </div>
          </div>

          {/* Bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent leads */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900">{t('recentLeads.title')}</h2>
                <Link href="/sales/leads" className="text-xs text-[#FF6B2C] font-semibold hover:underline">{t('recentLeads.viewAll')}</Link>
              </div>
              <div className="space-y-1">
                {recentLeads.map((lead, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0f1729] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {lead.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">{lead.name}</span>
                          {lead.verified && (
                            <span className="text-[9px] bg-[#0f1729] text-white px-1.5 py-0.5 rounded font-bold tracking-wide">BankID</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{lead.bike}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={lead.status} />
                      <span className="text-xs text-slate-400">{lead.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top selling */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up" style={{ animationDelay: '350ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900">{t('topSelling.title')}</h2>
                <span className="text-xs text-slate-400">{t('topSelling.thisMonth')}</span>
              </div>
              <div className="space-y-4">
                {topBikes.map((bike, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 w-5">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-semibold text-slate-800">{bike.name}</span>
                        <span className="text-xs font-bold text-green-600">{bike.rev}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full stat-bar"
                          style={{
                            width: `${(bike.sales / topBikes[0].sales) * 100}%`,
                            background: i === 0 ? '#FF6B2C' : '#0f1729',
                            opacity: i === 0 ? 1 : 0.5 + i * 0.1,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 w-12 text-right shrink-0">{bike.sales} {t('topSelling.sold')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
