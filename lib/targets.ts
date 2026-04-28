import { getDealershipId } from './tenant';

export interface StaffTarget {
  id:            string;
  dealershipId:  string;
  staffEmail:    string;
  staffName:     string;
  periodYear:    number;
  periodMonth:   number;   // 0 = annual, 1-12 = monthly
  leadsTarget:   number;
  revenueTarget: number;
  createdAt:     string;
  updatedAt:     string;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-dealership-id': getDealershipId() ?? '',
  };
}

export async function getTargets(year?: number): Promise<StaffTarget[]> {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  const res = await fetch(`/api/targets?${params}`, { headers: headers() });
  if (!res.ok) return [];
  return res.json();
}

export async function upsertTarget(data: Omit<StaffTarget, 'id' | 'dealershipId' | 'createdAt' | 'updatedAt'>): Promise<StaffTarget> {
  const res = await fetch('/api/targets', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to save target');
  }
  return res.json();
}

export async function deleteTarget(id: string): Promise<void> {
  const res = await fetch(`/api/targets/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to delete target');
  }
}
