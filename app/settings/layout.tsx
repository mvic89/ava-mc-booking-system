'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // The auth page itself is always accessible
    if (pathname === '/settings/auth') {
      setChecking(false);
      return;
    }
    const unlocked = sessionStorage.getItem('settings_unlocked');
    if (!unlocked) {
      router.replace('/settings/auth');
      // keep spinner visible while redirect completes
    } else {
      setChecking(false);
    }
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
        <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
