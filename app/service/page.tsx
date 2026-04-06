'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

const UPCOMING: { icon: string; title: string; desc: string; eta: string }[] = [
  {
    icon: '🔧',
    title: 'Service Bookings',
    desc: 'Online booking portal where customers can schedule service appointments directly from your website. Auto-assigns a technician and sends confirmation SMS/email.',
    eta: 'Q3 2026',
  },
  {
    icon: '📋',
    title: 'Work Orders',
    desc: 'Digital work orders with parts lists, labour time tracking, and technician sign-off. Linked directly to customer profiles and invoiced on completion.',
    eta: 'Q3 2026',
  },
  {
    icon: '🏍',
    title: 'Service History per Vehicle',
    desc: 'Full maintenance timeline per motorcycle — every oil change, tyre swap, and recall fix logged and searchable by VIN or registration number.',
    eta: 'Q4 2026',
  },
  {
    icon: '⏱',
    title: 'Technician Time Tracking',
    desc: 'Clock in/out per job. Billable vs non-billable hours, overtime alerts, and productivity reports per technician.',
    eta: 'Q4 2026',
  },
  {
    icon: '🔩',
    title: 'Parts & Inventory',
    desc: 'Service-specific parts stock with automatic reorder triggers. Linked to work orders so parts are reserved as soon as a booking is created.',
    eta: 'Q1 2027',
  },
  {
    icon: '💬',
    title: 'Customer Communication',
    desc: 'Automated SMS/email updates at every stage — booking confirmed, bike ready, invoice sent. Two-way messaging so customers can reply directly.',
    eta: 'Q1 2027',
  },
];

const STATS = [
  { value: '2×', label: 'Faster check-in with digital work orders' },
  { value: '40%', label: 'Less time on manual scheduling' },
  { value: '100%', label: 'Service history always accessible' },
];

export default function ServicePage() {
  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/dashboard" className="hover:text-[#FF6B2C] transition-colors">Dashboard</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">Service</span>
          </nav>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">Service</h1>
              <p className="text-sm text-slate-500 mt-1">Workshop management, bookings, and service history</p>
            </div>
            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
              Coming Soon
            </span>
          </div>
        </div>

        <div className="px-5 md:px-8 py-8 max-w-4xl space-y-8">

          {/* Hero card */}
          <div className="bg-gradient-to-br from-[#0b1524] to-[#1a3050] rounded-2xl p-8 text-white relative overflow-hidden">
            {/* decorative circles */}
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />

            <div className="relative">
              <p className="text-4xl mb-4">🔧</p>
              <h2 className="text-2xl font-black mb-3">Service module is on its way</h2>
              <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                We're building a full workshop management system designed specifically for motorcycle dealerships.
                From online bookings to digital work orders, technician time tracking, and parts management —
                everything in one place, fully connected to your existing CRM and invoicing.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-full">🗓 Launching Q3 2026</span>
                <span className="text-xs font-bold bg-[#FF6B2C]/80 px-3 py-1.5 rounded-full">Early access available</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {STATS.map(s => (
              <div key={s.value} className="bg-white rounded-2xl border border-slate-100 p-5 text-center">
                <p className="text-3xl font-black text-[#FF6B2C]">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Upcoming features */}
          <div>
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">What's coming</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {UPCOMING.map(f => (
                <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#f5f7fa] flex items-center justify-center text-xl shrink-0">
                      {f.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-slate-900">{f.title}</p>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{f.eta}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notify me */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="text-sm font-bold text-slate-900 mb-1">Want early access?</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                We're onboarding a limited number of dealerships to shape the service module before public launch.
                Contact your account manager or reach out to <strong>support@bikemenow.com</strong>.
              </p>
            </div>
            <a
              href="mailto:support@bikemenow.com?subject=Service Module Early Access"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors"
            >
              Request early access →
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
