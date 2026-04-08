'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// ── Static config (non-translated) ────────────────────────────────────────────

const FEATURE_META = [
  { icon: '🏍', color: '#FF6B2C', bg: '#fff4ef' },
  { icon: '🪪', color: '#3b82f6', bg: '#eff6ff' },
  { icon: '📄', color: '#10b981', bg: '#f0fdf4' },
  { icon: '💳', color: '#8b5cf6', bg: '#f5f3ff' },
  { icon: '📊', color: '#f59e0b', bg: '#fffbeb' },
  { icon: '🔔', color: '#ef4444', bg: '#fef2f2' },
  { icon: '👥', color: '#0891b2', bg: '#f0f9ff' },
  { icon: '🔧', color: '#16a34a', bg: '#f0fdf4' },
] as const;

const STEP_META = [
  { icon: '🚶', color: '#FF6B2C' },
  { icon: '📋', color: '#8b5cf6' },
  { icon: '✍️', color: '#10b981' },
  { icon: '💰', color: '#3b82f6' },
] as const;

const TESTIMONIAL_META = [
  { initials: 'EL', color: '#FF6B2C' },
  { initials: 'AS', color: '#10b981' },
  { initials: 'MN', color: '#8b5cf6' },
] as const;

const LOGOS = [
  { name: 'Klarna', abbr: 'K', color: '#ffb3c7', text: '#1a0010' },
  { name: 'Swish', abbr: 'S', color: '#dbeafe', text: '#1e40af' },
  { name: 'BankID', abbr: 'BID', color: '#e0f2fe', text: '#0369a1' },
  { name: 'Svea', abbr: 'SV', color: '#fef9c3', text: '#713f12' },
  { name: 'Fortnox', abbr: 'FX', color: '#dcfce7', text: '#14532d' },
  { name: 'Trustly', abbr: 'T', color: '#f3e8ff', text: '#6b21a8' },
];

const STAT_ICONS = ['⚡', '📈', '📄', '🛡️'];
const PLAN_PRICES = ['2 000', '5 000', '8 000'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-6 group"
      >
        <span className="text-sm font-semibold text-slate-800 group-hover:text-[#FF6B2C] transition-colors">{q}</span>
        <span className={`w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 text-xs shrink-0 transition-all ${open ? 'bg-[#FF6B2C] border-[#FF6B2C] text-white rotate-180' : ''}`}>▼</span>
      </button>
      {open && <p className="text-sm text-slate-500 leading-relaxed pb-5 -mt-1 pr-10">{a}</p>}
    </div>
  );
}

// ── Showcase card mockups ──────────────────────────────────────────────────────

function AnalyticsMockup() {
  const bars = [55, 70, 45, 85, 60, 95, 75, 88, 65, 92, 80, 100];
  return (
    <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #070e1a, #0f2040)' }}>
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      {/* Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle,#FF6B2C 0%,transparent 70%)' }} />
      {/* Header row */}
      <div className="absolute top-5 left-5 right-5 flex items-center justify-between">
        <div>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest">Revenue — 2026</p>
          <p className="text-xl font-black text-white mt-0.5">1 248 400 kr</p>
          <span className="text-[10px] font-bold text-emerald-400">↑ +40% vs last year</span>
        </div>
        <div className="flex gap-1">
          {['1M','3M','YTD'].map((l,i) => (
            <span key={l} className={`text-[9px] font-bold px-2 py-1 rounded-md ${i===2 ? 'bg-[#FF6B2C] text-white' : 'text-slate-500'}`}>{l}</span>
          ))}
        </div>
      </div>
      {/* Bar chart */}
      <div className="absolute bottom-5 left-5 right-5 flex items-end gap-1.5" style={{ height: '45%' }}>
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 11 ? 'linear-gradient(180deg,#FF6B2C,#ff8c52)' : `rgba(255,107,44,${0.25 + i * 0.05})` }} />
        ))}
      </div>
      {/* Bottom labels */}
      <div className="absolute bottom-1 left-5 right-5 flex justify-between">
        {['Jan','Mar','May','Jul','Sep','Nov'].map(m => (
          <span key={m} className="text-[8px] text-slate-600">{m}</span>
        ))}
      </div>
    </div>
  );
}

function PipelineMockup() {
  const cols = [
    { name: 'Ny', count: 3, color: '#FF6B2C' },
    { name: 'Kontaktad', count: 2, color: '#f59e0b' },
    { name: 'Förhandling', count: 4, color: '#8b5cf6' },
    { name: 'Avslutad', count: 2, color: '#10b981' },
  ];
  return (
    <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex-1 h-4 rounded bg-slate-100 mx-2" />
        <div className="w-14 h-4 rounded-full bg-[#FF6B2C]/20 flex items-center justify-center">
          <span className="text-[8px] font-bold text-[#FF6B2C]">+ Lead</span>
        </div>
      </div>
      {/* Kanban */}
      <div className="grid grid-cols-4 gap-2 p-3 h-full">
        {cols.map(col => (
          <div key={col.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{col.name}</span>
              <span className="ml-auto text-[8px] font-black text-slate-400">{col.count}</span>
            </div>
            {Array.from({ length: col.count }).map((_, j) => (
              <div key={j} className="rounded-lg p-2 bg-white border border-slate-100 shadow-sm">
                <div className="h-1.5 rounded-full mb-1" style={{ background: col.color, width: `${55 + j * 12}%`, opacity: 0.7 }} />
                <div className="h-1 rounded-full bg-slate-100 w-3/4 mb-1" />
                <div className="flex items-center justify-between mt-1.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white font-black" style={{ background: col.color }}>✓</div>
                  <span className="text-[7px] text-slate-400">{120 + j * 45}k kr</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileMockup() {
  return (
    <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff, #e8f0fe)' }}>
      {/* Background circles */}
      <div className="absolute top-4 right-4 w-32 h-32 rounded-full opacity-30" style={{ background: 'radial-gradient(circle,#3b82f6,transparent)' }} />
      <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full opacity-20" style={{ background: 'radial-gradient(circle,#FF6B2C,transparent)' }} />
      {/* Phone frame */}
      <div className="relative z-10 w-28 rounded-[18px] overflow-hidden shadow-2xl border-2 border-slate-200 bg-white">
        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900">
          <span className="text-[7px] text-white font-bold">9:41</span>
          <div className="flex gap-0.5">
            {[1,2,3].map(i => <div key={i} className="w-0.5 h-1.5 bg-white/70 rounded-full" />)}
          </div>
        </div>
        {/* App header */}
        <div className="px-2.5 py-2 border-b border-slate-100 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-[#FF6B2C] flex items-center justify-center">
            <span className="text-[6px] text-white font-black">B</span>
          </div>
          <span className="text-[8px] font-bold text-slate-800">BikeMeNow</span>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
        {/* Stats */}
        <div className="p-2 space-y-1.5">
          {[
            { label: 'Pipeline', value: '1.2M kr', color: '#FF6B2C' },
            { label: 'Leads', value: '23', color: '#8b5cf6' },
            { label: 'Revenue', value: '+40%', color: '#10b981' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: `${s.color}10` }}>
              <span className="text-[7px] text-slate-500">{s.label}</span>
              <span className="text-[8px] font-black" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        {/* CTA button */}
        <div className="px-2 pb-2">
          <div className="w-full py-1.5 rounded-lg text-center text-[7px] font-black text-white" style={{ background: 'linear-gradient(90deg,#FF6B2C,#ff8c52)' }}>
            + New Lead
          </div>
        </div>
      </div>
      {/* Floating badge */}
      <div className="absolute top-6 left-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white shadow-lg border border-slate-100">
        <span className="text-[8px]">✓</span>
        <span className="text-[8px] font-bold text-slate-700">BankID verified</span>
      </div>
      <div className="absolute bottom-8 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white shadow-lg border border-slate-100">
        <span className="text-[8px] text-emerald-500">💰</span>
        <span className="text-[8px] font-bold text-slate-700">Payment received</span>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const hasChecked = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useTranslations('landing');

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    if (localStorage.getItem('user')) router.replace('/dashboard');
  }, [router]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const FEATURES = FEATURE_META.map((m, i) => ({
    ...m,
    title: t(`features.f${i + 1}t` as any),
    desc: t(`features.f${i + 1}d` as any),
  }));

  const HOW_IT_WORKS = STEP_META.map((m, i) => ({
    ...m,
    step: `0${i + 1}`,
    title: t(`how.s${i + 1}t` as any),
    desc: t(`how.s${i + 1}d` as any),
  }));

  const TESTIMONIALS = TESTIMONIAL_META.map((m, i) => ({
    ...m,
    quote: t(`testimonials.q${i + 1}` as any),
    name: t(`testimonials.n${i + 1}` as any),
    role: t(`testimonials.r${i + 1}` as any),
    company: t(`testimonials.c${i + 1}` as any),
  }));

  const STATS = STAT_ICONS.map((icon, i) => ({
    icon,
    value: t(`stats.s${i + 1}v` as any),
    label: t(`stats.s${i + 1}l` as any),
  }));

  const PLANS = [
    {
      id: 'basic',
      name: t('pricing.basic'),
      price: PLAN_PRICES[0],
      desc: t('pricing.basicDesc'),
      features: [t('pricing.f_users3'), t('pricing.f_leads50'), t('pricing.f_bankid'), t('pricing.f_paymentsBasic'), t('pricing.f_email')],
      highlight: false,
    },
    {
      id: 'standard',
      name: t('pricing.standard'),
      price: PLAN_PRICES[1],
      desc: t('pricing.standardDesc'),
      features: [t('pricing.f_usersUnlimited'), t('pricing.f_leadsUnlimited'), t('pricing.f_bankid'), t('pricing.f_paymentsAll'), t('pricing.f_notifications'), t('pricing.f_support')],
      highlight: true,
    },
    {
      id: 'pro',
      name: t('pricing.pro'),
      price: PLAN_PRICES[2],
      desc: t('pricing.proDesc'),
      features: [t('pricing.f_everything'), t('pricing.f_multiLocation'), t('pricing.f_api'), t('pricing.f_reports'), t('pricing.f_integrations'), t('pricing.f_account')],
      highlight: false,
    },
  ];

  const FAQS = [1, 2, 3, 4, 5, 6].map(i => ({
    q: t(`faq.q${i}` as any),
    a: t(`faq.a${i}` as any),
  }));

  const SHOWCASE_CARDS = [
    { title: t('showcase.c1title' as any), desc: t('showcase.c1desc' as any), Mockup: AnalyticsMockup },
    { title: t('showcase.c2title' as any), desc: t('showcase.c2desc' as any), Mockup: PipelineMockup },
    { title: t('showcase.c3title' as any), desc: t('showcase.c3desc' as any), Mockup: MobileMockup },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* ── Sticky Nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-10 w-auto object-contain" />
          </Link>
          <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-[#FF6B2C] transition-colors">{t('nav.features')}</a>
            <a href="#how-it-works" className="hover:text-[#FF6B2C] transition-colors">{t('nav.howItWorks')}</a>
            <a href="#pricing" className="hover:text-[#FF6B2C] transition-colors">{t('nav.pricing')}</a>
            <a href="#testimonials" className="hover:text-[#FF6B2C] transition-colors">{t('nav.reviews')}</a>
            <a href="#faq" className="hover:text-[#FF6B2C] transition-colors">{t('nav.faq')}</a>
            <a href="mailto:info@bikeme.now" className="hover:text-[#FF6B2C] transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <LanguageSwitcher variant="landing" />
            <Link href="/auth/login" className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-[#FF6B2C] transition-colors px-3 py-2">
              {t('nav.login')}
            </Link>
            <Link href="/auth/signup" className="text-sm font-bold bg-[#FF6B2C] hover:bg-[#e55a1f] text-white px-4 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-orange-200">
              {t('nav.freeTrial')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      {/* NOTE: hero background intentionally unchanged */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #070e1a 0%, #0f1d35 50%, #1a2f50 100%)' }}>
        {/* Glows */}
        <div className="absolute top-0 right-0 w-150 h-150 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #FF6B2C 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-100 h-100 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-24 pb-20">

          {/* 2-col on XL: text left, live activity cards right */}
          <div className="grid xl:grid-cols-[1fr_360px] gap-12 items-start mb-16">
            {/* Left: hero text */}
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border mb-8"
                style={{ borderColor: 'rgba(255,107,44,0.4)', background: 'rgba(255,107,44,0.1)', color: '#ffa07a' }}>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                {t('hero.badge')}
              </div>
              <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight text-white mb-6">
                {t('hero.headline1')}<br />
                <span style={{ background: 'linear-gradient(90deg, #FF6B2C, #ffaa7a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {t('hero.headline2')}
                </span>
              </h1>
              <p className="text-slate-300 text-lg md:text-xl leading-relaxed max-w-2xl mb-10">
                {t('hero.sub')}
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <Link href="/auth/signup"
                  className="inline-flex items-center gap-2.5 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #FF6B2C, #ff8c52)', boxShadow: '0 8px 32px rgba(255,107,44,0.35)' }}>
                  {t('hero.cta1')} <span className="text-lg">→</span>
                </Link>
                <Link href="/auth/login"
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium text-sm transition-colors border border-white/20 hover:border-white/40 px-6 py-4 rounded-2xl">
                  {t('hero.cta2')}
                </Link>
              </div>
              <p className="text-slate-500 text-xs">{t('hero.disclaimer')}</p>
            </div>

            {/* Right: live activity feed — hidden below xl */}
            <div className="hidden xl:flex flex-col gap-3 pt-6">
              {/* Live activity header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Live activity</span>
              </div>
              {[
                { icon: '✅', title: 'Deal signed — 342 800 kr', sub: 'Erik Lindström · Moto Stockholm', color: '#10b981', time: '2m ago' },
                { icon: '🪪', title: 'BankID verified instantly', sub: 'Anna Svensson · Göteborg', color: '#3b82f6', time: 'just now' },
                { icon: '💰', title: 'Payment received · Klarna', sub: '189 000 kr · Malmö MC', color: '#FF6B2C', time: '5m ago' },
                { icon: '📄', title: 'Agreement auto-generated', sub: 'Marcus N. · 1 click', color: '#8b5cf6', time: '8m ago' },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ background: `${a.color}20` }}>{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">{a.sub}</p>
                  </div>
                  <span className="text-[9px] text-slate-600 shrink-0">{a.time}</span>
                </div>
              ))}
              {/* Mini pipeline summary */}
              <div className="mt-1 px-4 py-4 rounded-2xl" style={{ background: 'rgba(255,107,44,0.08)', border: '1px solid rgba(255,107,44,0.2)' }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pipeline today</p>
                <div className="flex items-end gap-1 h-10">
                  {[45, 65, 55, 80, 70, 90, 85].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 6 ? '#FF6B2C' : 'rgba(255,107,44,0.3)' }} />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs font-black text-white">1 248 400 kr</p>
                  <span className="text-[10px] font-bold text-emerald-400">↑ +12%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Video + Pipeline — side by side */}
          <div className="grid lg:grid-cols-[55fr_45fr] gap-6 items-stretch">

            {/* LEFT — Video player */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF6B2C] animate-pulse" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Life is short. Buy the bike. Take the ride</span>
              </div>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl flex-1" style={{ border: '1px solid rgba(255,107,44,0.3)', background: '#000' }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover block"
                  controls
                  playsInline
                  muted
                  poster="/bike1.jpeg"
                >
                  <source src="/api/media/movie.mp4" type="video/mp4" />
                </video>
              </div>
            </div>

            {/* RIGHT — Sales Pipeline mock */}
            <div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ border: '1px solid rgba(255,255,255,0.1)', background: '#0d1b2e' }}>
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-3 py-1 rounded-md text-[11px] text-slate-500 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    BikeMeNow — Sales Pipeline
                  </div>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-4 flex-1">
                {/* KPI cards — 2×2 */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Pipeline value', value: '1.24M kr', color: '#FF6B2C', up: '+12%' },
                    { label: 'Revenue (month)', value: '342 800 kr', color: '#10b981', up: '+8%' },
                    { label: 'Active leads', value: '23', color: '#8b5cf6', up: '+5' },
                    { label: 'Closing rate', value: '68%', color: '#f59e0b', up: '+3%' },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
                      <p className="text-base font-black" style={{ color: k.color }}>{k.value}</p>
                      <p className="text-[9px] text-emerald-400 mt-0.5">↑ {k.up}</p>
                    </div>
                  ))}
                </div>

                {/* Kanban columns */}
                <div className="grid grid-cols-3 gap-2 flex-1">
                  {[
                    { name: 'Ny', count: 3, color: '#FF6B2C' },
                    { name: 'Förhandling', count: 3, color: '#3b82f6' },
                    { name: 'Avslutad', count: 2, color: '#10b981' },
                  ].map((col) => (
                    <div key={col.name} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-1 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{col.name}</p>
                        <span className="ml-auto text-[9px] font-black text-slate-500">{col.count}</span>
                      </div>
                      {Array.from({ length: col.count }).map((_, j) => (
                        <div key={j} className="rounded-lg p-2 mb-1.5 last:mb-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-1.5 rounded-full mb-1" style={{ background: col.color, width: `${50 + j * 15}%`, opacity: 0.8 }} />
                          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', width: '70%' }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Bottom highlights */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { icon: '⚡', label: 'BankID', desc: 'Instant verify' },
                    { icon: '💳', label: 'Swish', desc: 'Instant pay' },
                    { icon: '📄', label: 'Auto', desc: 'Agreements' },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center gap-1 py-2 rounded-xl text-center" style={{ background: 'rgba(255,107,44,0.07)', border: '1px solid rgba(255,107,44,0.15)' }}>
                      <span className="text-sm">{item.icon}</span>
                      <p className="text-[9px] font-black text-white">{item.label}</p>
                      <p className="text-[8px] text-slate-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Integration logos ────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100 py-6">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">{t('integrations.label')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5">
            {LOGOS.map(l => (
              <div key={l.name} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: l.color, color: l.text }}>{l.abbr}</div>
                <span className="text-sm font-semibold text-slate-600">{l.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bike Reveal Strip — bike1 ──────────────────────────────────────── */}
      <section className="relative h-64 md:h-80 overflow-hidden">
        <img
          src="/bike1.jpeg"
          alt="Motorcycle"
          className="w-full h-full object-cover object-center"
          style={{ transform: 'scale(1.05)', filter: 'brightness(0.55)' }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(7,14,26,0.92) 0%, rgba(7,14,26,0.4) 55%, rgba(7,14,26,0.15) 100%)' }} />
        <div className="absolute inset-0 flex items-center px-8 md:px-20">
          <div>
            <p className="text-[#FF6B2C] text-xs font-black uppercase tracking-widest mb-3">Built for the industry</p>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight max-w-2xl">
              Sell more bikes.<br />
              <span style={{ background: 'linear-gradient(90deg, #FF6B2C, #ffaa7a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Close faster.</span>
            </h2>
            <p className="text-slate-300 text-sm mt-3 max-w-md">The complete platform purpose-built for motorcycle dealerships.</p>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <section className="py-16 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0b1524, #1a3050)' }}>
        <div className="absolute inset-0">
          <img src="/bike2.jpeg" alt="" className="w-full h-full object-cover opacity-15 mix-blend-luminosity" style={{ objectPosition: 'center 60%' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(11,21,36,0.88) 0%, rgba(26,48,80,0.82) 100%)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(s => (
            <div key={s.value} className="text-center p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-3xl font-black text-white mb-1">{s.value}</p>
              <p className="text-xs text-slate-400 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Showcase (3 visual cards) ────────────────────────────────────────── */}
      <section className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">{t('showcase.badge' as any)}</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#0b1524] mb-4">{t('showcase.title' as any)}</h2>
            <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">{t('showcase.sub' as any)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SHOWCASE_CARDS.map(({ title, desc, Mockup }) => (
              <div key={title} className="group flex flex-col">
                <div className="rounded-2xl overflow-hidden mb-6 shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                  <Mockup />
                </div>
                <div className="flex-1">
                  <div className="w-10 h-1 rounded-full bg-[#FF6B2C] mb-4" />
                  <h3 className="text-xl font-black text-[#0b1524] mb-3">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bike Gallery Split — bike3 ──────────────────────────────────────── */}
      <section className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl h-72 md:h-96 group">
              <img
                src="/bike7.jpeg"
                alt="Motorcycle showcase"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                style={{ objectPosition: 'center' }}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(7,14,26,0.6) 0%, transparent 60%)' }} />
              <div className="absolute bottom-6 left-6">
                <span className="text-[10px] font-black text-[#FF6B2C] uppercase tracking-widest">Premium fleet</span>
                <p className="text-white font-black text-xl mt-1">Every model. Every deal.</p>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">Why BikeMeNow</span>
                <h2 className="text-3xl md:text-4xl font-black text-[#0b1524] leading-tight mb-4">
                  Designed around<br />how you actually work
                </h2>
                <p className="text-slate-500 leading-relaxed text-sm">From the first test-ride inquiry to a signed deal and Swish payment — every step lives in one place. No more spreadsheets. No more missed follow-ups.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: '⚡', label: 'Instant BankID ID', desc: 'Verify customers in seconds' },
                  { icon: '📄', label: 'Auto agreements', desc: 'Legally compliant, 1 click' },
                  { icon: '💳', label: 'All payment methods', desc: 'Klarna, Swish, Svea & more' },
                  { icon: '📊', label: 'Live analytics', desc: 'Pipeline value in real-time' },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#FF6B2C]/30 hover:shadow-md transition-all">
                    <span className="text-xl mb-2 block">{item.icon}</span>
                    <p className="text-xs font-bold text-slate-900">{item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">{t('features.badge')}</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#0b1524] mb-4">{t('features.title')}</h2>
            <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">{t('features.sub')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-transparent hover:shadow-xl transition-all duration-300 cursor-default">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-all group-hover:scale-110" style={{ background: f.bg }}>{f.icon}</div>
                <div className="w-8 h-0.5 rounded-full mb-3 transition-all group-hover:w-12" style={{ background: f.color }} />
                <h3 className="text-sm font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">{t('how.badge')}</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#0b1524] mb-4">{t('how.title')}</h2>
            <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">{t('how.sub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-16 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, #FF6B2C, #FF6B2C, transparent)' }} />
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg transition-all group">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shadow-md" style={{ background: step.color }}>{i + 1}</div>
                <div className="mt-3 mb-4 text-3xl">{step.icon}</div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                <div className="mt-4 h-1 rounded-full w-8 group-hover:w-16 transition-all" style={{ background: step.color }} />
              </div>
            ))}
          </div>
          {/* BankID callout */}
          <div className="mt-10 rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0b1524, #1a3050)' }}>
            <div className="p-10 md:p-14 flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#FF6B2C' }}>{t('how.bankidBadge')}</span>
                <h3 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">{t('how.bankidTitle')}</h3>
                <p className="text-slate-300 leading-relaxed mb-8 max-w-lg">{t('how.bankidDesc')}</p>
                <Link href="/auth/signup" className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-xl text-sm text-white transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #FF6B2C, #ff8c52)', boxShadow: '0 4px 20px rgba(255,107,44,0.3)' }}>
                  {t('how.bankidCta')}
                </Link>
              </div>
              <div className="shrink-0 flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-3xl flex items-center justify-center text-6xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>🪪</div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">{t('how.bankidPowered')}</p>
                  <p className="text-sm font-bold text-white">{t('how.bankidBy')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">{t('testimonials.badge')}</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#0b1524]">{t('testimonials.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(testimonial => (
              <div key={testimonial.name} className="rounded-2xl p-8 flex flex-col relative overflow-hidden border border-slate-100 hover:shadow-xl transition-all group"
                style={{ background: 'linear-gradient(145deg, #ffffff, #f8fafc)' }}>
                <div className="absolute top-5 right-6 text-6xl font-black leading-none select-none opacity-10" style={{ color: testimonial.color }}>"</div>
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: 5 }).map((_, i) => <span key={i} className="text-amber-400 text-sm">★</span>)}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed flex-1 mb-6 relative z-10">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${testimonial.color}, ${testimonial.color}99)` }}>
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{testimonial.name}</p>
                    <p className="text-xs text-slate-400">{testimonial.role} · {testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">{t('pricing.badge')}</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#0b1524] mb-4">{t('pricing.title')}</h2>
            <p className="text-slate-500 max-w-md mx-auto">{t('pricing.sub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map(p => (
              <div key={p.id} className={`rounded-3xl flex flex-col relative ${p.highlight ? 'shadow-2xl scale-[1.03]' : 'border border-slate-200 bg-white'}`}
                style={p.highlight ? { background: 'linear-gradient(145deg, #0b1524, #1a3050)' } : {}}>
                {p.highlight && (
                  <div className="absolute -top-4 inset-x-0 flex justify-center">
                    <span className="text-[11px] font-black text-white px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #FF6B2C, #ff8c52)' }}>{t('pricing.popular')}</span>
                  </div>
                )}
                <div className="p-8 flex flex-col flex-1">
                  <p className="text-xs font-black uppercase tracking-widest mb-2 text-slate-400">{p.name}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`text-4xl font-black ${p.highlight ? 'text-white' : 'text-slate-900'}`}>{p.price}</span>
                    <span className="text-sm text-slate-400">{t('pricing.perMonth')}</span>
                  </div>
                  <p className={`text-xs mb-8 ${p.highlight ? 'text-slate-400' : 'text-slate-500'}`}>{p.desc}</p>
                  <ul className="flex-1 space-y-3 mb-8">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-xs">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black"
                          style={{ background: p.highlight ? 'rgba(255,107,44,0.2)' : '#f0fdf4', color: p.highlight ? '#FF6B2C' : '#16a34a' }}>✓</div>
                        <span className={p.highlight ? 'text-slate-200' : 'text-slate-600'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/auth/signup?plan=${p.id}`}
                    className={`block text-center py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] ${p.highlight ? 'text-white' : 'bg-slate-900 text-white hover:bg-[#0b1524]'}`}
                    style={p.highlight ? { background: 'linear-gradient(135deg, #FF6B2C, #ff8c52)', boxShadow: '0 4px 20px rgba(255,107,44,0.3)' } : {}}>
                    {t('pricing.cta')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">{t('pricing.vatNote')}</p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-28 bg-slate-50">
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">{t('faq.badge')}</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#0b1524]">{t('faq.title')}</h2>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm px-6 divide-y divide-slate-100">
            {FAQS.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0' }}>
            <div className="grid md:grid-cols-[1fr_auto] items-center gap-8 p-10 md:p-14">
              <div>
                <span className="inline-block text-xs font-black text-[#FF6B2C] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full mb-4">{t('contact.badge' as any)}</span>
                <h2 className="text-3xl md:text-4xl font-black text-[#0b1524] mb-3">{t('contact.title' as any)}</h2>
                <p className="text-slate-500 leading-relaxed">
                  {t('contact.sub' as any)}{' '}
                  <a href="mailto:info@bikeme.now" className="font-bold text-[#FF6B2C] hover:underline">
                    info@bikeme.now
                  </a>{' '}
                  — {t('contact.sub' as any).includes('we') ? "and we'll tell you more about the service." : 'och vi berättar mer om tjänsten.'}
                </p>
              </div>
              <div className="shrink-0">
                <a
                  href="mailto:info@bikeme.now"
                  className="inline-flex items-center gap-2.5 font-bold px-8 py-4 rounded-2xl text-sm text-white transition-all hover:scale-105 hover:shadow-xl hover:shadow-orange-200 whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #FF6B2C, #ff8c52)', boxShadow: '0 4px 20px rgba(255,107,44,0.25)' }}
                >
                  ✉ {t('contact.cta' as any)}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Full-width Bike Banner — bike4 ──────────────────────────────────── */}
      <section className="relative h-56 md:h-72 overflow-hidden">
        <img
          src="/bike4.jpeg"
          alt="Motorcycle"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 40%', filter: 'brightness(0.5) saturate(1.2)' }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(7,14,26,0.7) 0%, rgba(255,107,44,0.15) 50%, rgba(7,14,26,0.8) 100%)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <p className="text-[#FF6B2C] text-xs font-black uppercase tracking-[0.25em] mb-3">Your dealership, elevated</p>
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight max-w-2xl">
            The road to more sales<br />
            <span style={{ background: 'linear-gradient(90deg, #FF6B2C, #ffaa7a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>starts here.</span>
          </h2>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-32" style={{ background: 'linear-gradient(135deg, #070e1a 0%, #0f1d35 60%, #1a2f50 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-175 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #FF6B2C 0%, transparent 65%)' }} />
        </div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="relative max-w-3xl mx-auto px-5 md:px-8 text-center">
          <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-16 w-auto object-contain mx-auto mb-8 opacity-90" />
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            {t('cta.title1')}<br />
            <span style={{ background: 'linear-gradient(90deg, #FF6B2C, #ffaa7a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t('cta.title2')}
            </span>
          </h2>
          <p className="text-slate-300 leading-relaxed mb-12 max-w-xl mx-auto text-lg">{t('cta.sub')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 text-white font-bold px-10 py-4 rounded-2xl text-base transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #FF6B2C, #ff8c52)', boxShadow: '0 8px 40px rgba(255,107,44,0.35)' }}>
              {t('cta.cta1')}
            </Link>
            <Link href="/auth/login" className="text-sm text-slate-400 hover:text-white font-semibold transition-colors border border-white/20 hover:border-white/40 px-6 py-4 rounded-2xl">
              {t('cta.cta2')}
            </Link>
          </div>
          <p className="mt-8 text-xs text-slate-600">{t('cta.disclaimer')}</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-[#050c17] text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
            <div className="max-w-xs">
              <div className="mb-4">
                <div className="bg-white rounded-xl p-1.5 inline-block">
                  <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-9 w-auto object-contain" />
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{t('footer.desc')}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-10 text-sm">
              <div>
                <p className="text-white font-bold mb-4">{t('footer.product')}</p>
                <ul className="space-y-2.5">
                  <li><a href="#features" className="hover:text-white transition-colors">{t('footer.features')}</a></li>
                  <li><a href="#pricing" className="hover:text-white transition-colors">{t('footer.pricing')}</a></li>
                  <li><a href="#how-it-works" className="hover:text-white transition-colors">{t('footer.howItWorks')}</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">{t('footer.faqLink')}</a></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-bold mb-4">{t('footer.account')}</p>
                <ul className="space-y-2.5">
                  <li><Link href="/auth/signup" className="hover:text-white transition-colors">{t('footer.signup')}</Link></li>
                  <li><Link href="/auth/login" className="hover:text-white transition-colors">{t('footer.login')}</Link></li>
                  <li><Link href="/auth/forgot-password" className="hover:text-white transition-colors">{t('footer.resetPw')}</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-bold mb-4">{t('footer.legal')}</p>
                <ul className="space-y-2.5">
                  <li><Link href="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</Link></li>
                  <li>
                    <a href="mailto:info@bikeme.now" className="hover:text-white transition-colors flex items-center gap-1.5">
                      <span className="text-[#FF6B2C] text-xs">✉</span>
                      info@bikeme.now
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} {t('footer.copy')}</p>
            <p>{t('footer.legal2')}</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
