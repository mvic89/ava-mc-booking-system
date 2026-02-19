'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult, Demo } from '@/types';
import DemoCard from '@/components/DemoCard';
import Field from '@/components/Field';

type TabType = 'bankid' | 'manual' | 'phone';

const NewLeadPage = () => {
  const t = useTranslations();

  const [activeTab, setActiveTab] = useState<TabType>('bankid');
  const [showBankID, setShowBankID] = useState(false);
  const [bankIDData, setBankIDData] = useState<BankIDResult | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
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
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating lead:', formData);
    alert('Lead created successfully!');
  };

  const matchingVehicles = [
    { name: 'Ninja ZX-6R', price: '150k kr', match: 92 },
    { name: 'MT-07', price: '89.9k kr', match: 87 },
    { name: 'CB650R', price: '105k kr', match: 81 },
    { name: 'GSX-S750', price: '112k kr', match: 74 },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-57.5 flex-1 flex">
        {/* Center Content */}
        <div className="flex-1 p-8 max-w-225">
          {/* Breadcrumb */}
          <div className="text-sm text-slate-500 mb-4">
            {t('newLead.breadcrumb.sales')} → <span className="text-slate-700">{t('newLead.breadcrumb.newLead')}</span>
          </div>

          {/* Title */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-slate-900">{t('newLead.title')}</h1>
          </div>

          {/* Identification Method Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('newLead.identifyCustomer')}</h2>
            <p className="text-sm text-slate-500 mb-4">{t('newLead.identifyCustomerDesc')}</p>

            <div className="flex gap-3 mb-6">
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
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder={t('newLead.placeholders.phone')}
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

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors"
                >
                  {t('newLead.submitButton')}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Sidebar - Matching Vehicles */}
        <div className="w-90 p-8 bg-white border-l border-slate-200">
          {/* BankID + Roaring Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-bold text-green-900 mb-2">
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
            <h3 className="text-lg font-bold text-slate-900 mb-4">🏍 {t('newLead.sidebar.matchingVehicles')}</h3>
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
