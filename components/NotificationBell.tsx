'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AppNotification,
  NOTIFS_EVENT,
  getNotifsKey,
  getNotifications,
  markAllRead,
  markRead,
  clearAll,
  addNotification,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';

const TYPE_ICONS: Record<AppNotification['type'], string> = {
  lead:      '💰',
  agreement: '📝',
  payment:   '💳',
  customer:  '👤',
  system:    '⚙',
};

export default function NotificationBell() {
  const t      = useTranslations('notifications');
  const router = useRouter();
  const [notifs,    setNotifs]    = useState<AppNotification[]>([]);
  const [open,      setOpen]      = useState(false);
  const [expanded,  setExpanded]  = useState<AppNotification | null>(null);
  const panelRef                  = useRef<HTMLDivElement>(null);

  const relativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return t('bell.justNow');
    if (mins < 60) return t('bell.minAgo',  { n: mins });
    const h = Math.floor(mins / 60);
    if (h < 24)    return t('bell.hourAgo', { n: h });
    return t('bell.dayAgo', { n: Math.floor(h / 24) });
  };

  const load = () => setNotifs(getNotifications());

  // Fetch unread server notifications on mount and merge into localStorage
  useEffect(() => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('dealership_id', dealershipId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data?.length) return;
        const existing    = getNotifications();
        const existingIds = new Set(existing.map(n => n.id));
        data.forEach(row => {
          if (existingIds.has(row.id)) return;
          addNotification({
            id:        row.id,
            type:      row.type as AppNotification['type'],
            title:     row.title,
            message:   row.message,
            href:      row.href ?? undefined,
            createdAt: row.created_at,
          });
        });
      });
  }, []);

  // Live Supabase Realtime — new notifications appear instantly without refresh
  useEffect(() => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const channel = supabase
      .channel(`notifications-live-${dealershipId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `dealership_id=eq.${dealershipId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new;
          const existing = getNotifications();
          if (existing.some(n => n.id === row.id)) return; // dedup
          addNotification({
            id:        row.id,
            type:      row.type as AppNotification['type'],
            title:     row.title,
            message:   row.message,
            href:      row.href ?? undefined,
            createdAt: row.created_at,
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(NOTIFS_EVENT, load);
    // Also sync when another tab writes to localStorage
    const onStorage = (e: StorageEvent) => {
      if (e.key === getNotifsKey()) load();
      if (e.key === 'app_notifications') load();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(NOTIFS_EVENT, load);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Close panel when clicking anywhere outside the bell component
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unread = notifs.filter(n => !n.read).length;

  const handleOpen = () => {
    setOpen(o => !o);
  };

  // Close the expanded detail when the panel closes
  useEffect(() => {
    if (!open) setExpanded(null);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        title={t('bell.title')}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all focus:outline-none"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (

          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-[#FF6B2C] rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none">

            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="fixed left-64 bottom-16 w-80 bg-[#0f1b2d] border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden animate-fade-up">

            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{t('bell.title')}</h3>
                {unread > 0 && (
                  <span className="text-[10px] font-bold bg-[#FF6B2C] text-white px-1.5 py-0.5 rounded-full">
                    {unread} {t('bell.new')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {notifs.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                  >
                    {t('bell.clearAll')}
                  </button>
                )}
                <Link
                  href="/settings/notifications"
                  onClick={() => setOpen(false)}
                  className="text-[10px] text-[#FF6B2C] hover:underline"
                >
                  {t('bell.settings')}
                </Link>
              </div>
            </div>

            {/* Notification list */}
            <div className="max-h-90 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-2xl mb-2">🔔</p>
                  <p className="text-xs text-slate-500">{t('bell.empty')}</p>
                  <p className="text-[11px] text-slate-600 mt-1">{t('bell.emptyHint')}</p>
                </div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      // Also mark read in Supabase (best-effort)
                      supabase.from('notifications').update({ read: true }).eq('id', n.id).then(() => {});
                      if (n.href) {
                        setOpen(false);
                        router.push(n.href);
                      } else {
                        setExpanded(n);
                      }
                    }}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 cursor-pointer transition-colors hover:bg-white/5 ${
                      !n.read ? 'bg-white/3' : ''
                    }`}
                  >
                    {/* Icon */}
                    <span className="text-base shrink-0 mt-0.5">{TYPE_ICONS[n.type]}</span>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold truncate ${n.read ? 'text-slate-400' : 'text-white'}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C] shrink-0 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-600">{relativeTime(n.createdAt)}</p>
                        {n.href ? (
                          <span className="text-[10px] text-[#FF6B2C] font-semibold">Öppna →</span>
                        ) : (
                          <span className="text-[10px] text-slate-600 hover:text-slate-400">Läs mer</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
                <p className="text-[10px] text-slate-600">
                  {t('bell.total', { count: notifs.length })}
                </p>
                {unread > 0 && (
                  <button
                    onClick={() => {
                      markAllRead();
                      const dealershipId = getDealershipId();
                      if (dealershipId) {
                        supabase.from('notifications').update({ read: true })
                          .eq('dealership_id', dealershipId).eq('read', false).then(() => {});
                      }
                    }}
                    className="text-[10px] text-[#FF6B2C] hover:underline"
                  >
                    Markera alla som lästa
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail modal — shown when a notification without href is expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setExpanded(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Card */}
          <div
            className="relative z-10 bg-[#0f1b2d] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
              <span className="text-2xl">{TYPE_ICONS[expanded.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{expanded.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{relativeTime(expanded.createdAt)}</p>
              </div>
              <button
                onClick={() => setExpanded(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-sm text-slate-300 leading-relaxed">{expanded.message}</p>
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 flex gap-2">
              {expanded.href && (
                <Link
                  href={expanded.href}
                  onClick={() => { setExpanded(null); setOpen(false); }}
                  className="flex-1 text-center text-xs font-semibold bg-[#FF6B2C] hover:bg-[#e55a1f] text-white px-4 py-2 rounded-xl transition-colors"
                >
                  Öppna →
                </Link>
              )}
              <button
                onClick={() => setExpanded(null)}
                className="flex-1 text-center text-xs font-semibold border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl transition-colors"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}


