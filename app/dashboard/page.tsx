
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getCustomers } from '@/lib/customers';
import { getInvoices, type Invoice } from '@/lib/invoices';
import { getLeads, type Lead } from '@/lib/leads';
import { useAutoRefresh } from '@/lib/realtime';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';

// ── Count-up hook ─────────────────────────────────────────────────────────────
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

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#FF6B2C' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 72; const H = 28;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`)
    .join(' ');
  const fillPts = `0,${H} ${pts} ${W},${H}`;
  const gradId = `sg${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[72px] h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Revenue tooltip ───────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-bold text-slate-500 mb-0.5">{label}</p>
      <p className="font-black text-slate-900 text-sm">{Number(payload[0]?.value).toLocaleString('sv-SE')}k kr</p>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('dashboard');
  const cfg: Record<string, { cls: string; dot: string }> = {
    hot:  { cls: 'bg-red-50 text-red-600 border border-red-100',         dot: 'bg-red-500 animate-pulse-dot' },
    warm: { cls: 'bg-orange-50 text-orange-600 border border-orange-100', dot: 'bg-orange-400' },
    cold: { cls: 'bg-blue-50 text-blue-600 border border-blue-100',       dot: 'bg-blue-400' },
  };
  const labels: Record<string, string> = {
    hot:  t('recentLeads.hot'),
    warm: t('recentLeads.warm'),
    cold: t('recentLeads.cold'),
  };
  const { cls, dot } = cfg[status] ?? cfg.cold;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {labels[status] ?? status}
    </span>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────
function QuickAction({ href, icon, label, desc, color, bg }: {
  href: string; icon: string; label: string; desc: string; color: string; bg: string;
}) {
  const isDark = useIsDark();
  const iconBg = isDark ? `${color}22` : bg;
  const hoverWash = isDark
    ? `linear-gradient(135deg, ${color}18 0%, transparent 70%)`
    : `linear-gradient(135deg, ${bg} 0%, transparent 70%)`;
  return (
    <Link href={href}
      className="group relative flex flex-col gap-3 p-5 rounded-2xl bg-white border border-slate-100 hover:shadow-lg hover:border-transparent transition-all duration-300 overflow-hidden"
    >
      {/* Hover gradient wash */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: hoverWash }} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: iconBg }}>
          {icon}
        </div>
        <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:border-transparent group-hover:text-white transition-all duration-300"
          style={{ background: 'white' }}>
          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <div className="relative z-10">
        <p className="font-bold text-slate-900 text-sm">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
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
function buildRevenueData(invoices: Invoice[]) {
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
  const max = Math.max(...months.map(m => m.value));
  if (max === 0) {
    const defaults = [720, 890, 670, 1050, 980, 1200];
    return months.map((m, i) => ({ ...m, value: defaults[i] }));
  }
  return months;
}

// ── Monthly bucket helper ─────────────────────────────────────────────────────
function buildMonthlyBuckets(rows: { created_at: string }[]): number[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
    return rows.filter(r => {
      const t = new Date(r.created_at);
      return t >= monthStart && t < monthEnd;
    }).length;
  });
}

// ── Avatar colour from name ───────────────────────────────────────────────────
const AVATAR_COLORS = ['#FF6B2C', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Detect dark mode from html.dark class ─────────────────────────────────────
function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const isDark = useIsDark();
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // ── Live stats ─────────────────────────────────────────────────────────────
  const [liveCustomers,    setLiveCustomers]    = useState(0);
  const [liveRevenue,      setLiveRevenue]      = useState(0);
  const [liveLeads,        setLiveLeads]        = useState(0);
  const [liveVehicles,     setLiveVehicles]     = useState(0);
  const [revenueData,      setRevenueData]      = useState(() => buildRevenueData([]));
  const [liveRecentLeads,  setLiveRecentLeads]  = useState<Lead[]>([]);
  const [liveFunnel,       setLiveFunnel]       = useState({ new: 0, contacted: 0, testride: 0, negotiating: 0, closed: 0 });
  const [liveForecast,     setLiveForecast]     = useState(0);
  const [liveOverdue,      setLiveOverdue]      = useState(0);
  const [liveTopBikes,     setLiveTopBikes]     = useState<{ name: string; sales: number; rev: string }[]>([]);
  const [trends,           setTrends]           = useState({
    leads:     [0, 0, 0, 0, 0, 0],
    vehicles:  [0, 0, 0, 0, 0, 0],
    revenue:   [720, 890, 670, 1050, 980, 1200],
    customers: [0, 0, 0, 0, 0, 0],
  });
  const [changes, setChanges] = useState({
    leads:     '—',
    vehicles:  '—',
    revenue:   '—',
    customers: '—',
  });
  const [changesUp, setChangesUp] = useState({
    leads: true, vehicles: true, revenue: true, customers: true,
  });

  const loadStats = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    const dealershipId = getDealershipId();
    const now = new Date();
    const sixMonthsAgo   = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const invoices   = await getInvoices();
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const paidTotal  = paidInvoices.reduce((s, inv) => s + inv.totalAmount, 0);
    setLiveRevenue(Math.round(paidTotal / 1000));
    const revData = buildRevenueData(invoices);
    setRevenueData(revData);

    const allCustomers = await getCustomers();
    setLiveCustomers(allCustomers.length);

    const leads = await getLeads();
    setLiveLeads(leads.length);
    setLiveRecentLeads(leads.slice(0, 5));

    const funnelCounts = { new: 0, contacted: 0, testride: 0, negotiating: 0, closed: 0 };
    leads.forEach(l => {
      if (l.stage in funnelCounts) funnelCounts[l.stage as keyof typeof funnelCounts]++;
    });
    setLiveFunnel(funnelCounts);

    const stageWeight: Record<string, number> = {
      new: 0.10, contacted: 0.25, testride: 0.40, negotiating: 0.70, pending_payment: 0.90,
    };
    const overdueDays: Record<string, number> = {
      new: 2, contacted: 3, testride: 5, negotiating: 7, pending_payment: 14,
    };
    const forecast = leads
      .filter(l => l.stage !== 'closed')
      .reduce((sum, l) => sum + l.rawValue * (stageWeight[l.stage] ?? 0), 0);
    const overdue = leads.filter(l =>
      l.stage !== 'closed' &&
      l.daysInStage >= (overdueDays[l.stage] ?? 999)
    ).length;
    setLiveForecast(Math.round(forecast / 1000));
    setLiveOverdue(overdue);

    const bikeMap = new Map<string, { sales: number; revenue: number }>();
    paidInvoices.forEach(inv => {
      if (!inv.vehicle) return;
      const cur = bikeMap.get(inv.vehicle) ?? { sales: 0, revenue: 0 };
      bikeMap.set(inv.vehicle, { sales: cur.sales + 1, revenue: cur.revenue + inv.totalAmount });
    });
    const topBikesLive = [...bikeMap.entries()]
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 4)
      .map(([name, { sales, revenue }]) => ({
        name,
        sales,
        rev: revenue >= 1_000_000
          ? `${(revenue / 1_000_000).toFixed(1)}M kr`
          : `${Math.round(revenue / 1000)}k kr`,
      }));
    setLiveTopBikes(topBikesLive);

    if (!dealershipId) return;

    const { data: mcs } = await sb
      .from('motorcycles')
      .select('stock')
      .eq('dealership_id', dealershipId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalStock = (mcs ?? []).reduce((s: number, r: any) => s + (r.stock ?? 0), 0);
    setLiveVehicles(totalStock);

    const { data: leadsRaw } = await sb
      .from('leads')
      .select('created_at')
      .eq('dealership_id', dealershipId)
      .gte('created_at', sixMonthsAgo);

    const { data: customersRaw } = await sb
      .from('customers')
      .select('created_at')
      .eq('dealership_id', dealershipId)
      .gte('created_at', sixMonthsAgo);

    const trendLeads     = buildMonthlyBuckets(leadsRaw     ?? []);
    const trendCustomers = buildMonthlyBuckets(customersRaw ?? []);
    const trendRevenue   = revData.map(m => m.value);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trendVehicles  = buildMonthlyBuckets((mcs ?? []).filter((r: any) => r.created_at));

    setTrends({
      leads:     trendLeads.some(v => v > 0)     ? trendLeads     : [0, 0, 0, 0, 0, leads.length],
      vehicles:  trendVehicles.some(v => v > 0)  ? trendVehicles  : [0, 0, 0, 0, 0, totalStock],
      revenue:   trendRevenue,
      customers: trendCustomers.some(v => v > 0) ? trendCustomers : [0, 0, 0, 0, 0, allCustomers.length],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadsThis = (leadsRaw ?? []).filter((r: any) => new Date(r.created_at) >= thisMonthStart).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadsLast = (leadsRaw ?? []).filter((r: any) => {
      const d = new Date(r.created_at);
      return d >= lastMonthStart && d < thisMonthStart;
    }).length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customersThis = (customersRaw ?? []).filter((r: any) => new Date(r.created_at) >= thisMonthStart).length;

    const revenueThis = revData[5]?.value ?? 0;
    const revenueLast = revData[4]?.value ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vehiclesNew = (mcs ?? []).filter((r: any) =>
      r.created_at && new Date(r.created_at) >= thisMonthStart
    ).length;

    const pctChange = (a: number, b: number) =>
      b === 0 ? (a > 0 ? `+${a}` : '—') : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`;

    setChanges({
      leads:     leadsThis > 0 ? `+${leadsThis} this month` : (leadsLast > 0 ? pctChange(leadsThis, leadsLast) : `${leads.length} total`),
      vehicles:  vehiclesNew > 0 ? `+${vehiclesNew} new` : `${totalStock} in stock`,
      revenue:   pctChange(revenueThis, revenueLast),
      customers: customersThis > 0 ? `+${customersThis} this month` : `${allCustomers.length} total`,
    });
    setChangesUp({
      leads:     leadsThis >= leadsLast,
      vehicles:  vehiclesNew >= 0,
      revenue:   revenueThis >= revenueLast,
      customers: customersThis >= 0,
    });
  };

  const loadProfile = async () => {
    try {
      const p = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
      if (p.name) setProfile(p);
    } catch { /* ignore */ }

    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = getSupabaseBrowser() as any;
      const { data } = await sb
        .from('dealership_settings')
        .select('name,org_nr,city,county,logo_data_url,cover_image_data_url')
        .eq('dealership_id', dealershipId)
        .maybeSingle();
      if (data?.name) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing: any = (() => { try { return JSON.parse(localStorage.getItem('dealership_profile') || '{}'); } catch { return {}; } })();
        const fresh = {
          ...existing,
          name:              data.name,
          orgNr:             data.org_nr              ?? '',
          city:              data.city                ?? '',
          county:            data.county              ?? '',
          logoDataUrl:       data.logo_data_url        ?? '',
          coverImageDataUrl: data.cover_image_data_url ?? '',
        };
        localStorage.setItem('dealership_profile', JSON.stringify(fresh));
        window.dispatchEvent(new StorageEvent('storage', { key: 'dealership_profile' }));
        setProfile(fresh);
      }
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/auth/login'); return; }
    setUser(JSON.parse(stored));
    loadProfile();
    loadStats();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dealership_profile') {
        try {
          const p = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
          if (p.name) setProfile(p);
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(loadStats);
  useAutoRefresh(loadProfile);

  const leads     = useCountUp(liveLeads,     1000, 100);
  const vehicles  = useCountUp(liveVehicles,  1100, 200);
  const revenue   = useCountUp(liveRevenue,   1300, 300);
  const customers = useCountUp(liveCustomers, 1200, 400);
  const forecast  = useCountUp(liveForecast,  1400, 500);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="text-center animate-fade-in">
        <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">{t('loading')}</p>
      </div>
    </div>
  );

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const funnelTotal = liveLeads || 1;
  const convRate = liveLeads > 0 ? Math.round((liveFunnel.closed / liveLeads) * 100) : 0;

  const FUNNEL_STAGES = [
    { key: 'new',         icon: '✨', label: t('funnelStages.new'),         color: '#FF6B2C', count: liveFunnel.new },
    { key: 'contacted',   icon: '📞', label: t('funnelStages.contacted'),   color: '#f59e0b', count: liveFunnel.contacted },
    { key: 'testride',    icon: '🏍', label: t('funnelStages.testRide'),    color: '#8b5cf6', count: liveFunnel.testride },
    { key: 'negotiating', icon: '🤝', label: t('funnelStages.negotiating'), color: '#3b82f6', count: liveFunnel.negotiating },
    { key: 'closed',      icon: '✅', label: t('funnelStages.closed'),      color: '#10b981', count: liveFunnel.closed },
  ];

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex min-h-screen bg-[#f0f2f5]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col">
        <div className="flex-1 p-5 md:p-7 space-y-5">

          {/* ── HERO BANNER ────────────────────────────────────────────────────── */}
          <div className="relative rounded-3xl overflow-hidden animate-fade-up" style={{ minHeight: 240 }}>
            {profile?.coverImageDataUrl ? (
              <img src={profile.coverImageDataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #0b1524 0%, #162236 50%, #0d1e35 100%)'
              }} />
            )}

            {/* Multi-layer overlay */}
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(105deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.60) 55%, rgba(0,0,0,0.20) 100%)'
            }} />

            {/* Decorative grid dots */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }} />

            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{
              background: 'linear-gradient(90deg, #FF6B2C, #ff9a6c 40%, transparent 100%)'
            }} />

            <div className="relative z-10 p-7 md:p-9 flex flex-col justify-between" style={{ minHeight: 240 }}>
              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {profile?.logoDataUrl ? (
                    <img src={profile.logoDataUrl} alt="logo"
                      className="w-14 h-14 rounded-2xl object-contain bg-white/10 p-1.5 border border-white/20 shrink-0 shadow-lg" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B2C] to-[#e55a1f] flex items-center justify-center shrink-0 shadow-xl">
                      <svg viewBox="0 0 20 20" className="w-7 h-7" fill="white">
                        <circle cx="4.5" cy="14.5" r="2" />
                        <circle cx="15.5" cy="14.5" r="2" />
                        <path d="M4.5 14.5H3.5a.5.5 0 0 1-.48-.36L2 10h5l.8 2.4H11L12.5 8H15l.5 1.5L13 11v2a.5.5 0 0 1-.5.5H7.5" />
                        <path d="M7.5 10L9 7h3l.8 1.5" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h2 className="text-white text-xl md:text-2xl font-black tracking-tight leading-none">
                      {profile?.name || user.dealershipName || user.dealership || 'My Dealership'}
                    </h2>
                    {(profile?.city || profile?.county) && (
                      <p className="text-white/50 text-sm mt-1">{[profile?.city, profile?.county].filter(Boolean).join(', ')}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </span>
                      {profile?.orgNr && (
                        <span className="text-[10px] text-white/30 font-mono">Org.nr {profile.orgNr}</span>
                      )}
                    </div>
                  </div>
                </div>

                {user?.role !== 'service' && (
                  <Link href="/sales/leads/new"
                    className="hidden md:flex items-center gap-2 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#FF6B2C]/30 hover:shadow-[#FF6B2C]/50 hover:scale-105 duration-200 shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    {t('newLead')}
                  </Link>
                )}
              </div>

              {/* Bottom: greeting + inline stats */}
              <div className="mt-6">
                <p className="text-white/35 text-[11px] uppercase tracking-widest font-bold">{today}</p>
                <h1 className="text-white text-2xl md:text-[28px] font-bold mt-1 leading-tight">
                  {{ morning: t('greeting.morning'), afternoon: t('greeting.afternoon'), evening: t('greeting.evening') }[getGreetingKey()]},&nbsp;
                  {user.givenName || user.name?.split(' ')[0] || 'there'} 👋
                </h1>

                {/* Inline stats strip */}
                <div className="flex flex-wrap gap-4 mt-4">
                  {[
                    { label: 'Aktiva leads',    value: liveLeads,     icon: '💰', color: '#FF6B2C' },
                    { label: 'Open pipeline',   value: funnelTotal - liveFunnel.closed, icon: '📋', color: '#f59e0b' },
                    { label: 'Avslutade',        value: liveFunnel.closed, icon: '✅', color: '#10b981' },
                    ...(liveOverdue > 0 ? [{ label: 'Kräver åtgärd', value: liveOverdue, icon: '⚠️', color: '#ef4444' }] : []),
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-white font-bold text-sm tabular-nums">{s.value}</span>
                      <span className="text-white/50 text-xs">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── BANKID IDENTITY CARD ───────────────────────────────────────────── */}
          {user.roaring && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 animate-fade-up flex flex-wrap gap-6 items-start shadow-sm">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-[#235971] flex items-center justify-center text-white font-extrabold text-xs">BankID</div>
                <div>
                  <p className="text-xs font-bold text-[#235971] uppercase tracking-wide">{tCommon('verifiedIdentity')}</p>
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
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
                {user.roaring.gender && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{tCommon('gender')}</p>
                    <p className="text-slate-700 font-medium">{user.roaring.gender === 'M' ? 'Male' : 'Female'}</p>
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
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {tCommon('populationVerified')}
                </span>
              </div>
            </div>
          )}

          {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
            {[
              { icon: '💰', label: t('stats.activeLeads'),  value: leads,     suffix: '',  change: changes.leads,     up: changesUp.leads,     color: '#FF6B2C', bg: '#fff4ef', trend: trends.leads     },
              { icon: '🏍', label: t('stats.inStock'),       value: vehicles,  suffix: '',  change: changes.vehicles,  up: changesUp.vehicles,  color: '#3b82f6', bg: '#eff6ff', trend: trends.vehicles  },
              { icon: '📊', label: t('stats.revenueKr'),     value: revenue,   suffix: 'k', change: changes.revenue,   up: changesUp.revenue,   color: '#10b981', bg: '#f0fdf4', trend: trends.revenue   },
              { icon: '👥', label: t('stats.customers'),     value: customers, suffix: '',  change: changes.customers, up: changesUp.customers, color: '#8b5cf6', bg: '#f5f3ff', trend: trends.customers },
            ].map((s, i) => (
              <div key={i}
                className="bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 animate-fade-up">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: isDark ? `${s.color}22` : s.bg }}>
                      {s.icon}
                    </div>
                    <Sparkline data={s.trend} color={s.color} />
                  </div>
                  <div className="text-3xl font-black text-slate-900 tabular-nums tracking-tight leading-none">
                    {s.value.toLocaleString('sv-SE')}{s.suffix}
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5 font-medium">{s.label}</div>
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.up
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.up ? '↑' : '↓'} {s.change}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── REVENUE CHART + PIPELINE FUNNEL ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Revenue Area Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-up hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">{t('revenueTrend')}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{t('revenueTrendSub')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t('vsLastYear')}
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#FF6B2C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#FF6B2C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: isDark ? '#4b5563' : '#94a3b8', fontWeight: 600 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: isDark ? '#4b5563' : '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${v}k`}
                  />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#FF6B2C', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#FF6B2C"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#FF6B2C', stroke: isDark ? '#161b22' : 'white', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Month summary strip */}
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Denna månad</p>
                  <p className="text-xl font-black text-slate-900 tabular-nums">{(revenueData[5]?.value ?? 0).toLocaleString('sv-SE')}k kr</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Prognos</p>
                  <p className="text-xl font-black tabular-nums" style={{ color: '#FF6B2C' }}>{forecast.toLocaleString('sv-SE')}k kr</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Konvertering</p>
                  <p className={`text-xl font-black tabular-nums ${convRate >= 50 ? 'text-emerald-600' : convRate >= 25 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {convRate}%
                  </p>
                </div>
              </div>
            </div>

            {/* Sales Funnel */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-up hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">{t('salesFunnel')}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{t('salesFunnelSub')}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-sm">🎯</div>
              </div>

              <div className="space-y-3">
                {FUNNEL_STAGES.map((stage) => {
                  const pct = funnelTotal > 0 ? Math.round((stage.count / funnelTotal) * 100) : 0;
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base leading-none">{stage.icon}</span>
                        <span className="text-xs font-semibold text-slate-600 flex-1 truncate">{stage.label}</span>
                        <span className="text-xs font-black text-slate-800 tabular-nums">{stage.count}</span>
                        <span className="text-[10px] text-slate-400 w-7 text-right font-medium">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${stage.color}, ${stage.color}aa)` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Forecast + overdue */}
              <div className="mt-5 pt-4 border-t border-slate-50 grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3 border border-blue-100 bg-blue-50">
                  <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wide">Vägd prognos</p>
                  <p className="text-base font-black text-blue-700 tabular-nums mt-0.5">{forecast.toLocaleString('sv-SE')}k kr</p>
                  <p className="text-[10px] text-blue-400 mt-0.5">sannolikhetsviktat</p>
                </div>
                {liveOverdue > 0 ? (
                  <div className="rounded-xl p-3 border border-red-100 bg-red-50">
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Försenade</p>
                    <p className="text-base font-black text-red-600 tabular-nums mt-0.5">{liveOverdue}</p>
                    <p className="text-[10px] text-red-400 mt-0.5">kräver åtgärd</p>
                  </div>
                ) : (
                  <div className="rounded-xl p-3 border border-emerald-100 bg-emerald-50">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Uppföljning</p>
                    <p className="text-base font-black text-emerald-700 mt-0.5">✓</p>
                    <p className="text-[10px] text-emerald-500 mt-0.5">inga försenade affärer</p>
                  </div>
                )}
              </div>

              {user?.role !== 'service' && (
                <Link href="/sales/leads" className="mt-4 flex items-center justify-between text-xs font-semibold text-[#FF6B2C] hover:underline">
                  {t('openPipeline')}
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          {/* ── QUICK ACTIONS ──────────────────────────────────────────────────── */}
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 text-sm">{t('quickActions.title')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {user?.role !== 'service' && (
                <QuickAction
                  href="/sales/leads/new"
                  icon="➕"
                  label={t('quickActions.newLead')}
                  desc={t('quickActions.newLeadDesc')}
                  color="#FF6B2C"
                  bg="#fff4ef"
                />
              )}
              <QuickAction
                href="/inventory"
                icon="🏍"
                label={t('quickActions.addVehicle')}
                desc={t('quickActions.addVehicleDesc')}
                color="#3b82f6"
                bg="#eff6ff"
              />
              <QuickAction
                href="/purchase"
                icon="📦"
                label={t('quickActions.purchaseOrder')}
                desc={t('quickActions.purchaseOrderDesc')}
                color="#10b981"
                bg="#f0fdf4"
              />
            </div>
          </div>

          {/* ── RECENT LEADS + TOP SELLING ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Recent Leads */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-up hover:shadow-md transition-shadow">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">{t('recentLeads.title')}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Senast uppdaterade leads</p>
                </div>
                {user?.role !== 'service' && (
                  <Link href="/sales/leads"
                    className="text-xs font-bold text-[#FF6B2C] hover:underline flex items-center gap-1">
                    {t('recentLeads.viewAll')}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>

              <div className="divide-y divide-slate-50">
                {liveRecentLeads.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-3">💰</div>
                    <p className="text-sm font-semibold text-slate-600">Inga leads ännu</p>
                    <p className="text-xs text-slate-400 mt-1">Skapa ditt första lead för att komma igång</p>
                    {user?.role !== 'service' && (
                      <Link href="/sales/leads/new"
                        className="mt-4 px-4 py-2 rounded-xl bg-[#FF6B2C] text-white text-xs font-bold hover:bg-[#e55a1f] transition-colors">
                        Nytt lead
                      </Link>
                    )}
                  </div>
                ) : liveRecentLeads.map((lead, i) => {
                  const color = avatarColor(lead.name);
                  return (
                    <Link key={i} href={`/sales/leads/${lead.id}`}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors group">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm"
                        style={{ background: color }}>
                        {lead.initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 truncate">{lead.name}</span>
                          {lead.verified && (
                            <span className="text-[9px] bg-[#0f1729] text-white px-1.5 py-0.5 rounded font-bold tracking-wide shrink-0">BankID</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{lead.bike}</p>
                      </div>

                      {/* Right: status + value + time */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={lead.status} />
                        <div className="flex items-center gap-2">
                          {lead.rawValue > 0 && (
                            <span className="text-[10px] font-bold text-slate-500">
                              {lead.rawValue >= 1_000_000
                                ? `${(lead.rawValue / 1_000_000).toFixed(1)}M kr`
                                : `${Math.round(lead.rawValue / 1000)}k kr`
                              }
                            </span>
                          )}
                          <span className="text-[10px] text-slate-300">{lead.time}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Top Selling */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-up hover:shadow-md transition-shadow">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">{t('topSelling.title')}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Från betalda fakturor</p>
                </div>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                  {t('topSelling.thisMonth')}
                </span>
              </div>

              <div className="px-6 py-5">
                {liveTopBikes.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-3">🏍</div>
                    <p className="text-sm font-semibold text-slate-600">Inga sålda fordon än</p>
                    <p className="text-xs text-slate-400 mt-1">Betalda fakturor visas här automatiskt</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {liveTopBikes.map((bike, i) => (
                      <div key={i} className="group">
                        <div className="flex items-center gap-3 mb-2">
                          {/* Medal or rank */}
                          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                            {i < 3 ? (
                              <span className="text-xl leading-none">{MEDALS[i]}</span>
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {i + 1}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-slate-900 truncate block">{bike.name}</span>
                          </div>
                          <span className="text-sm font-black text-emerald-600 shrink-0">{bike.rev}</span>
                          <span className="text-xs text-slate-400 shrink-0 w-14 text-right">
                            {bike.sales} {t('topSelling.sold')}
                          </span>
                        </div>
                        <div className="ml-11 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 stat-bar"
                            style={{
                              width: `${(bike.sales / liveTopBikes[0].sales) * 100}%`,
                              background: i === 0
                                ? 'linear-gradient(90deg, #FF6B2C, #ff9a6c)'
                                : i === 1
                                  ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)'
                                  : i === 2
                                    ? 'linear-gradient(90deg, #cd7f32, #e8a87c)'
                                    : '#e2e8f0',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom conversion stat */}
              <div className="mx-6 mb-5 mt-1 p-4 rounded-2xl bg-gradient-to-r from-[#FF6B2C]/5 to-transparent border border-[#FF6B2C]/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#FF6B2C] font-bold uppercase tracking-wide">Konverteringsgrad</p>
                  <p className="text-xl font-black text-slate-900 tabular-nums mt-0.5">{convRate}%</p>
                  <p className="text-[10px] text-slate-400">{liveFunnel.closed} av {liveLeads} leads avslutade</p>
                </div>
                <div className="relative w-14 h-14">
                  <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'} strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#FF6B2C" strokeWidth="3"
                      strokeDasharray={`${convRate} ${100 - convRate}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1)' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black text-slate-700">{convRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
