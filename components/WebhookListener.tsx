'use client';

import { useWebhookEvents } from '@/hooks/useWebhookEvents';

/**
 * Invisible component — mounts the Supabase Realtime webhook subscription.
 * Place this inside any layout or component that is always rendered while
 * the user is logged in (e.g. Sidebar).
 */
export default function WebhookListener() {
  useWebhookEvents();
  return null;
}
