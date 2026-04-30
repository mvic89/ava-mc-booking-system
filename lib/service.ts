// ─── Service Module — Client-side types & fetch helpers ──────────────────────

import { getDealershipId } from '@/lib/tenant';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'booked' | 'confirmed' | 'checked_in'
  | 'in_progress' | 'ready' | 'completed' | 'cancelled';

export type WorkOrderStatus =
  | 'created' | 'in_progress' | 'waiting_parts'
  | 'ready' | 'completed' | 'invoiced';

export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ServiceType = 'maintenance' | 'repair' | 'inspection' | 'recall' | 'other';
export type PartStatus = 'needed' | 'reserved' | 'ordered' | 'received' | 'used';
export type TaskStatus = 'pending' | 'in_progress' | 'done';

export interface ServiceBooking {
  id:            number;
  dealership_id: string;
  customer_id:   number | null;
  customer_name: string;
  customer_phone:string;
  customer_email:string;
  vehicle_id:    number | null;
  vehicle_name:  string;
  plate:         string;
  vin:           string;
  service_type:  ServiceType;
  description:   string;
  scheduled_at:  string;
  duration_min:  number;
  assigned_tech: string;
  status:        BookingStatus;
  work_order_id: number | null;
  notes:         string;
  created_at:    string;
  updated_at:    string;
}

export interface WorkOrder {
  id:             number;
  dealership_id:  string;
  booking_id:     number | null;
  customer_id:    number | null;
  customer_name:  string;
  customer_phone: string;
  vehicle_id:     number | null;
  vehicle_name:   string;
  plate:          string;
  vin:            string;
  status:         WorkOrderStatus;
  priority:       WorkOrderPriority;
  assigned_tech:  string;
  description:    string;
  internal_notes: string;
  mileage:        number | null;
  labor_rate:     number;
  parts_cost:     number;
  labor_cost:     number;
  total_cost:     number;
  invoice_id:     string | null;
  started_at:     string | null;
  completed_at:   string | null;
  created_at:     string;
  updated_at:     string;
}

export interface WorkOrderTask {
  id:            number;
  work_order_id: number;
  title:         string;
  description:   string;
  estimated_hrs: number;
  actual_hrs:    number;
  tech_name:     string;
  status:        TaskStatus;
  created_at:    string;
}

export interface WorkOrderPart {
  id:               number;
  work_order_id:    number;
  part_number:      string;
  name:             string;
  quantity:         number;
  unit_cost:        number;
  total_cost:       number;
  status:           PartStatus;
  purchase_order_id?: string | null;
  created_at:       string;
}

export interface TimeEntry {
  id:              number;
  work_order_id:   number;
  task_id:         number | null;
  tech_name:       string;
  clocked_in_at:   string;
  clocked_out_at:  string | null;
  duration_min:    number | null;
  billable:        boolean;
  notes:           string;
  created_at:      string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  booked:      'Bokad',
  confirmed:   'Bekräftad',
  checked_in:  'Incheckad',
  in_progress: 'Pågår',
  ready:       'Redo',
  completed:   'Slutförd',
  cancelled:   'Avbokad',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  booked:      'bg-blue-100 text-blue-700',
  confirmed:   'bg-indigo-100 text-indigo-700',
  checked_in:  'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-amber-100 text-amber-700',
  ready:       'bg-emerald-100 text-emerald-700',
  completed:   'bg-slate-100 text-slate-500',
  cancelled:   'bg-red-100 text-red-500',
};

export const WO_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  created:       'Skapad',
  in_progress:   'Pågår',
  waiting_parts: 'Väntar delar',
  ready:         'Redo för hämtning',
  completed:     'Slutförd',
  invoiced:      'Fakturerad',
};

export const WO_STATUS_COLORS: Record<WorkOrderStatus, string> = {
  created:       'bg-blue-100 text-blue-700',
  in_progress:   'bg-amber-100 text-amber-700',
  waiting_parts: 'bg-orange-100 text-orange-700',
  ready:         'bg-emerald-100 text-emerald-700',
  completed:     'bg-slate-100 text-slate-500',
  invoiced:      'bg-purple-100 text-purple-700',
};

export const PRIORITY_COLORS: Record<WorkOrderPriority, string> = {
  low:    'bg-slate-100 text-slate-500',
  normal: 'bg-blue-50 text-blue-600',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-600',
};

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  low:    'Låg',
  normal: 'Normal',
  high:   'Hög',
  urgent: 'Akut',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  maintenance: 'Service / Underhåll',
  repair:      'Reparation',
  inspection:  'Besiktning',
  recall:      'Återkallelse',
  other:       'Övrigt',
};

// ── Fetch helpers (client-side) ───────────────────────────────────────────────

function dealerParam() {
  const id = getDealershipId();
  return id ? `dealershipId=${id}` : '';
}

export async function getServiceBookings(): Promise<ServiceBooking[]> {
  const res = await fetch(`/api/service/bookings?${dealerParam()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.bookings ?? [];
}

export async function getServiceBooking(id: number): Promise<ServiceBooking | null> {
  const res = await fetch(`/api/service/bookings/${id}?${dealerParam()}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.booking ?? null;
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const res = await fetch(`/api/service/orders?${dealerParam()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.orders ?? [];
}

export async function getWorkOrder(id: number): Promise<{
  order: WorkOrder | null;
  tasks: WorkOrderTask[];
  parts: WorkOrderPart[];
  time: TimeEntry[];
}> {
  const res = await fetch(`/api/service/orders/${id}?${dealerParam()}`);
  if (!res.ok) return { order: null, tasks: [], parts: [], time: [] };
  return res.json();
}
