import { getDealershipId } from './tenant';

export interface Branch {
  id:          string;
  dealershipId: string;
  name:        string;
  address:     string | null;
  city:        string | null;
  phone:       string | null;
  managerName: string | null;
  active:      boolean;
  createdAt:   string;
  updatedAt:   string;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-dealership-id': getDealershipId() ?? '',
  };
}

export async function getBranches(): Promise<Branch[]> {
  const res = await fetch('/api/branches', { headers: headers() });
  if (!res.ok) return [];
  return res.json();
}

export async function createBranch(data: Omit<Branch, 'id' | 'dealershipId' | 'createdAt' | 'updatedAt'>): Promise<Branch> {
  const res = await fetch('/api/branches', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create branch');
  }
  return res.json();
}

export async function updateBranch(id: string, data: Partial<Omit<Branch, 'id' | 'dealershipId' | 'createdAt' | 'updatedAt'>>): Promise<Branch> {
  const res = await fetch(`/api/branches/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to update branch');
  }
  return res.json();
}

export async function deleteBranch(id: string): Promise<void> {
  const res = await fetch(`/api/branches/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to delete branch');
  }
}
