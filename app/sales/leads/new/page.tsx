'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult } from '@/types';

type TabType = 'bankid' | 'manual' | 'phone';

export default function NewLeadPage() {
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
      <div className="ml-[230px] flex-1 flex">
        {/* Center Content */}
        <div className="flex-1 p-8 max-w-[900px]">
          {/* Breadcrumb */}
          <div className="text-sm text-slate-500 mb-4">
            Sales → <span className="text-slate-700">New Lead</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Create New Lead</h1>

          {/* Identification Method Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Identifiera kund</h2>
            <p className="text-sm text-slate-500 mb-4">Välj hur du vill identifiera kunden</p>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => {
                  setActiveTab('bankid');
                  setShowBankID(true);
                }}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'bankid'
                    ? 'bg-[#235971] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🔒 BankID (rekommenderat)
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'manual'
                    ? 'bg-[#235971] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                ✏️ Manuellt
              </button>
              <button
                onClick={() => setActiveTab('phone')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'phone'
                    ? 'bg-[#235971] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                📞 Telefonuppslag
              </button>
            </div>

            {/* Success Banner */}
            {bankIDData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 text-xl">✅</span>
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      Identifierad via BankID — {bankIDData.user.name} ({bankIDData.user.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')})
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
                    Namn
                    {bankIDData && (
                      <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold">
                        BankID
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!!bankIDData}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${
                      bankIDData
                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                        : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'
                    }`}
                    required
                  />
                </div>

                {/* Address Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Adress
                    {bankIDData?.roaring && (
                      <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded font-semibold">
                        Folkbokföring
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    disabled={!!bankIDData?.roaring}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${
                      bankIDData?.roaring
                        ? 'bg-green-50 border-green-200 text-slate-600'
                        : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'
                    }`}
                    required
                  />
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    E-post *
                    <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-semibold">
                      Manuell
                    </span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="lars@example.se"
                    required
                  />
                </div>

                {/* Phone Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Telefon *
                    <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-semibold">
                      Manuell
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="076-123 4567"
                    required
                  />
                </div>

                {/* Source Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Källa
                    <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold">
                      BankID
                    </span>
                    <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded font-semibold">
                      Folkbokföring
                    </span>
                    <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-semibold">
                      Manuell
                    </span>
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option>Walk-in</option>
                    <option>Phone</option>
                    <option>Website</option>
                    <option>Referral</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">• 80% auto-ifyllt</p>
                </div>

                {/* Notes Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Anteckningar</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
                    placeholder="Intresserad av sportcyklar, budget ~90-150k"
                    rows={3}
                  />
                </div>

                {/* Interest Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Intresse</label>
                  <input
                    type="text"
                    value={formData.interest}
                    onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Kawasaki Ninja ZX-6R"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors"
                >
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Sidebar - Matching Vehicles */}
        <div className="w-[360px] p-8 bg-white border-l border-slate-200">
          {/* BankID + Roaring Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-bold text-green-900 mb-2">
              🔒 BankID + Roaring.io Enrichment
            </h3>
            <ul className="text-xs text-green-800 space-y-1">
              <li>🔵 BankID → Namn + personnummer (verifierat)</li>
              <li>🟢 Roaring.io → Adress, postnr, ort, kön (SPAR)</li>
              <li>🟠 Manuell → E-post, telefon (fråga kunden)</li>
              <li>📊 Befintlig kund: Nej (ny i systemet)</li>
              <li>🛡️ Skyddad identitet: Nej</li>
              <li>🎯 Walk-in + BankID = 92% hög avsikt</li>
            </ul>
          </div>

          {/* Matching Vehicles */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">🏍 Matchande fordon</h3>
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
                    <div className={`text-lg font-bold ${
                      vehicle.match >= 90 ? 'text-green-600' :
                      vehicle.match >= 80 ? 'text-blue-600' :
                      'text-slate-600'
                    }`}>
                      {vehicle.match}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-4">
              Baserat på budget 90-150k och sportintresse
            </p>
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
