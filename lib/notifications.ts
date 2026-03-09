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

const NOTIFS_KEY = 'app_notifications';
const PREFS_KEY  = 'notification_preferences';
export const NOTIFS_EVENT = 'app_notifications_updated';

export const DEFAULT_PREFS: NotificationPreferences = {
  newLead:         { inApp: true,  email: true,  sms: false },
  agreementSigned: { inApp: true,  email: true,  sms: true  },
  paymentReceived: { inApp: true,  email: true,  sms: true  },
  newCustomer:     { inApp: true,  email: false, sms: false },
};

// ── Read ──────────────────────────────────────────────────────────────────────

export function getNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIFS_KEY) || '[]');
  } catch { return []; }
}

export function getPreferences(): NotificationPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
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

export function addNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
  const list = getNotifications();
  const item: AppNotification = {
    ...n,
    id:        Date.now().toString() + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    read:      false,
  };
  const updated = [item, ...list].slice(0, 50); // keep latest 50
  localStorage.setItem(NOTIFS_KEY, JSON.stringify(updated));
  broadcast();
}

export function markRead(id: string): void {
  const updated = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
  localStorage.setItem(NOTIFS_KEY, JSON.stringify(updated));
  broadcast();
}

export function markAllRead(): void {
  const updated = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFS_KEY, JSON.stringify(updated));
  broadcast();
}

export function clearAll(): void {
  localStorage.removeItem(NOTIFS_KEY);
  broadcast();
}

export function savePreferences(prefs: NotificationPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ── Main notify() helper ──────────────────────────────────────────────────────
// Call this at every action point. Respects the user's per-channel toggles.
// Email/SMS are simulated (logged to console — replace with real API calls).

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
  if (ch.email) {
    // In production: POST /api/notifications/email
    console.info('[Email notification]', n.title, '—', n.message);
  }
  if (ch.sms) {
    // In production: POST /api/notifications/sms
    console.info('[SMS notification]', n.title, '—', n.message);
  }
}
