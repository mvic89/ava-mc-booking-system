'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { notify } from '@/lib/notifications';
import BankIDModal from '@/components/bankIdModel';
import PhoneInput from '@/components/PhoneInput';
import type { BankIDResult, Demo } from '@/types';

type TabType = 'bankid' | 'manual' | 'phone';

const NewLeadPage = () => {
  const router = useRouter();
  const t = useTranslations();
  const tNotif = useTranslations('notifications');

  const [activeTab, setActiveTab] = useState<TabType>('bankid');
  const [showBankID, setShowBankID] = useState(false);
  const [bankIDData, setBankIDData] = useState<BankIDResult | null>(null);
  const [user, setUser] = useState<any>(null);
  const [gdprConsent, setGdprConsent] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/auth/login');
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [router]);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    source: 'Walk-in',
    notes: '',
    interest: '',
  });

  const handleBankIDComplete = (result: BankIDResult) => {
    setBankIDData(result);
    setShowBankID(false);

    // Auto-fill form
    const fullAddress = result.roaring?.address
      ? `${result.roaring.address.street}, ${result.roaring.address.postalCode} ${result.roaring.address.city}`
      : '';

    setFormData(prev => ({
      ...prev,
      name: result.user.name,
      address: fullAddress,
      dateOfBirth: (result.user as any).dateOfBirth || '',
      gender: result.roaring?.gender || '',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build initials from name
    const parts = formData.name.trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : formData.name.slice(0, 2).toUpperCase();

    const newLead = {
      id: Date.now(),
      name: formData.name,
      bike: formData.interest || '—',
      value: '—',
      time: 'Just now',
      status: 'warm' as const,
      verified: !!bankIDData,
      stage: 'new' as const,
      initials,
      email: formData.email,
      phone: formData.phone,
    };

    // Persist to localStorage so the pipeline page can display it
    const existing = JSON.parse(localStorage.getItem('custom_leads') || '[]');
    localStorage.setItem('custom_leads', JSON.stringify([newLead, ...existing]));

    notify('newLead', {
      type:    'lead',
      title:   tNotif('actions.newLead.title'),
      message: `${newLead.name} ${tNotif('actions.newLead.interestedIn')} ${newLead.bike}`,
      href:    '/sales/leads',
    });
    toast.success('Lead created successfully!');
    router.push('/sales/leads');
  };

  const matchingVehicles = [
    { name: 'Ninja ZX-6R', price: '150k kr', match: 92 },
    { name: 'MT-07', price: '89.9k kr', match: 87 },
    { name: 'CB650R', price: '105k kr', match: 81 },
    { name: 'GSX-S750', price: '112k kr', match: 74 },
  ];

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
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="lg:ml-64 flex-1 flex flex-col lg:flex-row">
        {/* Center Content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Breadcrumb */}
          <div className="text-sm text-slate-500 mb-4">
            {t('newLead.breadcrumb.sales')} → <span className="text-slate-700">{t('newLead.breadcrumb.newLead')}</span>
          </div>

          {/* Title */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('newLead.title')}</h1>
          </div>

          {/* Identification Method Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-6 mb-4 md:mb-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 mb-2">{t('newLead.identifyCustomer')}</h2>
            <p className="text-xs md:text-sm text-slate-500 mb-4">{t('newLead.identifyCustomerDesc')}</p>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
              <button
                onClick={() => {
                  setActiveTab('bankid');
                  setShowBankID(true);
                }}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'bankid'
                    ? 'bg-[#235971] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                🔒 {t('newLead.tabs.bankid')}
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'manual'
                    ? 'bg-[#235971] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                ✏️ {t('newLead.tabs.manual')}
              </button>
              <button
                onClick={() => setActiveTab('phone')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'phone'
                    ? 'bg-[#235971] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                📞 {t('newLead.tabs.phone')}
              </button>
            </div>

            {/* Success Banner */}
            {bankIDData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 text-xl">✅</span>
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      {t('newLead.successBanner', {
                        name: bankIDData.user.name,
                        personalNumber: bankIDData.user.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('newLead.fields.name')}
                    {bankIDData && (
                      <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold">
                        {t('newLead.badges.bankid')}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!!bankIDData}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${bankIDData
                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                        : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'
                      }`}
                    required
                  />
                </div>

                {/* Address Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('newLead.fields.address')}
                    {bankIDData?.roaring && (
                      <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded font-semibold">
                        {t('newLead.badges.registration')}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    disabled={!!bankIDData?.roaring}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${bankIDData?.roaring
                        ? 'bg-green-50 border-green-200 text-slate-600'
                        : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'
                      }`}
                    required
                  />
                </div>

                {/* Date of Birth + Gender */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('newLead.fields.dateOfBirth')}
                      {formData.dateOfBirth && (
                        <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold">
                          {t('newLead.badges.bankid')}
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      disabled={!!bankIDData}
                      className={`w-full px-3 py-2.5 rounded-lg border text-sm ${bankIDData ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('newLead.fields.gender')}
                      {formData.gender && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded font-semibold">
                          {t('newLead.badges.registration')}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      disabled={!!bankIDData?.roaring && !!formData.gender}
                      className={`w-full px-3 py-2.5 rounded-lg border text-sm ${bankIDData?.roaring && formData.gender ? 'bg-green-50 border-green-200 text-slate-600' : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'}`}
                    >
                      <option value="">—</option>
                      <option value="M">{t('newLead.genderOptions.male')}</option>
                      <option value="F">{t('newLead.genderOptions.female')}</option>
                    </select>
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('newLead.fields.email')} *
                    <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-semibold">
                      {t('newLead.badges.manual')}
                    </span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder={t('newLead.placeholders.email')}
                    required
                  />
                </div>

                {/* Phone Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('newLead.fields.phone')} *
                    <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-semibold">
                      {t('newLead.badges.manual')}
                    </span>
                  </label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={v => setFormData({ ...formData, phone: v })}
                    placeholder={t('newLead.placeholders.phone')}
                    className="rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all"
                    required
                  />
                </div>

                {/* Source Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('newLead.fields.source')}
                    <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold">
                      {t('newLead.badges.bankid')}
                    </span>
                    <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded font-semibold">
                      {t('newLead.badges.registration')}
                    </span>
                    <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-semibold">
                      {t('newLead.badges.manual')}
                    </span>
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option>{t('newLead.sourceOptions.walkin')}</option>
                    <option>{t('newLead.sourceOptions.phone')}</option>
                    <option>{t('newLead.sourceOptions.website')}</option>
                    <option>{t('newLead.sourceOptions.referral')}</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">• {t('newLead.autoFilled')}</p>
                </div>

                {/* Notes Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('newLead.fields.notes')}</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
                    placeholder={t('newLead.placeholders.notes')}
                    rows={3}
                  />
                </div>

                {/* Interest Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('newLead.fields.interest')}</label>
                  <input
                    type="text"
                    value={formData.interest}
                    onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder={t('newLead.placeholders.interest')}
                  />
                </div>

                {/* GDPR Consent */}
                <label className="flex items-start gap-2 cursor-pointer mt-3">
                  <input
                    type="checkbox"
                    checked={gdprConsent}
                    onChange={e => setGdprConsent(e.target.checked)}
                    className="mt-0.5 accent-[#FF6B2C] shrink-0"
                  />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    {t('newLead.gdprConsent')}{' '}
                    <Link href="/privacy" className="text-[#FF6B2C] underline hover:no-underline" target="_blank">
                      {t('newLead.privacyPolicyLink')}
                    </Link>
                  </span>
                </label>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!gdprConsent}
                  className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('newLead.submitButton')}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Sidebar - Matching Vehicles */}
        <div className="lg:w-80 xl:w-96 p-4 md:p-6 lg:p-8 bg-white border-t lg:border-t-0 lg:border-l border-slate-200">
          {/* BankID + Roaring Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
            <h3 className="text-xs md:text-sm font-bold text-green-900 mb-2">
              🔒 {t('newLead.sidebar.title')}
            </h3>
            <ul className="text-xs text-green-800 space-y-1">
              <li>🔵 {t('newLead.sidebar.bankidInfo')}</li>
              <li>🟢 {t('newLead.sidebar.roaringInfo')}</li>
              <li>🟠 {t('newLead.sidebar.manualInfo')}</li>
              <li>📊 {t('newLead.sidebar.existingCustomer')}</li>
              <li>🛡️ {t('newLead.sidebar.protectedIdentity')}</li>
              <li>🎯 {t('newLead.sidebar.highIntent')}</li>
            </ul>
          </div>

          {/* Matching Vehicles */}
          <div>
            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-3 md:mb-4">🏍 {t('newLead.sidebar.matchingVehicles')}</h3>
            <div className="space-y-3">
              {matchingVehicles.map((vehicle) => (
                <div
                  key={vehicle.name}
                  className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">{vehicle.name}</h4>
                      <p className="text-xs text-slate-600">{vehicle.price}</p>
                    </div>
                    <div className={`text-lg font-bold ${vehicle.match >= 90 ? 'text-green-600' :
                        vehicle.match >= 80 ? 'text-blue-600' :
                          'text-slate-600'
                      }`}>
                      {vehicle.match}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 m-4">
              {t('newLead.sidebar.basedOn')}
            </p>
            <a href="/bankid-test" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              🔒 {t('newLead.sidebar.testEnv')}
            </a>
          </div>
        </div>
      </div>

      {/* BankID Modal */}
      {showBankID && (
        <BankIDModal
          mode="auth"
          onComplete={handleBankIDComplete}
          onCancel={() => setShowBankID(false)}
          autoStart
        />
      )}
    </div>
  );
}

export default NewLeadPage;
