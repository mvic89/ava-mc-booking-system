'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ALLOWED_ROLES = ['admin', 'service', 'technician', 'platform_admin'];

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) { router.replace('/auth/login'); return; }
      const role: string = JSON.parse(raw).role ?? '';
      if (ALLOWED_ROLES.includes(role)) {
        setAllowed(true);
      } else {
        router.replace('/dashboard');
      }
    } catch {
      router.replace('/auth/login');
    }
  }, [router]);

  if (!allowed) return null;
  return <>{children}</>;
}
