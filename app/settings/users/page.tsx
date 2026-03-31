'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { storeInvite } from '@/lib/invites';
import { isValidEmail } from '@/lib/validation';
import { useAutoRefresh } from '@/lib/realtime';
import { getSupabaseBrowser } from '@/lib/supabase';

//──Types ────────────────────────────────────────────────────────────────────

type Role   = 'admin' | 'sales' | 'service';
type Status = 'active' | 'inactive' | 'pending';

interface StaffUser {
  id:             string;
  name:           string;
  email:          string;
  role:           Role;
  status:         Status;
  lastLogin:      string;
  bankidVerified: boolean;
  personalNumber: string;
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

// ─── Supabase staff loader ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRemoteUsers(dealershipId: string): Promise<StaffUser[]> {
  const { data } = await getSupabaseBrowser()
    .from('staff_users')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: true });
  if (!data || data.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    id:             String(r.id),
    name:           r.name ?? '',
    email:          r.email ?? '',
    role:           (r.role as Role) ?? 'sales',
    status:         (r.status as Status) ?? 'active',
    lastLogin:      r.last_login ? new Date(r.last_login).toLocaleDateString('sv-SE') : '—',
    bankidVerified: r.bankid_verified ?? false,
    personalNumber: r.personal_number ?? '',
  }));
}

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
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviteName,    setInviteName]    = useState('');
  const [inviteEmail,   setInviteEmail]   = useState('');
  const [inviteEmailErr, setInviteEmailErr] = useState('');
  const [inviteRole,    setInviteRole]    = useState<Role>('sales');
  const [inviteLink,    setInviteLink]    = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [emailDomain,   setEmailDomain]   = useState('');

  // Selected user for permission preview
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/auth/login'); return; }
    const u = JSON.parse(raw);
    if (u.role !== 'admin') {
      toast.error('Only administrators can manage users and permissions.');
      router.replace('/settings');
      return;
    }
    setCurrentUser(u);
    setAvatarUrl(u.avatarDataUrl || null);

    const dealershipId = u.dealershipId ?? '';
    (async () => {
      // Load dealership email domain — Supabase first, localStorage cache as fallback
      try {
        const { data: dsRow } = await getSupabaseBrowser()
          .from('dealership_settings')
          .select('email_domain')
          .eq('dealership_id', dealershipId)
          .maybeSingle() as { data: { email_domain: string } | null };
        if (dsRow?.email_domain) {
          setEmailDomain(dsRow.email_domain);
        } else {
          const profile = JSON.parse(localStorage.getItem('dealership_profile') ?? '{}');
          if (profile.emailDomain) setEmailDomain(profile.emailDomain);
        }
      } catch {
        try {
          const profile = JSON.parse(localStorage.getItem('dealership_profile') ?? '{}');
          if (profile.emailDomain) setEmailDomain(profile.emailDomain);
        } catch { /* ignore */ }
      }

      if (dealershipId) {
        const remote = await fetchRemoteUsers(dealershipId);
        if (remote.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
          setUsers(remote);
          setReady(true);
          return;
        }
      }
      // Fallback: bootstrap with current admin only
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUsers(JSON.parse(stored));
      } else {
        const adminUser: StaffUser = {
          id:             '1',
          name:           u.name || u.givenName || 'Admin',
          email:          u.email || '',
          role:           'admin',
          status:         'active',
          lastLogin:      new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }),
          bankidVerified: !!u.personalNumber,
          personalNumber: u.personalNumber || '',
        };
        const initial = [adminUser];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        setUsers(initial);
      }
      setReady(true);
    })();
  }, [router]);

  useAutoRefresh(async () => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw);
    const dealershipId = u.dealershipId ?? '';
    if (!dealershipId) return;
    const remote = await fetchRemoteUsers(dealershipId);
    if (remote.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      setUsers(remote);
    }
  });

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbClient = () => getSupabaseBrowser() as any;

  async function toggleStatus(id: string) {
    const target = users.find(u => u.id === id);
    if (!target) return;
    const newStatus: Status = target.status === 'active' ? 'inactive' : 'active';
    // Optimistic UI update
    persist(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    toast.success(`${target.name} ${newStatus === 'active' ? 'aktiverad' : 'inaktiverad'}`);
    // Sync to Supabase (match by email — the reliable unique key across the table)
    try {
      await dbClient().from('staff_users').update({ status: newStatus }).eq('email', target.email);
    } catch { /* pending user may not exist in DB yet — non-blocking */ }
  }

  async function changeRole(id: string, role: Role) {
    const target = users.find(u => u.id === id);
    if (!target) return;
    persist(users.map(u => u.id === id ? { ...u, role } : u));
    toast.success('Roll uppdaterad');
    try {
      await dbClient().from('staff_users').update({ role }).eq('email', target.email);
    } catch { /* pending user may not exist in DB yet */ }
  }

  async function removeUser(id: string) {
    const target = users.find(u => u.id === id);
    if (!target) return;
    persist(users.filter(u => u.id !== id));
    toast.success(`${target.name} borttagen`);
    try {
      await dbClient().from('staff_users').delete().eq('email', target.email);
    } catch { /* non-blocking */ }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    if (!isValidEmail(inviteEmail.trim())) {
      setInviteEmailErr('Enter a valid email address (e.g. name@domain.com)');
      return;
    }
    setInviteEmailErr('');
    setInviteSending(true);
    const dealershipName = currentUser?.dealershipName ?? 'BikeMeNow';
    const dealershipId   = currentUser?.dealershipId   ?? '';
    const invite = storeInvite({
      email: inviteEmail.trim(),
      name:  inviteName.trim(),
      role:  inviteRole,
      dealershipName,
      dealershipId,
    });
    const url = `${window.location.origin}/auth/accept-invite?token=${invite.token}`;
    setInviteLink(url);
    const newUser: StaffUser = {
      id:             invite.token,
      name:           inviteName.trim(),
      email:          inviteEmail.trim(),
      role:           inviteRole,
      status:         'pending',
      lastLogin:      '—',
      bankidVerified: false,
      personalNumber: '',
    };
    persist([...users, newUser]);
    try {
      const res  = await fetch('/api/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitees: [{ email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole, inviteUrl: url }],
          dealershipName,
          inviterName: currentUser?.name || currentUser?.givenName || 'Admin',
        }),
      });
      const data = await res.json();
      if (data.sent > 0) {
        toast.success(`Inbjudan skickad till ${inviteEmail.trim()}`);
      } else {
        toast.error('E-post misslyckades — kopiera länken manuellt');
      }
    } catch {
      toast.error('Kunde inte skicka e-post — kopiera länken manuellt');
    }
    setInviteSending(false);
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
                        {user.status === 'pending' && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Väntande</span>
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
                <button onClick={() => { setShowInvite(false); setInviteLink(''); setInviteName(''); setInviteEmail(''); setInviteRole('sales'); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
              </div>

              {/* Copy-link area — shown after invite is sent */}
              {inviteLink && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Inbjudningslänk (giltig 7 dagar):</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={inviteLink}
                      className="flex-1 text-[11px] font-mono bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 truncate focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Länk kopierad!'); }}
                      className="px-3 py-1.5 rounded-lg bg-[#FF6B2C] text-white text-xs font-bold shrink-0 hover:bg-[#e05a20] transition-colors"
                    >
                      Kopiera
                    </button>
                  </div>
                </div>
              )}

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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    E-postadress
                    {emailDomain && (
                      <span className="ml-2 text-[10px] font-bold bg-[#FF6B2C]/10 text-[#FF6B2C] px-2 py-0.5 rounded-full">
                        @{emailDomain}
                      </span>
                    )}
                  </label>
                  {emailDomain ? (
                    /* Split input: [username] @ [domain] */
                    <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-1 ${inviteEmailErr ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400/20' : 'border-slate-300 focus-within:border-[#FF6B2C] focus-within:ring-[#FF6B2C]/20'}`}>
                      <input
                        type="text"
                        value={inviteEmail.replace(`@${emailDomain}`, '')}
                        onChange={e => {
                          const local = e.target.value.replace(/@.*/, '');
                          setInviteEmail(local ? `${local}@${emailDomain}` : '');
                          setInviteEmailErr('');
                        }}
                        required
                        placeholder="anna"
                        className="flex-1 px-3 py-2.5 text-sm bg-white outline-none"
                      />
                      <span className="px-3 py-2.5 text-sm text-slate-400 bg-slate-50 border-l border-slate-200 select-none font-mono">
                        @{emailDomain}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => { setInviteEmail(e.target.value); setInviteEmailErr(''); }}
                      onBlur={() => { if (inviteEmail && !isValidEmail(inviteEmail)) setInviteEmailErr('Enter a valid email address (e.g. name@domain.com)'); }}
                      required
                      placeholder="anna@dealership.se"
                      className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 ${inviteEmailErr ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20 bg-red-50' : 'border-slate-300 focus:border-[#FF6B2C] focus:ring-[#FF6B2C]/20'}`}
                    />
                  )}
                  {inviteEmailErr && <p className="mt-1 text-xs text-red-500">{inviteEmailErr}</p>}
                  {emailDomain && (
                    <p className="text-xs text-slate-400 mt-1">
                      Alla användare hos {currentUser?.dealershipName ?? 'er dealership'} använder <span className="font-mono">@{emailDomain}</span>
                    </p>
                  )}
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
                    disabled={inviteSending}
                    className="flex-1 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e05a20] disabled:opacity-60 text-white text-sm font-bold transition-colors"
                  >
                    {inviteSending ? 'Skickar...' : 'Skicka inbjudan'}
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
