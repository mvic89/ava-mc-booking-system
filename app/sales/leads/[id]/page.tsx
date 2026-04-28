'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';
import { computeLeadScore } from '@/lib/leads';
import { emit } from '@/lib/realtime';
import type { ActivityType } from '@/app/api/leads/[id]/activity/route';
import DocumentAttachments from '@/components/DocumentAttachments';

// ── Task types (inline) ────────────────────────────────────────────────────────
type TaskStatus   = 'open' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type TaskType     = 'call' | 'email' | 'meeting' | 'follow_up' | 'other';
interface LeadTask {
  id: number; title: string; type: TaskType; priority: TaskPriority;
  status: TaskStatus; due_date: string | null; assigned_to: string | null;
  created_at: string;
}
// TASK_TYPE_CFG moved inside component

// ── Communication types (inline) ───────────────────────────────────────────────
interface Communication {
  id: number; channel: string; direction: string; subject: string | null; body: string;
  status: string; sent_by: string | null; recipient_name: string | null;
  recipient_email: string | null; recipient_phone: string | null;
  sender_email: string | null; created_at: string;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeadItem {
  id:       string;
  name:     string;
  brand:    string;
  price:    number;
  qty:      number;
  itemType: 'acc' | 'sp';
}

interface LeadDetail {
  id:              number;
  name:            string;
  bike:            string;
  value:           number;
  costPrice:       number;
  status:          string;
  stage:           string;
  email:           string;
  phone:           string;
  personnummer:    string;
  createdAt:       string;
  notes:           string;
  salesPersonName: string;
  source:          string;
  leadScore:       number;
  lostReason:      string | null;
  stageChangedAt:  string | null;
  closedAt:        string | null;
  leadType:        'motorcycle' | 'accessories';
  leadItems:       LeadItem[];
}

interface Activity {
  id:        number;
  leadId:    number;
  type:      ActivityType;
  content:   string;
  meta:      Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// STAGE_LABELS moved inside component

const STAGE_ORDER = ['new', 'contacted', 'testride', 'offer', 'negotiating', 'pending_payment', 'closed'];

const STAGE_COLORS: Record<string, string> = {
  new:             '#FF6B2C',
  contacted:       '#f59e0b',
  testride:        '#8b5cf6',
  offer:           '#0ea5e9',
  negotiating:     '#3b82f6',
  pending_payment: '#f97316',
  closed:          '#10b981',
};

// ACTIVITY_CFG moved inside component

// LOST_REASONS moved inside component

const OVERDUE_DAYS: Record<string, number> = {
  new: 2, contacted: 3, testride: 5, negotiating: 7, pending_payment: 14, closed: 999,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return { text: 'text-emerald-700', bg: 'bg-emerald-50', bar: '#10b981', ring: 'ring-emerald-200' };
  if (s >= 40) return { text: 'text-amber-700',   bg: 'bg-amber-50',   bar: '#f59e0b', ring: 'ring-amber-200'   };
  return              { text: 'text-red-700',      bg: 'bg-red-50',     bar: '#ef4444', ring: 'ring-red-200'     };
}

// scoreLabel moved inside component

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return 'Just nu';
  if (m < 60)   return `${m}m sedan`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h sedan`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d}d sedan`;
  return new Date(ts).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

function daysAgo(ts: string | null) {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const cfg    = scoreColor(score);
  const radius = 28;
  const circ   = 2 * Math.PI * radius;
  const dash   = (score / 100) * circ;
  return (
    <div className={`relative flex flex-col items-center justify-center w-20 h-20 rounded-full ring-2 ${cfg.ring} ${cfg.bg}`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={cfg.bar} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className={`relative text-xl font-black tabular-nums ${cfg.text}`}>{score}</span>
      <span className={`relative text-[9px] font-bold ${cfg.text} -mt-0.5`}>/ 100</span>
    </div>
  );
}

// ── Activity item ─────────────────────────────────────────────────────────────

function ActivityItem({
  act,
  activityCfg,
  stageLabels,
  byLabel,
}: {
  act: Activity;
  activityCfg: Record<ActivityType, { icon: string; color: string; label: string }>;
  stageLabels: Record<string, string>;
  byLabel: string;
}) {
  const cfg = activityCfg[act.type] ?? activityCfg.note;
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 bg-slate-100">
          {cfg.icon}
        </div>
        <div className="w-px flex-1 bg-slate-100 mt-1 group-last:hidden" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          {act.createdBy && (
            <span className="text-xs text-slate-400">{byLabel} {act.createdBy}</span>
          )}
          <span className="text-xs text-slate-300 ml-auto shrink-0">{relativeTime(act.createdAt)}</span>
        </div>
        {act.content && (
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{act.content}</p>
        )}
        {act.meta && typeof act.meta.from === 'string' && typeof act.meta.to === 'string' && (
          <p className="text-xs text-slate-400 mt-0.5">
            {stageLabels[act.meta.from] ?? act.meta.from} → {stageLabels[act.meta.to] ?? act.meta.to}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id     = (params?.id as string) || '';

  const t = useTranslations('leadDetail');

  const STAGE_LABELS: Record<string, string> = {
    new:             t('stages.new'),
    contacted:       t('stages.contacted'),
    testride:        t('stages.testride'),
    offer:           t('stages.offer'),
    negotiating:     t('stages.negotiating'),
    pending_payment: t('stages.pending_payment'),
    closed:          t('stages.closed'),
  };

  const ACTIVITY_CFG: Record<ActivityType, { icon: string; color: string; label: string }> = {
    note:         { icon: '📝', color: '#64748b', label: t('activityTypes.note')         },
    call:         { icon: '📞', color: '#10b981', label: t('activityTypes.call')         },
    email:        { icon: '✉️',  color: '#3b82f6', label: t('activityTypes.email')        },
    meeting:      { icon: '🤝', color: '#8b5cf6', label: t('activityTypes.meeting')      },
    stage_change: { icon: '→',  color: '#FF6B2C', label: t('activityTypes.stage_change') },
    score_update: { icon: '⭐', color: '#f59e0b', label: t('activityTypes.score_update') },
    reminder:     { icon: '⏰', color: '#ef4444', label: t('activityTypes.reminder')     },
    lost:         { icon: '❌', color: '#ef4444', label: t('activityTypes.lost')         },
  };

  const TASK_TYPE_CFG: Record<TaskType, { icon: string; label: string }> = {
    call:      { icon: '📞', label: t('taskTypes.call')      },
    email:     { icon: '✉️',  label: t('taskTypes.email')     },
    meeting:   { icon: '🤝', label: t('taskTypes.meeting')    },
    follow_up: { icon: '🔔', label: t('taskTypes.follow_up') },
    other:     { icon: '📋', label: t('taskTypes.other')     },
  };

  const LOST_REASONS = t.raw('lostReasons') as string[];

  function scoreLabel(s: number) {
    if (s >= 70) return t('score.hot');
    if (s >= 40) return t('score.warm');
    return t('score.cold');
  }

  const [lead,           setLead]           = useState<LeadDetail | null>(null);
  const [activities,     setActivities]     = useState<Activity[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activityType,   setActivityType]   = useState<ActivityType>('note');
  const [activityText,   setActivityText]   = useState('');
  const [addingActivity, setAddingActivity] = useState(false);
  const [showLostModal,   setShowLostModal]   = useState(false);
  const [lostReason,      setLostReason]      = useState(LOST_REASONS[0]);
  const [lostCustom,      setLostCustom]      = useState('');
  const [closingLost,     setClosingLost]     = useState(false);
  const [movingStage,     setMovingStage]     = useState(false);
  const [user,            setUser]            = useState<{ name?: string; dealershipId?: string } | null>(null);

  // Tasks panel
  const [tasks,           setTasks]           = useState<LeadTask[]>([]);
  const [taskInput,       setTaskInput]       = useState('');
  const [taskType,        setTaskType]        = useState<TaskType>('follow_up');
  const [taskPriority,    setTaskPriority]    = useState<TaskPriority>('medium');
  const [taskDue,         setTaskDue]         = useState('');
  const [addingTask,      setAddingTask]      = useState(false);

  // Communications panel
  const [comms,           setComms]           = useState<Communication[]>([]);
  const [showCommsPanel,  setShowCommsPanel]  = useState(false);
  const [commChannel,     setCommChannel]     = useState<'email' | 'sms'>('email');
  const [commSubject,     setCommSubject]     = useState('');
  const [commBody,        setCommBody]        = useState('');
  const [sendingComm,     setSendingComm]     = useState(false);

  // Cancel deal modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason,    setCancelReason]    = useState<'changed_mind'|'financial'|'found_elsewhere'|'financing_denied'|'other'>('changed_mind');
  const [cancelDetail,    setCancelDetail]    = useState('');
  const [refundAmount,    setRefundAmount]    = useState('0');
  const [refundBank,      setRefundBank]      = useState('');
  const [refundClearing,  setRefundClearing]  = useState('');
  const [refundAccount,   setRefundAccount]   = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [cancelNotes,     setCancelNotes]     = useState('');
  const [returnToStock,   setReturnToStock]   = useState(true);
  const [cancelling,      setCancelling]      = useState(false);

  const dealershipIdRef = useRef<string | null>(null);

  const loadActivities = useCallback(async (lid: string, did: string) => {
    const res = await fetch(`/api/leads/${lid}/activity?dealershipId=${encodeURIComponent(did)}`);
    if (res.ok) {
      const json = await res.json() as { activities: Activity[] };
      setActivities(json.activities);
    }
  }, []);

  const loadTasks = useCallback(async (lid: string, did: string) => {
    const res = await fetch(`/api/tasks?dealershipId=${encodeURIComponent(did)}&leadId=${lid}`);
    if (res.ok) {
      const json = await res.json() as { tasks: LeadTask[] };
      setTasks(json.tasks);
    }
  }, []);

  const loadComms = useCallback(async (lid: string, did: string) => {
    const res = await fetch(`/api/communications/list?dealershipId=${encodeURIComponent(did)}&leadId=${lid}`);
    if (res.ok) {
      const json = await res.json() as { communications: Communication[] };
      setComms(json.communications);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { name?: string; dealershipId?: string };
    setUser(u);

    const leadId      = Number(id);
    const dealershipId = u.dealershipId ?? getDealershipId() ?? '';
    dealershipIdRef.current = dealershipId;

    if (Number.isNaN(leadId) || !dealershipId) { setLoading(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getSupabaseBrowser() as any)
      .from('leads')
      .select('id,name,bike,value,cost_price,lead_status,stage,email,phone,personnummer,created_at,notes,salesperson_name,source,lead_score,lost_reason,stage_changed_at,closed_at,lead_type,lead_items')
      .eq('id', leadId)
      .eq('dealership_id', dealershipId)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data) {
          const rv = parseFloat(data.value ?? '0');
          const cp = parseFloat(data.cost_price ?? '0');
          const ld: LeadDetail = {
            id:              data.id,
            name:            data.name            ?? '',
            bike:            data.bike            ?? '',
            value:           rv,
            costPrice:       cp,
            status:          data.lead_status     ?? 'warm',
            stage:           data.stage           ?? 'new',
            email:           data.email           ?? '',
            phone:           data.phone           ?? '',
            personnummer:    data.personnummer     ?? '',
            createdAt:       data.created_at       ?? '',
            notes:           data.notes            ?? '',
            salesPersonName: data.salesperson_name ?? '',
            source:          data.source           ?? 'Walk-in',
            leadScore:       data.lead_score       ?? computeLeadScore({
              verified:  !!data.personnummer,
              notes:     data.notes ?? '',
              stage:     data.stage ?? 'new',
              costPrice: cp,
              rawValue:  rv,
              source:    data.source ?? '',
              email:     data.email ?? '',
              phone:     data.phone ?? '',
            }),
            lostReason:      data.lost_reason      ?? null,
            stageChangedAt:  data.stage_changed_at ?? null,
            closedAt:        data.closed_at        ?? null,
            leadType:        data.lead_type        ?? 'motorcycle',
            leadItems:       (() => {
              try {
                const v = data.lead_items;
                if (!v) return [];
                return Array.isArray(v) ? v : JSON.parse(v);
              } catch { return []; }
            })(),
          };
          setLead(ld);
        }
        setLoading(false);
      });

    loadActivities(id, dealershipId);
    loadTasks(id, dealershipId);
    loadComms(id, dealershipId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router, loadActivities, loadTasks, loadComms]);

  // ── Task handlers ───────────────────────────────────────────────────────────

  async function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!taskInput.trim() || !lead) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    setAddingTask(true);
    const res = await fetch('/api/tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId: did,
        leadId:       lead.id,
        title:        taskInput.trim(),
        type:         taskType,
        priority:     taskPriority,
        dueDate:      taskDue || null,
        assignedTo:   user?.name ?? null,
        createdBy:    user?.name ?? null,
      }),
    });
    if (res.ok) {
      const json = await res.json() as { task: LeadTask };
      setTasks(prev => [json.task, ...prev]);
      setTaskInput(''); setTaskDue('');
      toast.success(t('toasts.taskCreated'));
    } else {
      toast.error(t('toasts.taskError'));
    }
    setAddingTask(false);
  }

  async function markTaskDone(task: LeadTask) {
    const did = dealershipIdRef.current; if (!did) return;
    const newStatus = task.status === 'done' ? 'open' : 'done';
    const res = await fetch(`/api/tasks/${task.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId: did, status: newStatus }),
    });
    if (res.ok) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as TaskStatus } : t));
  }

  async function deleteTask(taskId: number) {
    const did = dealershipIdRef.current; if (!did) return;
    await fetch(`/api/tasks/${taskId}?dealershipId=${encodeURIComponent(did)}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }

  // ── Communication handler ────────────────────────────────────────────────────

  async function handleSendComm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!commBody.trim() || !lead) return;
    const did = dealershipIdRef.current; if (!did) return;
    setSendingComm(true);
    const res = await fetch('/api/communications/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId:    did,
        leadId:          lead.id,
        channel:         commChannel,
        subject:         commSubject.trim() || undefined,
        message:         commBody.trim(),
        recipientName:   lead.name,
        recipientEmail:  commChannel === 'email' ? lead.email : undefined,
        recipientPhone:  commChannel === 'sms'   ? lead.phone : undefined,
        sentBy:          user?.name ?? undefined,
      }),
    });
    const json = await res.json() as { ok: boolean; error?: string };
    if (json.ok) {
      toast.success(commChannel === 'email' ? t('toasts.emailSent') : t('toasts.smsSent'));
      setCommBody(''); setCommSubject('');
      setShowCommsPanel(false);
      loadComms(String(lead.id), did);
    } else {
      toast.error(json.error ?? t('toasts.sendError'));
    }
    setSendingComm(false);
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const score        = lead ? (lead.leadScore || computeLeadScore({
    verified: !!lead.personnummer, notes: lead.notes, stage: lead.stage,
    costPrice: lead.costPrice, rawValue: lead.value, source: lead.source,
    email: lead.email, phone: lead.phone,
  })) : 0;
  const scoreCfg     = scoreColor(score);
  const grossProfit  = lead ? lead.value - lead.costPrice : 0;
  const marginPct    = lead && lead.value > 0 ? Math.round((grossProfit / lead.value) * 100) : 0;
  const daysInStage  = lead ? daysAgo(lead.stageChangedAt) : 0;
  const overdueThresh = lead ? OVERDUE_DAYS[lead.stage] ?? 7 : 7;
  const isOverdue    = lead && lead.stage !== 'closed' && daysInStage >= overdueThresh;
  const isClosed          = lead?.stage === 'closed';
  const isLost            = isClosed && !!lead?.lostReason;
  const stageIdx          = lead ? STAGE_ORDER.indexOf(lead.stage) : 0;
  const isAccessoriesLead = lead?.leadType === 'accessories';

  // ── Add activity ────────────────────────────────────────────────────────────

  async function handleAddActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activityText.trim() || !lead) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    setAddingActivity(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/activity`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId: did,
          type:         activityType,
          content:      activityText.trim(),
          createdBy:    user?.name ?? '',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json() as { activity: Activity };
      setActivities(prev => [json.activity, ...prev]);
      setActivityText('');
      toast.success(t('toasts.activityAdded'));
    } catch {
      toast.error(t('toasts.activityError'));
    } finally {
      setAddingActivity(false);
    }
  }

  // ── Move stage ──────────────────────────────────────────────────────────────

  async function handleStageChange(newStage: string) {
    if (!lead || newStage === lead.stage) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    const prevStage = lead.stage;

    // Prevent moving a lost lead forward unless via explicit close flow
    if (newStage === 'closed') { setShowLostModal(true); return; }

    setMovingStage(true);
    try {
      await fetch(`/api/leads/${lead.id}/status`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did, stage: newStage }),
      });

      // Log activity
      await fetch(`/api/leads/${lead.id}/activity`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId: did,
          type:         'stage_change',
          content:      `Fas ändrad: ${STAGE_LABELS[prevStage]} → ${STAGE_LABELS[newStage]}`,
          meta:         { from: prevStage, to: newStage },
          createdBy:    user?.name ?? '',
        }),
      });

      setLead(prev => prev ? { ...prev, stage: newStage as LeadDetail['stage'], stageChangedAt: new Date().toISOString() } : prev);
      await loadActivities(id, did);
      emit({ type: 'lead:updated', payload: { id, status: lead.status } });
      toast.success(t('toasts.stageChanged', { stage: STAGE_LABELS[newStage] }));
    } catch {
      toast.error(t('toasts.stageError'));
    } finally {
      setMovingStage(false);
    }
  }

  // ── Cancel deal ────────────────────────────────────────────────────────────

  async function handleCancelDeal() {
    if (!lead) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/cancel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId:    did,
          reason:          cancelReason,
          reasonDetail:    cancelDetail.trim() || undefined,
          refundAmount:    parseFloat(refundAmount) || 0,
          refundBank:      refundBank.trim()      || undefined,
          refundClearing:  refundClearing.trim()  || undefined,
          refundAccount:   refundAccount.trim()   || undefined,
          refundReference: refundReference.trim() || undefined,
          returnToStock,
          notes:           cancelNotes.trim()     || undefined,
          cancelledBy:     user?.name             ?? '',
          customerName:    lead.name,
          vehicle:         lead.bike,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setLead(prev => prev ? {
        ...prev,
        stage:      'closed',
        lostReason: `Annullerad: ${cancelReason}`,
        closedAt:   new Date().toISOString(),
      } : prev);
      setShowCancelModal(false);
      await loadActivities(id, did);
      emit({ type: 'lead:updated', payload: { id, status: lead.status } });
      toast.success(t('toasts.dealCancelled'));
    } catch {
      toast.error(t('toasts.cancelError'));
    } finally {
      setCancelling(false);
    }
  }

  // ── Reactivate a lost lead ───────────────────────────────────────────────────

  async function handleReactivate() {
    if (!lead) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}/stage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did, stage: 'contacted', clearLost: true }),
      });
      if (!res.ok) throw new Error('Failed');
      setLead(prev => prev ? { ...prev, stage: 'contacted', lostReason: null, closedAt: null } : prev);
      emit({ type: 'lead:updated', payload: { id, status: lead.status } });
      toast.success(t('toasts.reactivated'));
    } catch {
      toast.error(t('toasts.reactivateError'));
    }
  }

  // ── Close as lost ───────────────────────────────────────────────────────────

  async function handleCloseLost() {
    if (!lead) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    const reason = lostReason === LOST_REASONS[LOST_REASONS.length - 1] ? (lostCustom.trim() || 'Annan anledning') : lostReason;
    setClosingLost(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/close`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did, outcome: 'lost', lostReason: reason, createdBy: user?.name ?? '' }),
      });
      if (!res.ok) throw new Error('Failed');
      setLead(prev => prev ? { ...prev, stage: 'closed', lostReason: reason, closedAt: new Date().toISOString() } : prev);
      await loadActivities(id, did);
      setShowLostModal(false);
      emit({ type: 'lead:updated', payload: { id, status: lead.status } });
      toast.success(t('toasts.closedLost'));
    } catch {
      toast.error(t('toasts.closeError'));
    } finally {
      setClosingLost(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!lead) return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{t('notFound')}</p>
          <Link href="/sales/leads" className="text-[#FF6B2C] font-semibold hover:underline">{t('back')}</Link>
        </div>
      </div>
    </div>
  );

  const initials = lead.name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-5 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">{t('pipeline.title')}</Link>
            <span>›</span>
            <span className="text-slate-700 font-medium truncate">{lead.name}</span>
          </nav>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#0f1729] flex items-center justify-center text-sm font-bold text-white shrink-0">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{lead.name}</h1>
                  {lead.personnummer && (
                    <span className="text-[9px] bg-[#0f1729] text-white px-1.5 py-0.5 rounded font-bold tracking-wide">BankID ✓</span>
                  )}
                  {isOverdue && (
                    <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{`⏰ ${t('overdue', { days: daysInStage })}`}</span>
                  )}
                  {isLost && (
                    <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{t('lostBadge')}</span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">{lead.bike}</p>
              </div>
            </div>

            {/* Score ring */}
            <ScoreRing score={score} />
          </div>

          {/* Overdue alert */}
          {isOverdue && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <span className="text-base">⏰</span>
              <span className="font-semibold">{t('reminderLabel')}</span>
              <span>{t('overdueMsg', { stage: STAGE_LABELS[lead.stage], days: daysInStage })}</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-5 md:px-8 py-5">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* LEFT COLUMN — info + actions */}
            <div className="xl:col-span-1 space-y-4">

              {/* Lead info */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">{t('info.title')}</h2>
                <div className="space-y-3 text-sm">
                  {[
                    { label: t('info.vehicle'),       value: lead.bike || '—'   },
                    { label: t('info.source'),        value: lead.source || '—' },
                    { label: t('info.seller'),      value: lead.salesPersonName || '—' },
                    { label: t('info.personnummer'), value: lead.personnummer || '—' },
                    { label: t('info.created'),       value: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide shrink-0 mt-0.5">{row.label}</span>
                      <span className="text-slate-800 font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                  {lead.email && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('info.email')}</span>
                      <a href={`mailto:${lead.email}`} className="text-[#FF6B2C] hover:underline font-medium text-sm truncate max-w-40">{lead.email}</a>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{t('info.phone')}</span>
                      <a href={`tel:${lead.phone}`} className="text-[#FF6B2C] hover:underline font-medium text-sm">{lead.phone}</a>
                    </div>
                  )}
                  {lead.notes && (
                    <div className="pt-2 border-t border-slate-50">
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">{t('info.notes')}</p>
                      <p className="text-slate-700 text-sm leading-relaxed">{lead.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Value & margin */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400 mb-3">{t('value.title')}</h2>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('value.salePrice')}</span>
                    <span className="font-bold text-slate-900">{lead.value.toLocaleString('sv-SE')} kr</span>
                  </div>
                  {lead.costPrice > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('value.costPrice')}</span>
                        <span className="text-slate-700">{lead.costPrice.toLocaleString('sv-SE')} kr</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-50 pt-2">
                        <span className="text-slate-500">{t('value.grossProfit')}</span>
                        <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {grossProfit.toLocaleString('sv-SE')} kr
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('value.margin')}</span>
                        <span className={`font-bold ${marginPct >= 15 ? 'text-emerald-600' : marginPct >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                          {marginPct} %
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Lead score breakdown */}
              <div className={`rounded-2xl border p-5 ${scoreCfg.bg} border-slate-100`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400">{t('score.title')}</h2>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreCfg.bg} ${scoreCfg.text} border border-current/20`}>
                    {scoreLabel(score)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {[
                    { label: t('score.bankid'),        pts: 30,  met: !!lead.personnummer || lead.source === 'BankID'   },
                    { label: t('score.emailPhone'),    pts: 10,  met: !!(lead.email && lead.phone) && !lead.personnummer },
                    { label: t('score.tradeIn'),       pts: 20,  met: /inbyte|trade.?in|byta in|byte/i.test(lead.notes) },
                    { label: t('score.financing'),     pts: 15,  met: /financ|finans|kredit|avbetalning|leasing/i.test(lead.notes) },
                    { label: t('score.agreementOpened'), pts: 25, met: ['negotiating','pending_payment','closed'].includes(lead.stage) },
                    { label: t('score.stageProgress'), pts: '5–20', met: lead.stage !== 'new' },
                    { label: t('score.costPriceSet'),  pts: 5,   met: lead.costPrice > 0 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={row.met ? 'text-emerald-500' : 'text-slate-300'}>
                          {row.met ? '✓' : '○'}
                        </span>
                        <span className={row.met ? 'text-slate-700' : 'text-slate-400'}>{row.label}</span>
                      </div>
                      <span className={`font-semibold ${row.met ? scoreCfg.text : 'text-slate-300'}`}>+{row.pts}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: scoreCfg.bar }} />
                </div>
              </div>

              {/* Stage pipeline — simplified for accessories leads */}
              {isAccessoriesLead ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🛒</span>
                    <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400">{t('directPurchase.title')}</h2>
                    <span className="ml-auto text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {t('directPurchase.badge')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    {t('directPurchase.desc')}
                  </p>
                  {!isClosed ? (
                    <div className="space-y-2">
                      <Link
                        href={`/sales/leads/${id}/payment`}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white transition-colors"
                      >
                        {t('directPurchase.goToPayment')}
                      </Link>
                      <button
                        onClick={() => setShowLostModal(true)}
                        className="w-full py-2 text-xs font-semibold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {t('directPurchase.cancel')}
                      </button>
                    </div>
                  ) : (
                    <>
                      {isLost && lead.lostReason && (
                        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700">
                          <p className="font-semibold mb-0.5">{t('directPurchase.cancelled')}</p>
                          <p>{lead.lostReason}</p>
                        </div>
                      )}
                      {!isLost && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 font-semibold text-center">
                          {t('directPurchase.completed')}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400 mb-3">{t('pipeline.title')}</h2>
                <div className="space-y-1.5">
                  {STAGE_ORDER.filter(s => s !== 'closed').map((s, i) => {
                    const isCurrent  = lead.stage === s;
                    const isPast     = stageIdx > i;
                    const color      = STAGE_COLORS[s];
                    return (
                      <button
                        key={s}
                        onClick={() => !isClosed && handleStageChange(s)}
                        disabled={isClosed || movingStage || s === lead.stage}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                          isCurrent
                            ? 'font-bold text-white'
                            : isPast
                            ? 'text-slate-400 bg-slate-50 cursor-default'
                            : isClosed
                            ? 'text-slate-300 cursor-default'
                            : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
                        }`}
                        style={isCurrent ? { background: color } : {}}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-white' : isPast ? 'bg-slate-200' : 'bg-slate-200'}`}
                          style={!isCurrent && !isPast ? { background: `${color}40` } : {}}
                        />
                        {STAGE_LABELS[s]}
                        {isCurrent && daysInStage > 0 && (
                          <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-normal">
                            {daysInStage}d
                          </span>
                        )}
                        {isPast && <span className="ml-auto text-[10px] text-slate-300">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {!isClosed && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {lead.stage === 'pending_payment' && (
                      <Link href={`/sales/leads/${id}/payment`}
                        className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white transition-colors">
                        {t('pipeline.goToPayment')}
                      </Link>
                    )}
                    {lead.stage === 'negotiating' && (
                      <Link href={`/sales/leads/${id}/agreement`}
                        className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white transition-colors">
                        {t('pipeline.openAgreement')}
                      </Link>
                    )}
                    {lead.stage === 'offer' && (
                      <>
                        <Link href={`/sales/leads/${id}/offer`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-colors">
                          {t('pipeline.viewOffer')}
                        </Link>
                        <Link href={`/sales/leads/${id}/agreement`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white transition-colors">
                          {t('pipeline.openAgreement')}
                        </Link>
                      </>
                    )}
                    {lead.stage === 'testride' && (
                      <>
                        <Link href={`/sales/leads/${id}/testdrive`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-violet-500 hover:bg-violet-600 text-white transition-colors">
                          {t('pipeline.viewTestDrive')}
                        </Link>
                        <Link href={`/sales/leads/${id}/offer`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-colors">
                          {t('pipeline.createOffer')}
                        </Link>
                      </>
                    )}
                    {(lead.stage === 'new' || lead.stage === 'contacted') && (
                      <>
                        <Link href={`/sales/leads/${id}/testdrive`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-violet-500 hover:bg-violet-600 text-white transition-colors">
                          {t('pipeline.bookTestDrive')}
                        </Link>
                        <Link href={`/sales/leads/${id}/offer`}
                          className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-colors">
                          {t('pipeline.createOffer')}
                        </Link>
                      </>
                    )}
                    <button
                      onClick={() => setShowLostModal(true)}
                      className="px-3 py-2 text-xs font-semibold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      {t('pipeline.markLost')}
                    </button>
                    {['offer','negotiating','pending_payment'].includes(lead.stage) && (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="px-3 py-2 text-xs font-semibold rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
                      >
                        {t('pipeline.cancelDeal')}
                      </button>
                    )}
                  </div>
                )}

                {isClosed && isLost && (
                  <div className="mt-3 space-y-2">
                    {lead.lostReason && (
                      <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700">
                        <p className="font-semibold mb-0.5">{t('pipeline.lostReason')}</p>
                        <p>{lead.lostReason}</p>
                      </div>
                    )}
                    <button
                      onClick={handleReactivate}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      {t('pipeline.reactivate')}
                    </button>
                  </div>
                )}

                {isClosed && !isLost && (
                  <Link
                    href={`/sales/leads/${id}/agreement/complete`}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    {t('pipeline.viewClosed')}
                  </Link>
                )}
              </div>
              )}

            </div>

            {/* RIGHT COLUMN — tasks, communications, activity log */}
            <div className="xl:col-span-2 space-y-4">

              {/* ── Tasks panel ─────────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">{t('tasks.title')}</h2>
                  {tasks.filter(t => t.status === 'open').length > 0 && (
                    <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {t('tasks.open', { n: tasks.filter(t => t.status === 'open').length })}
                    </span>
                  )}
                </div>

                {/* Quick-add task */}
                <form onSubmit={handleAddTask} className="mb-4">
                  <div className="flex gap-2 mb-2">
                    <input
                      value={taskInput}
                      onChange={e => setTaskInput(e.target.value)}
                      placeholder={t('tasks.placeholder')}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={addingTask || !taskInput.trim()}
                      className="px-3 py-2 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50 shrink-0"
                    >
                      {addingTask ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : '+'}
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(['follow_up','call','email','meeting'] as TaskType[]).map(tp => (
                      <button key={tp} type="button" onClick={() => setTaskType(tp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${taskType === tp ? 'bg-[#FF6B2C] text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {TASK_TYPE_CFG[tp].icon} {TASK_TYPE_CFG[tp].label}
                      </button>
                    ))}
                    <select value={taskPriority} onChange={e => setTaskPriority(e.target.value as TaskPriority)}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 bg-white outline-none ml-auto">
                      <option value="high">{t('tasks.priorityHigh')}</option>
                      <option value="medium">{t('tasks.priorityMedium')}</option>
                      <option value="low">{t('tasks.priorityLow')}</option>
                    </select>
                    <input type="date" value={taskDue.slice(0,10)} onChange={e => setTaskDue(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 outline-none" />
                  </div>
                </form>

                {/* Task list */}
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">{t('tasks.empty')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {tasks.slice(0, 5).map(task => {
                      const overdue = task.status === 'open' && task.due_date && new Date(task.due_date) < new Date();
                      return (
                        <div key={task.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${overdue ? 'border-red-200 bg-red-50/40' : 'border-slate-100'}`}>
                          <button onClick={() => markTaskDone(task)}
                            className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400'}`}
                            style={{ width: 18, height: 18 }}>
                            {task.status === 'done' && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </button>
                          <span className="text-xs mr-0.5">{TASK_TYPE_CFG[task.type]?.icon}</span>
                          <span className={`text-sm flex-1 min-w-0 truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</span>
                          {task.due_date && (
                            <span className={`text-xs shrink-0 font-medium ${overdue ? 'text-red-600' : 'text-slate-400'}`}>
                              {new Date(task.due_date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-400 text-base leading-none shrink-0">×</button>
                        </div>
                      );
                    })}
                    {tasks.length > 5 && (
                      <a href="/tasks" className="block text-center text-xs text-[#FF6B2C] hover:underline pt-1">
                        {t('tasks.viewAll', { n: tasks.length })}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* ── Communications panel ────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">{t('comms.title')}</h2>
                  <button
                    onClick={() => setShowCommsPanel(p => !p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                  >
                    {t('comms.contact')}
                  </button>
                </div>

                {/* Composer */}
                {showCommsPanel && (
                  <form onSubmit={handleSendComm} className="mb-4 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex gap-2">
                      {(['email','sms'] as const).map(ch => (
                        <button key={ch} type="button" onClick={() => setCommChannel(ch)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${commChannel === ch ? 'bg-[#FF6B2C] text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                          {ch === 'email' ? t('comms.emailBtn') : t('comms.smsBtn')}
                        </button>
                      ))}
                    </div>
                    {commChannel === 'email' && (
                      <input value={commSubject} onChange={e => setCommSubject(e.target.value)}
                        placeholder={t('comms.subjectPlaceholder')} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none bg-white" />
                    )}
                    <textarea value={commBody} onChange={e => setCommBody(e.target.value)}
                      placeholder={commChannel === 'email' ? t('comms.emailBodyPlaceholder') : t('comms.smsBodyPlaceholder', { phone: lead?.phone || t('comms.customer') })}
                      rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none resize-none bg-white" required />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowCommsPanel(false)}
                        className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">{t('comms.cancel')}</button>
                      <button type="submit" disabled={sendingComm || !commBody.trim()}
                        className="flex-1 py-2 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                        {sendingComm ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : t('comms.send')}
                      </button>
                    </div>
                  </form>
                )}

                {/* Thread */}
                {comms.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">{t('comms.empty')}</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {[...comms].reverse().map(c => {
                      const isInbound = c.direction === 'inbound';
                      return (
                        <div key={c.id} className={`flex gap-2 ${isInbound ? 'flex-row' : 'flex-row-reverse'}`}>
                          {/* Avatar */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${isInbound ? 'bg-slate-100 text-slate-500' : 'bg-[#FF6B2C]/10 text-[#FF6B2C]'}`}>
                            {isInbound ? (c.recipient_name?.[0] ?? c.sender_email?.[0] ?? '?').toUpperCase() : (c.sent_by?.[0] ?? 'D').toUpperCase()}
                          </div>
                          {/* Bubble */}
                          <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isInbound ? 'bg-slate-50 border border-slate-200 rounded-tl-sm' : 'bg-[#FF6B2C]/5 border border-[#FF6B2C]/20 rounded-tr-sm'} ${c.status === 'failed' ? '!border-red-200 !bg-red-50/40' : ''}`}>
                            {c.subject && <p className="text-xs font-semibold text-slate-700 mb-0.5">{c.subject}</p>}
                            <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{c.body}</p>
                            <div className={`flex items-center gap-1 mt-1 text-[10px] ${isInbound ? 'text-slate-400' : 'text-slate-400 justify-end'}`}>
                              <span>{c.channel === 'email' ? '✉️' : '💬'}</span>
                              <span>{isInbound ? (c.sender_email ?? c.recipient_name ?? t('comms.customer')) : (c.sent_by ?? t('comms.you'))}</span>
                              <span>·</span>
                              <span>{new Date(c.created_at).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              {c.status === 'failed' && <span className="text-red-500 font-semibold ml-1">{t('comms.failed')}</span>}
                              {isInbound && <span className="ml-1 px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">{t('comms.inbound')}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add activity */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-slate-900 mb-4">{t('activity.title')}</h2>

                {/* Type picker */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(['note', 'call', 'email', 'meeting'] as ActivityType[]).map(t => {
                    const cfg = ACTIVITY_CFG[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setActivityType(t)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                          activityType === t
                            ? 'text-white border-transparent'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                        style={activityType === t ? { background: cfg.color, borderColor: cfg.color } : {}}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleAddActivity} className="flex gap-2">
                  <input
                    value={activityText}
                    onChange={e => setActivityText(e.target.value)}
                    placeholder={
                      activityType === 'call'    ? t('activity.placeholderCall') :
                      activityType === 'email'   ? t('activity.placeholderEmail') :
                      activityType === 'meeting' ? t('activity.placeholderMeeting') :
                      t('activity.placeholderNote')
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={addingActivity || !activityText.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
                  >
                    {addingActivity ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    ) : t('activity.save')}
                  </button>
                </form>
              </div>

              {/* Documents */}
              <DocumentAttachments leadId={lead.id} uploaderName={user?.name} />

              {/* Timeline */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-slate-900">{t('timeline.title')}</h2>
                  <span className="text-xs text-slate-400">{t('timeline.events', { n: activities.length })}</span>
                </div>

                {activities.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="font-semibold text-slate-600">{t('timeline.empty')}</p>
                    <p className="text-sm text-slate-400 mt-1">{t('timeline.emptyDesc')}</p>
                  </div>
                ) : (
                  <div>
                    {/* Auto-generated entry for lead creation */}
                    {[
                      ...activities,
                      {
                        id:        -1,
                        leadId:    lead.id,
                        type:      'stage_change' as ActivityType,
                        content:   `${t('timeline.created', { bike: lead.bike || '—', value: lead.value.toLocaleString('sv-SE') })}${lead.salesPersonName ? ` ${t('by')} ${lead.salesPersonName}` : ''}`,
                        meta:      null,
                        createdBy: lead.salesPersonName,
                        createdAt: lead.createdAt,
                      },
                    ].map(act => (
                      <ActivityItem key={act.id} act={act} activityCfg={ACTIVITY_CFG} stageLabels={STAGE_LABELS} byLabel={t('by')} />
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Lost deal modal ───────────────────────────────────────────────────── */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl shrink-0">❌</div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{t('lostModal.title')}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{t('lostModal.subtitle')}</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {LOST_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setLostReason(r)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    lostReason === r
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {lostReason === r && <span className="mr-1.5">●</span>}{r}
                </button>
              ))}
            </div>

            {lostReason === 'Annan anledning' && (
              <input
                value={lostCustom}
                onChange={e => setLostCustom(e.target.value)}
                placeholder={t('lostModal.otherPlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 mb-4"
              />
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowLostModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t('lostModal.cancel')}
              </button>
              <button
                onClick={handleCloseLost}
                disabled={closingLost}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {closingLost ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {t('lostModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel deal modal ─────────────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-xl shrink-0">↩️</div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{t('cancelModal.title')}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{t('cancelModal.subtitle')}</p>
              </div>
            </div>

            {/* Reason */}
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('cancelModal.reasonLabel')}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([
                { value: 'changed_mind',      label: t('cancelModal.reasons.changed_mind') },
                { value: 'financial',         label: t('cancelModal.reasons.financial') },
                { value: 'found_elsewhere',   label: t('cancelModal.reasons.found_elsewhere') },
                { value: 'financing_denied',  label: t('cancelModal.reasons.financing_denied') },
                { value: 'other',             label: t('cancelModal.reasons.other') },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCancelReason(opt.value)}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium text-left transition-colors ${
                    cancelReason === opt.value
                      ? 'bg-rose-50 border-rose-400 text-rose-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {cancelReason === opt.value && <span className="mr-1">●</span>}{opt.label}
                </button>
              ))}
            </div>

            <input
              value={cancelDetail}
              onChange={e => setCancelDetail(e.target.value)}
              placeholder={t('cancelModal.detailsPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 mb-4"
            />

            {/* Refund */}
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('cancelModal.refundLabel')}</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">{t('cancelModal.amountLabel')}</label>
                  <input
                    type="number" min="0" step="100"
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-rose-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">{t('cancelModal.bankLabel')}</label>
                  <input
                    value={refundBank}
                    onChange={e => setRefundBank(e.target.value)}
                    placeholder={t('cancelModal.bankPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-rose-400"
                  />
                </div>
              </div>
              {parseFloat(refundAmount) > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">{t('cancelModal.clearingLabel')}</label>
                    <input
                      value={refundClearing}
                      onChange={e => setRefundClearing(e.target.value)}
                      placeholder="6xxx"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-rose-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 mb-1 block">{t('cancelModal.accountLabel')}</label>
                    <input
                      value={refundAccount}
                      onChange={e => setRefundAccount(e.target.value)}
                      placeholder="Kontonummer"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-rose-400"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-slate-500 mb-1 block">{t('cancelModal.referenceLabel')}</label>
                    <input
                      value={refundReference}
                      onChange={e => setRefundReference(e.target.value)}
                      placeholder="t.ex. ÅTERBET-2026-001"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-rose-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Return to stock toggle */}
            <button
              onClick={() => setReturnToStock(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border mb-4 transition-colors ${
                returnToStock ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-slate-200 text-slate-600'
              }`}
            >
              <span className="text-sm font-medium">{t('cancelModal.returnToStock')}</span>
              <span className={`w-10 h-6 rounded-full flex items-center transition-colors relative ${returnToStock ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`w-4 h-4 rounded-full bg-white absolute shadow transition-all ${returnToStock ? 'left-5' : 'left-1'}`} />
              </span>
            </button>

            {/* Notes */}
            <textarea
              value={cancelNotes}
              onChange={e => setCancelNotes(e.target.value)}
              rows={2}
              placeholder={t('cancelModal.notesPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t('cancelModal.cancel')}
              </button>
              <button
                onClick={handleCancelDeal}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {cancelling && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {t('cancelModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
