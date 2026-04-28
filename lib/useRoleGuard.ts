'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { type Permission, canAccess } from './permissions';

/**
 * Drop into any page that requires a specific permission.
 *
 * ```tsx
 * useRoleGuard('analytics');   // redirects non-admins/sales_managers back to dashboard
 * ```
 */
export function useRoleGuard(required: Permission) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('user');
    if (!raw) {
      router.replace('/auth/login');
      return;
    }
    if (!canAccess(required)) {
      toast.error('Du har inte behörighet till den här sidan.');
      router.replace('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
