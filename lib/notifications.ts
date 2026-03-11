const STORAGE_KEY = 'app_notifications';
export const NOTIFS_EVENT = 'app_notifications_updated';

export type AppNotification = {
  id: string;
  type: 'lead' | 'agreement' | 'payment' | 'customer' | 'system';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

function dispatch() {
  window.dispatchEvent(new Event(NOTIFS_EVENT));
}

export function getNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(notifs: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
  dispatch();
}

export function markRead(id: string) {
  save(getNotifications().map(n => n.id === id ? { ...n, read: true } : n));
}

export function markAllRead() {
  save(getNotifications().map(n => ({ ...n, read: true })));
}

export function clearAll() {
  save([]);
}
