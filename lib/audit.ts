/**
 * Fire-and-forget audit helper.
 * Call WITHOUT await — never blocks the primary operation.
 * dealership_id is stored inside new_data JSONB so the audit-log page can
 * filter by dealer without requiring a dedicated schema column.
 */
import { getSupabaseAdmin } from '@/lib/supabase';

export interface AuditParams {
  action:        string;          // e.g. 'LEAD_STAGE_CHANGED'
  entity:        string;          // e.g. 'lead'
  entityId?:     string | number;
  details?:      Record<string, unknown>;
  dealershipId?: string;
  ipAddress?:    string;
}

export function logAudit(params: AuditParams): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getSupabaseAdmin() as any)
    .from('audit_logs')
    .insert({
      action:     params.action,
      entity:     params.entity,
      entity_id:  params.entityId != null ? String(params.entityId) : null,
      new_data:   { dealership_id: params.dealershipId ?? null, ...params.details },
      ip_address: params.ipAddress ?? null,
    })
    .then(() => { /* fire-and-forget */ })
    .catch(() => { /* non-fatal — never break the primary operation */ });
}
