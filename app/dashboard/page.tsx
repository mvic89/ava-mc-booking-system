'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/auth/login');
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [router]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
        <div className="text-center">
          <div className="text-5xl mb-4">🔄</div>
          <p className="text-slate-600">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      {/* Main Content */}
      <div className="ml-[230px] flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {t('dashboard.welcome', { name: user.givenName || user.name || t('common.user') })} 👋
          </h1>
          <p className="text-slate-600">{t('dashboard.subtitle')}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💰</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">
                {t('dashboard.stats.percentIncrease', { percent: 12 })}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">24</h3>
            <p className="text-sm text-slate-500">{t('dashboard.stats.activeLeads')}</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🏍</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                8 {t('dashboard.stats.new')}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">47</h3>
            <p className="text-sm text-slate-500">{t('dashboard.stats.inventory')}</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📊</span>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-semibold">
                {t('dashboard.stats.thisMonth')}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">1.2M kr</h3>
            <p className="text-sm text-slate-500">{t('dashboard.stats.revenue')}</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">👥</span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">
                +5 {t('dashboard.stats.today')}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">156</h3>
            <p className="text-sm text-slate-500">{t('dashboard.stats.customers')}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t('dashboard.quickActions.title')}</h2>
          <div className="grid grid-cols-3 gap-4">
            <Link
              href="/sales/leads/new"
              className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-[#FF6B2C] hover:bg-orange-50 transition-colors"
            >
              <span className="text-2xl">➕</span>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dashboard.quickActions.newLead')}</h3>
                <p className="text-xs text-slate-500">{t('dashboard.quickActions.newLeadDesc')}</p>
              </div>
            </Link>

            <Link
              href="/inventory"
              className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="text-2xl">🏍</span>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dashboard.quickActions.addInventory')}</h3>
                <p className="text-xs text-slate-500">{t('dashboard.quickActions.addInventoryDesc')}</p>
              </div>
            </Link>

            <Link
              href="/purchase-orders"
              className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <span className="text-2xl">📦</span>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dashboard.quickActions.purchaseOrder')}</h3>
                <p className="text-xs text-slate-500">{t('dashboard.quickActions.purchaseOrderDesc')}</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{t('dashboard.recentLeads.title')}</h2>
            <div className="space-y-3">
              {[
                { name: 'Lars Andersson', interest: 'Ninja ZX-6R', hours: 2, status: 'hot' },
                { name: 'Maria Svensson', interest: 'MT-07', hours: 5, status: 'warm' },
                { name: 'Erik Johansson', interest: 'CB650R', days: 1, status: 'cold' },
              ].map((lead, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{lead.name}</h4>
                    <p className="text-xs text-slate-500">{lead.interest}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      lead.status === 'hot' ? 'bg-red-100 text-red-700' :
                      lead.status === 'warm' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {t(`dashboard.recentLeads.${lead.status}`)}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      {lead.hours ? t('dashboard.recentLeads.hoursAgo', { hours: lead.hours }) : t('dashboard.recentLeads.daysAgo', { days: lead.days || 1 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{t('dashboard.topSelling.title')}</h2>
            <div className="space-y-3">
              {[
                { name: 'Kawasaki Ninja ZX-6R', sales: 12, revenue: '1.8M kr' },
                { name: 'Yamaha MT-07', sales: 9, revenue: '810k kr' },
                { name: 'Honda CB650R', sales: 7, revenue: '735k kr' },
              ].map((bike, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{bike.name}</h4>
                    <p className="text-xs text-slate-500">{t('dashboard.topSelling.sales', { count: bike.sales })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{bike.revenue}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
