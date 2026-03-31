'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function PlatformSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    if (user?.role !== 'platform_admin') router.replace('/dashboard');
  }, [router]);

  const sections = [
    {
      title: 'Platform Identity',
      icon: '🏷️',
      items: [
        { label: 'Platform Name',  value: 'BikeMeNow' },
        { label: 'Domain',         value: 'bikeme.now' },
        { label: 'Support Email',  value: 'support@bikeme.now' },
        { label: 'Admin Email',    value: 'admin@bikeme.now' },
      ],
    },
    {
      title: 'Authentication',
      icon: '🔐',
      items: [
        { label: 'Email + Password', value: 'Enabled' },
        { label: 'BankID (Sweden)',  value: 'Enabled — Test environment' },
        { label: 'Google OAuth',     value: 'Configure in Supabase → Auth → Providers' },
        { label: 'Session TTL',      value: '8 hours (httpOnly cookie)' },
      ],
    },
    {
      title: 'Password Policy',
      icon: '🛡️',
      items: [
        { label: 'Minimum Length',  value: '8 characters' },
        { label: 'Hashing',         value: 'PBKDF2-SHA512 · 100 000 iterations' },
        { label: 'Reset Token TTL', value: '1 hour · single-use' },
        { label: 'Reset Delivery',  value: 'Resend (no-reply@contact.bikeme.now)' },
      ],
    },
    {
      title: 'Data & Compliance',
      icon: '📋',
      items: [
        { label: 'GDPR Basis',      value: 'Legitimate interest + Consent (BankID)' },
        { label: 'Data Location',   value: 'Supabase (EU region)' },
        { label: 'Privacy Policy',  value: '/privacy' },
        { label: 'Terms of Service',value: '/terms' },
      ],
    },
    {
      title: 'Infrastructure',
      icon: '⚡',
      items: [
        { label: 'Framework',       value: 'Next.js 15 · App Router' },
        { label: 'Database',        value: 'Supabase (PostgreSQL)' },
        { label: 'Email Provider',  value: 'Resend' },
        { label: 'Environment',     value: process.env.NODE_ENV ?? 'development' },
      ],
    },
    {
      title: 'Integrations',
      icon: '🔌',
      items: [
        { label: 'BankID',         value: 'Active — Test BankID (BANKID_MOCK_MODE=false)' },
        { label: 'Roaring (SPAR)', value: 'Mock mode (ROARING_MOCK_MODE=true)' },
        { label: 'Klarna',         value: 'Connected via /api/klarna' },
        { label: 'Svea',           value: 'Connected via /api/svea' },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-[#f5f7fa] overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 overflow-y-auto">
        <div className="p-6 md:p-10 max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">⚙️</span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Platform Settings</h1>
              <span className="px-2 py-0.5 bg-[#FF6B2C]/10 text-[#FF6B2C] text-xs font-bold rounded-full border border-[#FF6B2C]/20">
                bikeme.now
              </span>
            </div>
            <p className="text-slate-500 text-sm ml-12">
              Platform-wide configuration overview. Edit environment variables to change infrastructure settings.
            </p>
          </div>

          {/* Settings grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {sections.map(sec => (
              <div key={sec.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{sec.icon}</span>
                  <h3 className="font-bold text-slate-800">{sec.title}</h3>
                </div>
                <div className="space-y-3">
                  {sec.items.map(item => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <span className="text-xs text-slate-400 font-medium min-w-[130px] shrink-0 pt-0.5">{item.label}</span>
                      <span className="text-xs text-slate-700 font-semibold text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🔗</span>
              <h3 className="font-bold text-slate-800">Quick Links</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://supabase.com/dashboard/project/pkphzdognltxduoiqsuz"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-all"
              >
                Supabase Dashboard ↗
              </a>
              <Link
                href="/privacy"
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-all"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-all"
              >
                Terms of Service
              </Link>
              <Link
                href="/admin/users"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B2C]/5 hover:bg-[#FF6B2C]/10 border border-[#FF6B2C]/20 rounded-xl text-sm font-medium text-[#FF6B2C] transition-all"
              >
                🔐 Manage System Admins
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
