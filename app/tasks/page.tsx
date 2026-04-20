'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus   = 'open' | 'done' | 'snoozed';
type TaskPriority = 'low' | 'medium' | 'high';
type TaskType     = 'call' | 'email' | 'meeting' | 'follow_up' | 'other';

interface Task {
  id:           number;
  lead_id:      number | null;
  customer_id:  number | null;
  title:        string;
  description:  string | null;
  type:         TaskType;
  priority:     TaskPriority;
  status:       TaskStatus;
  due_date:     string | null;
  assigned_to:  string | null;
  created_by:   string | null;
  completed_at: string | null;
  created_at:   string;
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<TaskType, { icon: string; label: string; color: string }> = {
  call:       { icon: '📞', label: 'Ring',         color: '#10b981' },
  email:      { icon: '✉️',  label: 'E-post',       color: '#3b82f6' },
  meeting:    { icon: '🤝', label: 'Möte',          color: '#8b5cf6' },
  follow_up:  { icon: '🔔', label: 'Uppföljning',   color: '#FF6B2C' },
  other:      { icon: '📋', label: 'Övrigt',        color: '#64748b' },
};

const PRIORITY_CFG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  high:   { label: 'Hög',   color: '#ef4444', bg: 'bg-red-50 border-red-200 text-red-700'       },
  medium: { label: 'Medel', color: '#f59e0b', bg: 'bg-amber-50 border-amber-200 text-amber-700' },
  low:    { label: 'Låg',   color: '#64748b', bg: 'bg-slate-50 border-slate-200 text-slate-600' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isOverdue(task: Task): boolean {
  if (task.status !== 'open' || !task.due_date) return false;
  return new Date(task.due_date) < new Date();
}

function isDueToday(task: Task): boolean {
  if (!task.due_date) return false;
  const d = new Date(task.due_date);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  if (diff === 0) return 'Idag';
  if (diff === 1) return 'Imorgon';
  if (diff === -1) return 'Igår';
  if (diff < 0)  return `${Math.abs(diff)}d sedan`;
  return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();

  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<'all' | 'open' | 'done'>('open');
  const [typeFilter,  setTypeFilter]  = useState<TaskType | 'all'>('all');
  const [showModal,   setShowModal]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [user,        setUser]        = useState<{ name?: string; dealershipId?: string } | null>(null);

  // New task form state
  const [newTitle,    setNewTitle]    = useState('');
  const [newType,     setNewType]     = useState<TaskType>('follow_up');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newDue,      setNewDue]      = useState('');
  const [newAssigned, setNewAssigned] = useState('');
  const [newDesc,     setNewDesc]     = useState('');

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  const load = useCallback(async (did: string) => {
    setLoading(true);
    const url = new URL('/api/tasks', window.location.origin);
    url.searchParams.set('dealershipId', did);
    if (filter !== 'all') url.searchParams.set('status', filter);
    const res = await fetch(url.toString());
    if (res.ok) {
      const json = await res.json() as { tasks: Task[] };
      setTasks(json.tasks);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { name?: string; dealershipId?: string };
    setUser(u);
    const did = u.dealershipId ?? getDealershipId() ?? '';
    if (did) load(did);
  }, [router, load]);

  async function markDone(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: 'done' }),
    });
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done', completed_at: new Date().toISOString() } : t));
      toast.success('Uppgift markerad som klar');
    }
  }

  async function reopenTask(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: 'open' }),
    });
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'open', completed_at: null } : t));
    }
  }

  async function deleteTask(id: number) {
    const res = await fetch(`/api/tasks/${id}?dealershipId=${encodeURIComponent(dealershipId)}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Uppgift borttagen');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    const res = await fetch('/api/tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        title:       newTitle.trim(),
        type:        newType,
        priority:    newPriority,
        dueDate:     newDue || null,
        assignedTo:  newAssigned.trim() || user?.name || null,
        description: newDesc.trim() || null,
        createdBy:   user?.name ?? null,
      }),
    });
    if (res.ok) {
      const json = await res.json() as { task: Task };
      setTasks(prev => [json.task, ...prev]);
      toast.success('Uppgift skapad');
      setShowModal(false);
      setNewTitle(''); setNewType('follow_up'); setNewPriority('medium');
      setNewDue(''); setNewAssigned(''); setNewDesc('');
    } else {
      toast.error('Kunde inte skapa uppgift');
    }
    setSaving(false);
  }

  const displayed = tasks.filter(t =>
    (filter === 'all' || t.status === filter) &&
    (typeFilter === 'all' || t.type === typeFilter),
  );

  const overdueCount = tasks.filter(t => t.status === 'open' && isOverdue(t)).length;
  const todayCount   = tasks.filter(t => t.status === 'open' && isDueToday(t) && !isOverdue(t)).length;
  const openCount    = tasks.filter(t => t.status === 'open').length;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Uppgifter & Påminnelser</h1>
              <p className="text-sm text-slate-500 mt-0.5">Håll koll på vad som behöver göras</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <span className="text-lg leading-none">+</span> Ny uppgift
            </button>
          </div>

          {/* KPI strip */}
          <div className="flex gap-4 mt-4 flex-wrap">
            {overdueCount > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold text-red-700">{overdueCount} försenade</span>
              </div>
            )}
            {todayCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-amber-700">{todayCount} idag</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-600">{openCount} öppna totalt</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100 flex gap-3 flex-wrap">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(['open', 'done', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === s ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s === 'open' ? 'Öppna' : s === 'done' ? 'Klara' : 'Alla'}
              </button>
            ))}
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1 flex-wrap">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                typeFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Alla typer
            </button>
            {(Object.keys(TYPE_CFG) as TaskType[]).map(tp => (
              <button
                key={tp}
                onClick={() => setTypeFilter(tp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === tp ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {TYPE_CFG[tp].icon} {TYPE_CFG[tp].label}
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 px-6 md:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">✅</p>
              <p className="font-bold text-slate-700 text-lg">Inga uppgifter att visa</p>
              <p className="text-sm text-slate-400 mt-1">
                {filter === 'open' ? 'Inga öppna uppgifter — allt klart!' : 'Skapa en uppgift för att komma igång.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(task => {
                const typeCfg  = TYPE_CFG[task.type]  ?? TYPE_CFG.other;
                const priCfg   = PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.medium;
                const overdue  = isOverdue(task);
                const dueToday = isDueToday(task);
                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-2xl border p-4 flex gap-4 items-start transition-colors ${
                      overdue ? 'border-red-200 bg-red-50/30' : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    {/* Done checkbox */}
                    <button
                      onClick={() => task.status === 'done' ? reopenTask(task) : markDone(task)}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        task.status === 'done'
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 hover:border-emerald-400'
                      }`}
                    >
                      {task.status === 'done' && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base">{typeCfg.icon}</span>
                        <span className={`text-sm font-semibold ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.title}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priCfg.bg}`}>
                          {priCfg.label}
                        </span>
                        {overdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 border border-red-200 text-red-700 animate-pulse">
                            FÖRSENAD
                          </span>
                        )}
                        {dueToday && !overdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700">
                            IDAG
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {task.due_date && (
                          <span className={`text-xs font-medium ${overdue ? 'text-red-600' : dueToday ? 'text-amber-600' : 'text-slate-400'}`}>
                            📅 {fmtDate(task.due_date)}
                          </span>
                        )}
                        {task.assigned_to && (
                          <span className="text-xs text-slate-400">👤 {task.assigned_to}</span>
                        )}
                        {task.lead_id && (
                          <Link
                            href={`/sales/leads/${task.lead_id}`}
                            className="text-xs text-[#FF6B2C] hover:underline font-medium"
                          >
                            Lead #{task.lead_id} →
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none mt-0.5 shrink-0"
                      title="Ta bort"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── New task modal ────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 text-lg">Ny uppgift</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titel *</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Vad behöver göras?"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Typ</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as TaskType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none bg-white"
                  >
                    {(Object.keys(TYPE_CFG) as TaskType[]).map(tp => (
                      <option key={tp} value={tp}>{TYPE_CFG[tp].icon} {TYPE_CFG[tp].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Prioritet</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none bg-white"
                  >
                    <option value="high">🔴 Hög</option>
                    <option value="medium">🟡 Medel</option>
                    <option value="low">⚪ Låg</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Förfallodatum</label>
                  <input
                    type="datetime-local"
                    value={newDue}
                    onChange={e => setNewDue(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tilldelad</label>
                  <input
                    value={newAssigned}
                    onChange={e => setNewAssigned(e.target.value)}
                    placeholder={user?.name ?? 'Namn...'}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Beskrivning (valfri)</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Ytterligare detaljer..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={saving || !newTitle.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  ) : 'Spara uppgift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
