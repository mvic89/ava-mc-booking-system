// ─── Notification store ───────────────────────────────────────────────────────
// Pure localStorage + CustomEvent bus — no server required.

export type NotifType = 'lead' | 'agreement' | 'payment' | 'customer' | 'system';

export interface AppNotification {
  id:        string;
  type:      NotifType;
  title:     string;
  message:   string;
  createdAt: string; // ISO
  read:      boolean;
  href?:     string;
}

export interface NotificationPreferences {
  newLead:         { inApp: boolean; email: boolean; sms: boolean };
  agreementSigned: { inApp: boolean; email: boolean; sms: boolean };
  paymentReceived: { inApp: boolean; email: boolean; sms: boolean };
  newCustomer:     { inApp: boolean; email: boolean; sms: boolean };
}

export const NOTIFS_EVENT = 'app_notifications_updated';

// ── Scoped key helpers ────────────────────────────────────────────────────────
// Keys are scoped per dealership + user so notifications are never shared
// across dealerships (tenant isolation) or across different staff accounts
// on the same device.

function getCurrentUserCtx(): { dealershipId: string; email: string } {
  if (typeof window === 'undefined') return { dealershipId: '', email: '' };
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    return {
      dealershipId: (u.dealershipId as string) || '',
      email:        (u.email        as string) || '',
    };
  } catch {
    return { dealershipId: '', email: '' };
  }
}

/** Returns the localStorage key for notifications for the current signed-in user. */
export function getNotifsKey(): string {
  const { dealershipId, email } = getCurrentUserCtx();
  if (!dealershipId && !email) return 'app_notifications'; // unauthenticated fallback
  return `app_notifications_${dealershipId}_${email}`;
}

function getPrefsKey(): string {
  const { dealershipId, email } = getCurrentUserCtx();
  if (!dealershipId && !email) return 'notification_preferences';
  return `notification_prefs_${dealershipId}_${email}`;
}

export const DEFAULT_PREFS: NotificationPreferences = {
  newLead:         { inApp: true,  email: true,  sms: false },
  agreementSigned: { inApp: true,  email: true,  sms: true  },
  paymentReceived: { inApp: true,  email: true,  sms: true  },
  newCustomer:     { inApp: true,  email: false, sms: false },
};

// ── Read ──────────────────────────────────────────────────────────────────────

export function getNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(getNotifsKey()) || '[]');
  } catch { return []; }
}

export function getPreferences(): NotificationPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(getPrefsKey()) || '{}');
    return {
      newLead:         { ...DEFAULT_PREFS.newLead,         ...saved.newLead },
      agreementSigned: { ...DEFAULT_PREFS.agreementSigned, ...saved.agreementSigned },
      paymentReceived: { ...DEFAULT_PREFS.paymentReceived, ...saved.paymentReceived },
      newCustomer:     { ...DEFAULT_PREFS.newCustomer,     ...saved.newCustomer },
    };
  } catch { return DEFAULT_PREFS; }
}

// ── Write ─────────────────────────────────────────────────────────────────────

function broadcast() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFS_EVENT));
  }
}

export function addNotification(
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string; createdAt?: string },
): void {
  const list = getNotifications();
  const item: AppNotification = {
    type:      n.type,
    title:     n.title,
    message:   n.message,
    href:      n.href,
    id:        n.id ?? (Date.now().toString() + Math.random().toString(36).slice(2, 6)),
    createdAt: n.createdAt ?? new Date().toISOString(),
    read:      false,
  };
  const updated = [item, ...list].slice(0, 50); // keep latest 50
  localStorage.setItem(getNotifsKey(), JSON.stringify(updated));
  broadcast();
}

export function markRead(id: string): void {
  const updated = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem(getNotifsKey(), JSON.stringify(updated));
  broadcast();
}

export function markAllRead(): void {
  const updated = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(getNotifsKey(), JSON.stringify(updated));
  broadcast();
}

export function clearAll(): void {
  localStorage.removeItem(getNotifsKey());
  broadcast();
}

export function savePreferences(prefs: NotificationPreferences): void {
  localStorage.setItem(getPrefsKey(), JSON.stringify(prefs));
}

// ── Main notify() helper ──────────────────────────────────────────────────────
// Call this at every action point. Respects the user's per-channel toggles.
// Email and SMS are dispatched via POST /api/notifications/send using the
// dealership's configured SMTP and Twilio credentials.

export function notify(
  event: keyof NotificationPreferences,
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>,
): void {
  if (typeof window === 'undefined') return;
  const prefs = getPreferences();
  const ch    = prefs[event];

  if (ch.inApp) {
    addNotification(n);
  }

  // Collect channels that need server-side dispatch
  const remoteChannels: ('email' | 'sms')[] = [];
  if (ch.email) remoteChannels.push('email');
  if (ch.sms)   remoteChannels.push('sms');

  if (remoteChannels.length > 0) {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}');
      const dealershipId = (u.dealershipId as string) || '';
      if (dealershipId) {
        // Fire-and-forget — don't block the UI
        fetch('/api/notifications/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealershipId,
            channels:   remoteChannels,
            title:      n.title,
            message:    n.message,
            href:       n.href,
            eventType:  event,
          }),
        }).catch(err => console.error('[notify] send error:', err));
      }
    } catch (err) {
      console.error('[notify] could not dispatch remote notification:', err);
    }
  }
}
