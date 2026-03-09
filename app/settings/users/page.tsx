'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role   = 'admin' | 'sales' | 'service';
type Status = 'active' | 'inactive';

interface StaffUser {
  id:             string;
  name:           string;
  email:          string;
  role:           Role;
  status:         Status;
  lastLogin:      string;
  bankidVerified: boolean;
}

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLES: Record<Role, { label: string; color: string; permissions: string[] }> = {
  admin: {
    label: 'Admin',
    color: 'bg-purple-100 text-purple-700',
    permissions: ['Dashboard', 'Leads & Offers', 'Customers', 'Invoices', 'Inventory', 'Documents', 'Settings', 'Audit Log'],
  },
  sales: {
    label: 'Försäljning',
    color: 'bg-[#FF6B2C]/10 text-[#FF6B2C]',
    permissions: ['Dashboard', 'Leads & Offers', 'Customers', 'Invoices', 'Inventory'],
  },
  service: {
    label: 'Service',
    color: 'bg-blue-100 text-blue-700',
    permissions: ['Dashboard', 'Inventory', 'Documents'],
  },
};

const STORAGE_KEY = 'staff_users';

const DEFAULT_USERS: StaffUser[] = [
  { id: '1', name: 'Erik Lindström',  email: 'erik@avamc.se',   role: 'admin',   status: 'active',   lastLogin: '6 mar 2026',  bankidVerified: true },
  { id: '2', name: 'Anna Svensson',   email: 'anna@avamc.se',   role: 'sales',   status: 'active',   lastLogin: '5 mar 2026',  bankidVerified: true },
  { id: '3', name: 'Marcus Berg',     email: 'marcus@avamc.se', role: 'sales',   status: 'active',   lastLogin: '4 mar 2026',  bankidVerified: false },
  { id: '4', name: 'Sofia Dahl',      email: 'sofia@avamc.se',  role: 'service', status: 'active',   lastLogin: '3 mar 2026',  bankidVerified: true },
  { id: '5', name: 'Lars Ekman',      email: 'lars@avamc.se',   role: 'service', status: 'inactive', lastLogin: '15 jan 2026', bankidVerified: false },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const { label, color } = ROLES[role];
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersSettingsPage() {
  const router       = useRouter();
  const avatarRef    = useRef<HTMLInputElement>(null);
  const [ready, setReady]       = useState(false);
  const [users, setUsers]       = useState<StaffUser[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);

  // Invite form state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName,  setInviteName]  = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState<Role>('sales');

  // Selected user for permission preview
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/auth/login'); return; }
    const u = JSON.parse(raw);
    setCurrentUser(u);
    setAvatarUrl(u.avatarDataUrl || null);

    const stored = localStorage.getItem(STORAGE_KEY);
    setUsers(stored ? JSON.parse(stored) : DEFAULT_USERS);
    setReady(true);
  }, [router]);

  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const SIZE = 200;
      const r = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.naturalWidth * r);
      canvas.height = Math.round(img.naturalHeight * r);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        u.avatarDataUrl = dataUrl;
        localStorage.setItem('user', JSON.stringify(u));
        setAvatarUrl(dataUrl);
        toast.success('Profilbild uppdaterad');
      }
    };
    img.src = objectUrl;
  };

  const handleRemoveAvatar = () => {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      delete u.avatarDataUrl;
      localStorage.setItem('user', JSON.stringify(u));
      setAvatarUrl(null);
      toast.success('Profilbild borttagen');
    }
  };

  function persist(next: StaffUser[]) {
    setUsers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleStatus(id: string) {
    const next = users.map(u =>
      u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' as Status } : u
    );
    persist(next);
    const user = next.find(u => u.id === id)!;
    toast.success(`${user.name} ${user.status === 'active' ? 'aktiverad' : 'inaktiverad'}`);
  }

  function changeRole(id: string, role: Role) {
    const next = users.map(u => u.id === id ? { ...u, role } : u);
    persist(next);
    toast.success('Roll uppdaterad');
  }

  function removeUser(id: string) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const next = users.filter(u => u.id !== id);
    persist(next);
    toast.success(`${user.name} borttagen`);
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const newUser: StaffUser = {
      id:             Date.now().toString(),
      name:           inviteName.trim(),
      email:          inviteEmail.trim(),
      role:           inviteRole,
      status:         'active',
      lastLogin:      '—',
      bankidVerified: false,
    };
    persist([...users, newUser]);
    toast.success(`Inbjudan skickad till ${newUser.email}`);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('sales');
    setShowInvite(false);
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeCount   = users.filter(u => u.status === 'active').length;
  const adminCount    = users.filter(u => u.role === 'admin' && u.status === 'active').length;
  const selected      = selectedUser ? users.find(u => u.id === selectedUser) : null;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1">
        <div className="brand-top-bar" />

        <div className="p-6 max-w-5xl animate-fade-up">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">Inställningar</Link>
                {' / '}Användare
              </p>
              <h1 className="text-2xl font-black text-[#0b1524]">Användare &amp; Behörigheter</h1>
              <p className="text-sm text-slate-500 mt-1">
                Hantera personalkonton, roller och åtkomstnivåer.
              </p>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e05a20] text-white text-sm font-bold transition-colors shrink-0"
            >
              + Bjud in användare
            </button>
          </div>

          {/* ── My Profile ── */}
          {currentUser && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 flex items-center gap-5 flex-wrap">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#FF6B2C] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser.givenName?.[0] || currentUser.name?.[0] || 'U'}</span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {currentUser.givenName || currentUser.name || 'Användare'}
                </p>
                {currentUser.personalNumber && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {currentUser.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-[#235971] text-white px-2 py-0.5 rounded">
                  🔒 BankID-verifierad
                </span>
              </div>

              {/* Avatar controls */}
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarFile(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-[#FF6B2C]/40 hover:bg-orange-50 text-sm font-semibold text-slate-700 transition-all"
                >
                  📷 {avatarUrl ? 'Byt bild' : 'Lägg till bild'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-600 transition-all"
                  >
                    🗑 Ta bort
                  </button>
                )}
              </div>

              <div className="w-full border-t border-slate-50 pt-3 mt-1">
                <p className="text-[11px] text-slate-400">
                  Din profilbild visas i navigeringsfältet. Bilden sparas lokalt i din webbläsare.
                </p>
              </div>
            </div>
          )}

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Aktiva användare', value: activeCount, icon: '👥' },
              { label: 'Administratörer',  value: adminCount,  icon: '🔑' },
              { label: 'BankID-verifierade', value: users.filter(u => u.bankidVerified).length, icon: '🔒' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className="text-xl font-black text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-5">

            {/* Users table */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Personalkonton</h2>
                <span className="text-xs text-slate-400">{users.length} användare</span>
              </div>

              <div className="divide-y divide-slate-50">
                {users.map(user => (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                    className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
                      selectedUser === user.id ? 'bg-[#FF6B2C]/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
                      user.status === 'inactive' ? 'bg-slate-100 text-slate-400' : 'bg-[#0b1524] text-white'
                    }`}>
                      {user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${user.status === 'inactive' ? 'text-slate-400' : 'text-slate-900'}`}>
                          {user.name}
                        </p>
                        {user.bankidVerified && (
                          <span className="text-[10px] bg-[#235971] text-white px-1.5 py-0.5 rounded font-bold">🔒 BankID</span>
                        )}
                        {user.status === 'inactive' && (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">Inaktiv</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>

                    {/* Role selector */}
                    <select
                      value={user.role}
                      onChange={e => { e.stopPropagation(); changeRole(user.id, e.target.value as Role); }}
                      onClick={e => e.stopPropagation()}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 shrink-0"
                    >
                      <option value="admin">Admin</option>
                      <option value="sales">Försäljning</option>
                      <option value="service">Service</option>
                    </select>

                    {/* Status toggle */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleStatus(user.id); }}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                        user.status === 'active' ? 'bg-[#FF6B2C]' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                        user.status === 'active' ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>

                    {/* Remove */}
                    <button
                      onClick={e => { e.stopPropagation(); removeUser(user.id); }}
                      className="text-slate-300 hover:text-red-500 transition-colors shrink-0 text-lg leading-none"
                      title="Ta bort"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="py-12 text-center text-sm text-slate-400">
                    Inga användare ännu — bjud in din personal.
                  </div>
                )}
              </div>
            </div>

            {/* Right panel — role permissions or legend */}
            <div className="lg:w-72 flex flex-col gap-4">

              {/* Selected user permissions */}
              {selected ? (
                <div className="bg-white rounded-2xl border border-[#FF6B2C]/20 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#0b1524] text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {selected.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{selected.name}</p>
                      <p className="text-xs text-slate-400 truncate">{selected.email}</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <RoleBadge role={selected.role} />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Behörigheter</p>
                  <div className="space-y-1.5">
                    {ROLES[selected.role].permissions.map(p => (
                      <div key={p} className="flex items-center gap-2">
                        <span className="text-green-500 text-xs">✓</span>
                        <span className="text-xs text-slate-600">{p}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3">Senaste inloggning: {selected.lastLogin}</p>
                </div>
              ) : (
                /* Role legend */
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Roller &amp; behörigheter</h3>
                  <div className="space-y-4">
                    {(Object.entries(ROLES) as [Role, typeof ROLES[Role]][]).map(([key, meta]) => (
                      <div key={key}>
                        <div className="mb-1.5">
                          <RoleBadge role={key} />
                        </div>
                        <div className="space-y-0.5">
                          {meta.permissions.map(p => (
                            <div key={p} className="flex items-center gap-1.5">
                              <span className="text-green-500 text-[10px]">✓</span>
                              <span className="text-[11px] text-slate-500">{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Security note */}
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-xs text-blue-700 space-y-1">
                <p className="font-bold">🔒 BankID-krav</p>
                <p>Administratörsåtgärder (t.ex. inställningar, rollredigering) kräver BankID-verifiering.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowInvite(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 animate-fade-up">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900">Bjud in ny användare</h2>
                <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fullständigt namn</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    required
                    placeholder="Anna Svensson"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">E-postadress</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    placeholder="anna@dealership.se"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Roll</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(ROLES) as [Role, typeof ROLES[Role]][]).map(([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setInviteRole(key)}
                        className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                          inviteRole === key
                            ? 'border-[#FF6B2C] bg-[#FF6B2C]/5 text-[#FF6B2C]'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Behörigheter: {ROLES[inviteRole].permissions.join(', ')}
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e05a20] text-white text-sm font-bold transition-colors"
                  >
                    Skicka inbjudan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
